#!/usr/bin/env node

/**
 * scripts/tagPatterns.js
 *
 * Tags QuestionBank documents with canonical DSA patterns.
 * Step 1: Deterministic keyword & tag mapping table.
 * Step 2: For untagged coding questions, uses LLM (batched, rate-limited, resumable).
 *
 * Usage:
 *   node backend/scripts/tagPatterns.js [--dry-run] [--batch=50] [--limit=100] [--force]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const QuestionBank = require('../models/QuestionBank');
const { DSA_PATTERNS } = require('../config/patterns');
const llm = require('../services/llm');

const argv = process.argv.slice(2);
const opts = {
  dryRun: argv.includes('--dry-run'),
  force: argv.includes('--force'),
  batch: 50,
  limit: null
};

for (const arg of argv) {
  if (arg.startsWith('--batch=')) opts.batch = parseInt(arg.split('=')[1], 10) || opts.batch;
  if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1], 10) || opts.limit;
}

// Deterministic topic/tag/keyword mapping
const KEYWORD_MAP = {
  'two-pointers': ['two pointer', 'two-pointer', '2 pointer', 'two pointers', 'opposite direction', 'same direction'],
  'sliding-window': ['sliding window', 'window size', 'subarray with sum', 'longest substring'],
  'fast-slow-pointers': ['fast and slow', 'tortoise and hare', 'cycle detection', 'floyd cycle'],
  'binary-search': ['binary search', 'bisect', 'search in rotated', 'lower_bound', 'upper_bound'],
  'prefix-sum': ['prefix sum', 'cumulative sum', 'range sum query'],
  'hashing': ['hash table', 'hashmap', 'hash map', 'hash set', 'hashset', 'dictionary'],
  'stack/monotonic-stack': ['stack', 'monotonic stack', 'next greater element', 'balanced parentheses', 'parentheses'],
  'linked-list': ['linked list', 'singly linked', 'doubly linked', 'reverse linked list', 'merge k sorted lists'],
  'tree-dfs': ['tree dfs', 'binary tree', 'inorder', 'preorder', 'postorder', 'depth first', 'tree height', 'max depth of binary tree'],
  'tree-bfs': ['tree bfs', 'level order', 'breadth first', 'zigzag level'],
  'graph-bfs/dfs': ['graph', 'dfs', 'bfs', 'connected components', 'dijkstra', 'shortest path', 'bipartite', 'cycle in graph'],
  'topological-sort': ['topological sort', 'course schedule', 'dependency resolution', 'kahn algorithm'],
  'union-find': ['union find', 'disjoint set', 'connected components', 'kruskal'],
  'heap/top-k': ['heap', 'priority queue', 'top k', 'kth largest', 'kth smallest', 'median from data stream'],
  'intervals': ['intervals', 'merge intervals', 'insert interval', 'meeting rooms', 'overlapping intervals'],
  'backtracking': ['backtracking', 'permutations', 'subsets', 'n-queens', 'combination sum', 'sudoku'],
  'dp-1d': ['dynamic programming 1d', '1d dp', 'fibonacci', 'climbing stairs', 'house robber', 'coin change'],
  'dp-2d': ['dynamic programming 2d', '2d dp', 'grid dp', 'longest common subsequence', 'knapsack', 'edit distance'],
  'greedy': ['greedy', 'jump game', 'gas station', 'interval scheduling'],
  'trie': ['trie', 'prefix tree', 'word search ii', 'autocomplete'],
  'bit-manipulation': ['bit manipulation', 'bitwise', 'xor', 'single number', 'hamming distance']
};

function detectPatternsFromText(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  const matched = new Set();

  for (const [pattern, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        matched.add(pattern);
        break;
      }
    }
  }

  return [...matched];
}

async function tagWithLLM(question) {
  const prompt = [
    {
      role: 'system',
      content: `You are an algorithms expert. Classify the following coding question into 1 to 3 patterns from this canonical list:
${DSA_PATTERNS.join(', ')}

Respond ONLY with a JSON object: {"patterns": ["<pattern1>", "<pattern2>"]}`
    },
    {
      role: 'user',
      content: `Title: ${question.title || ''}\nTopic: ${question.topic || ''}\nQuestion: ${question.questionText || ''}`
    }
  ];

  try {
    const res = await llm.generate({
      task: 'fast',
      messages: prompt,
      json: true,
      safeDefault: { patterns: [] }
    });

    if (Array.isArray(res?.patterns)) {
      return res.patterns.filter(p => DSA_PATTERNS.includes(p));
    }
  } catch (err) {
    console.warn(`LLM tagging error for ${question.questionId}:`, err.message);
  }
  return [];
}

async function main() {
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('MONGODB_URI not set. Exiting.');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  const query = opts.force ? {} : { $or: [{ patterns: { $exists: false } }, { patterns: { $size: 0 } }] };
  const total = await QuestionBank.countDocuments(query);
  console.log(`Questions to tag: ${total} (dryRun=${opts.dryRun}, force=${opts.force})`);

  let processed = 0;
  let taggedCount = 0;
  let ruleCount = 0;
  let llmCount = 0;
  const patternFreq = {};

  const cursor = QuestionBank.find(query).cursor();

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (opts.limit && processed >= opts.limit) break;
    processed++;

    // 1. Keyword rule-based tagging
    const searchString = `${doc.title || ''} ${doc.topic || ''} ${(doc.tags || []).join(' ')} ${doc.questionText || ''}`;
    let patterns = detectPatternsFromText(searchString);

    if (patterns.length > 0) {
      ruleCount++;
    } else if (doc.isCodingProblem) {
      // 2. LLM fallback for untagged coding problems
      patterns = await tagWithLLM(doc);
      if (patterns.length > 0) llmCount++;
      // Sleep slightly to be polite with rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    if (patterns.length > 0) {
      taggedCount++;
      patterns.forEach(p => {
        patternFreq[p] = (patternFreq[p] || 0) + 1;
      });

      if (!opts.dryRun) {
        await QuestionBank.updateOne(
          { _id: doc._id },
          { $set: { patterns } }
        );
      }
    }

    if (processed % opts.batch === 0) {
      console.log(`Processed ${processed}/${total} (Tagged: ${taggedCount})`);
    }
  }

  console.log('\n================ Pattern Tagging Report ================');
  console.log(`Total questions scanned: ${processed}`);
  console.log(`Total questions tagged:  ${taggedCount} (Rule: ${ruleCount}, LLM: ${llmCount})`);
  console.log('Pattern Frequency Breakdown:');
  for (const [p, count] of Object.entries(patternFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${p.padEnd(25)}: ${count}`);
  }
  console.log('========================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error in tagPatterns:', err);
    process.exit(1);
  });
}

module.exports = { detectPatternsFromText };

