#!/usr/bin/env node

/**
 * Backfill embeddings for QuestionBank documents.
 * By default, it will skip questions that already have an embedding and will
 * skip coding questions that have a corresponding CodingProblemDetails entry
 * (to avoid redundant embeddings when the coding docs will be used directly).
 *
 * Usage: node backend/scripts/backfillEmbeddings.js [--force] [--embed-coding] [--batch=200] [--delayMs=100]
 */

const mongoose = require('mongoose');
const path = require('path');
const QuestionBank = require('../models/QuestionBank');
const CodingProblemDetails = require('../models/CodingProblemDetails');
const { generateAndSetEmbeddingForQuestion } = require('../services/embeddingsService');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const argv = process.argv.slice(2);
const opts = {
  force: argv.includes('--force'),
  reEmbed: argv.includes('--re-embed'),
  embedCoding: argv.includes('--embed-coding'),
  batch: 200,
  delayMs: 150,
  dryRun: argv.includes('--dry-run'),
  limit: null,
};
for (const arg of argv) {
  if (arg.startsWith('--batch=')) opts.batch = parseInt(arg.split('=')[1], 10) || opts.batch;
  if (arg.startsWith('--delayMs=')) opts.delayMs = parseInt(arg.split('=')[1], 10) || opts.delayMs;
  if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1], 10) || opts.limit;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('MONGODB_URI not set in environment. Aborting.');
    process.exit(1);
  }
  await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const total = await QuestionBank.countDocuments();
  console.log(`QuestionBank total documents: ${total}`);

  let processed = 0;
  const cursor = QuestionBank.find().cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    processed++;
    const qId = String(doc.questionId || doc._id);

    if (opts.limit && processed > opts.limit) break;

    const activeModel = process.env.GOOGLE_EMBEDDING_MODEL || 'text-embedding-004';
    const modelMismatch = doc.embeddingModel && doc.embeddingModel !== activeModel;
    const shouldSkipExisting = !opts.force && !opts.reEmbed && !modelMismatch && Array.isArray(doc.embedding) && doc.embedding.length > 0;

    if (shouldSkipExisting) {
      console.log(`[${processed}/${total}] Skipping ${qId} (already has embedding)`);
      continue;
    }

    if (doc.isCodingProblem && !opts.embedCoding) {
      // Check if CodingProblemDetails exist
      const cp = await CodingProblemDetails.findOne({ questionId: qId }).lean();
      if (cp) {
        console.log(`[${processed}/${total}] Skipping coding question ${qId} (CodingProblemDetails exists)`);
        continue;
      }
    }

    try {
      console.log(`[${processed}/${total}] Generating embedding for ${qId}`);
      if (!opts.dryRun) {
        await generateAndSetEmbeddingForQuestion(qId, doc.questionText);
        console.log(`  -> Success for ${qId}`);
      } else {
        console.log(`  -> DRY RUN: would generate embedding for ${qId}`);
      }
    } catch (err) {
      console.error(`  -> Failed for ${qId}:`, err.message || err);
    }

    if (processed % opts.batch === 0) {
      console.log(`Processed ${processed} / ${total}`);
    }

    await sleep(opts.delayMs);
  }

  console.log('Backfill complete');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
