/**
 * Import company-wise LeetCode CSV metadata into QuestionBank.
 *
 * Usage:
 *   node backend/scripts/importCompanyWiseQuestions.js
 *   node backend/scripts/importCompanyWiseQuestions.js --source .companywise-import-tmp
 *   node backend/scripts/importCompanyWiseQuestions.js --dry-run
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const QuestionBank = require('../models/QuestionBank');
const {
  loadOptionalDotenv,
  normalizeText,
  parseCsv,
  stableQuestionId,
  parseTopics,
  toFloatOrNull,
  collectCsvFiles,
} = require('./importHelpers');

const DEFAULT_SOURCE_DIR = path.resolve(__dirname, '..', '..', '..', 'leetcode-company-wise-problems');

loadOptionalDotenv(path.resolve(__dirname, '..', '.env'));

const parseArgs = (argv) => {
  const args = { source: DEFAULT_SOURCE_DIR, dryRun: false };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith('--source=')) {
      args.source = path.resolve(value.slice('--source='.length));
    } else if (value === '--source' && argv[i + 1]) {
      args.source = path.resolve(argv[i + 1]);
      i += 1;
    } else if (value === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
};

const deriveRole = (row, company) => {
  const haystack = normalizeText([row.Title, row.Topics, company].join(' '));

  const checks = [
    ['frontend-developer', ['react', 'css', 'html', 'browser', 'dom', 'ui', 'component', 'javascript utility', 'debounce', 'promise', 'event emitter', 'virtualized list']],
    ['backend-developer', ['api', 'database', 'sql', 'cache', 'lru', 'redis', 'rate limiter', 'url shortener', 'distributed', 'concurrency', 'system design', 'server']],
    ['devops-engineer', ['linux', 'bash', 'docker', 'kubernetes', 'terraform', 'ci cd', 'observability', 'monitoring', 'secrets', 'process', 'infrastructure', 'deployment']],
    ['data-scientist', ['machine learning', 'ml', 'statistics', 'probability', 'regression', 'classification', 'gradient boosting', 'transformer', 'feature', 'experiment']],
  ];

  for (const [role, keywords] of checks) {
    if (keywords.some((keyword) => haystack.includes(normalizeText(keyword)))) {
      return role;
    }
  }

  return 'software-engineer';
};

const buildQuestionText = (row) => {
  const title = String(row.Title || '').trim();
  const topics = parseTopics(row.Topics || row.Topic || '');
  const difficulty = String(row.Difficulty || '').toLowerCase();

  return [
    `[CODING_PROBLEM] ${title}`,
    topics.length ? `Topics: ${topics.join(', ')}.` : '',
    'Solve the problem efficiently. Explain your approach, edge cases, and time and space complexity.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const run = async () => {
  const { source, dryRun } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(source)) {
    console.error(`Source directory does not exist: ${source}`);
    process.exit(1);
  }

  const csvFiles = collectCsvFiles(source);
  if (csvFiles.length === 0) {
    console.error(`No CSV files found under: ${source}`);
    process.exit(1);
  }

  console.log(`Found ${csvFiles.length} CSV files under ${source}`);

  const documents = [];
  const seenIds = new Set();

  for (const filePath of csvFiles) {
    const baseName = path.basename(filePath, '.csv');
    const company = baseName.replace(/_(?:6months|1year|2year|alltime)$/i, '').replace(/-/g, ' ').trim();
    const raw = fs.readFileSync(filePath, 'utf8');
    const rows = parseCsv(raw);

    for (const row of rows) {
      const title = String(row.Title || '').trim();
      const link = String(row.Link || row['Leetcode Question Link'] || row['Question Link'] || '').trim();
      if (!title || !link) {
        continue;
      }

      const questionId = stableQuestionId({ company, title, link });
      if (seenIds.has(questionId)) {
        continue;
      }
      seenIds.add(questionId);

      const difficulty = String(row.Difficulty || '').toLowerCase();
      const role = deriveRole(row, company);
      const normalizedTitle = normalizeText(title);
      const frequency = toFloatOrNull(row.Frequency) || 0;
      const acceptanceRate = toFloatOrNull(row['Acceptance Rate'] || row.Acceptance);
      const topics = parseTopics(row.Topics || row.Topic || '');

      documents.push({
        questionId,
        company,
        title,
        normalizedTitle,
        questionText: buildQuestionText(row),
        difficulty,
        topic: topics[0] || String(row.Topics || 'General').trim(),
        tags: topics,
        role,
        isCodingProblem: true,
        link,
        frequency,
        acceptanceRate,
        sourceSystem: 'krishnadey30/leetcode-questions-companywise',
      });
    }
  }

  console.log(`Prepared ${documents.length} normalized question documents.`);

  if (dryRun) {
    console.log('Dry run enabled. No database writes performed.');
    console.log(JSON.stringify(documents.slice(0, 5), null, 2));
    return;
  }

  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('MONGODB_URI is not set in the environment variables.');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB. Upserting question metadata...');

  let inserted = 0;
  let updated = 0;

  const shouldEmbed = process.env.RAG_AUTO_EMBED_ON_IMPORT === 'true' || process.argv.includes('--with-embeddings');

  for (const document of documents) {
    const result = await QuestionBank.updateOne(
      { questionId: document.questionId },
      { $set: document },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
      // Optionally generate embedding for newly inserted docs
      if (shouldEmbed) {
        try {
          // Defer to embeddingsService to generate and set embedding
          const { generateAndSetEmbeddingForQuestion } = require('../services/embeddingsService');
          console.log(`Generating embedding for new question ${document.questionId}`);
          await generateAndSetEmbeddingForQuestion(document.questionId, document.questionText);
        } catch (err) {
          console.error(`Failed to generate embedding for ${document.questionId}:`, err.message || err);
        }
      }
    } else if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`Import complete. Inserted: ${inserted}, Updated: ${updated}, Total processed: ${documents.length}`);
  await mongoose.connection.close();
};

run().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
