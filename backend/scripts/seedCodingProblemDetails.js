/**
 * Seed a small curated set of CodingProblemDetails documents.
 *
 * These are original problem statements and original test cases keyed to
 * imported QuestionBank rows by normalized title/company.
 */
const mongoose = require('mongoose');
const QuestionBank = require('../models/QuestionBank');
const CodingProblemDetails = require('../models/CodingProblemDetails');
const { loadOptionalDotenv, normalizeText } = require('./importHelpers');

loadOptionalDotenv(require('path').resolve(__dirname, '..', '.env'));

const parseArgs = (argv) => {
  const args = { dryRun: false, help: false };

  for (const value of argv) {
    if (value === '--dry-run') {
      args.dryRun = true;
    }
    if (value === '--help' || value === '-h') {
      args.help = true;
    }
  }

  return args;
};

const curatedProblems = [
  {
    company: 'AMD',
    title: 'Two Sum',
    entryFunctionName: 'twoSum',
    functionSignature: {
      javascript: 'function twoSum(nums, target)',
      python: 'def twoSum(nums, target):',
      cpp: 'vector<int> twoSum(vector<int>& nums, int target)',
      java: 'public int[] twoSum(int[] nums, int target)',
    },
    problemStatement:
      'Given an array of integers and a target value, return the indices of two distinct elements whose values add up to the target.',
    inputFormat: 'Array of integers nums and integer target.',
    outputFormat: 'Return a pair of indices as an array.',
    constraints: [
      'Exactly one valid pair exists.',
      'Do not reuse the same element twice.',
    ],
    testCases: [
      { input: '[[2, 7, 11, 15], 9]', expected: '[0, 1]', hidden: false },
      { input: '[[3, 2, 4], 6]', expected: '[1, 2]', hidden: false },
      { input: '[[3, 3], 6]', expected: '[0, 1]', hidden: false },
      { input: '[[1, 5, 1, 5], 10]', expected: '[1, 3]', hidden: true },
      { input: '[[0, 4, 3, 0], 0]', expected: '[0, 3]', hidden: true },
      { input: '[[-1, -2, -3, -4, -5], -8]', expected: '[2, 4]', hidden: true },
    ],
    publicTestCases: [
      { input: 'nums = [2, 7, 11, 15], target = 9', expectedOutput: '[0, 1]' },
      { input: 'nums = [3, 2, 4], target = 6', expectedOutput: '[1, 2]' },
      { input: 'nums = [3, 3], target = 6', expectedOutput: '[0, 1]' },
    ],
    hiddenTestCases: [
      { input: 'nums = [1, 5, 1, 5], target = 10', expectedOutput: '[1, 3]', isHidden: true },
      { input: 'nums = [0, 4, 3, 0], target = 0', expectedOutput: '[0, 3]', isHidden: true },
      { input: 'nums = [-1, -2, -3, -4, -5], target = -8', expectedOutput: '[2, 4]', isHidden: true },
    ],
    referenceSolution:
      'Use a hash map from value to index. For each number, check whether target - current already exists.',
    rubric: [
      'Correctly identifies a pair.',
      'Avoids using the same index twice.',
      'Uses linear-time lookup strategy.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
  },
  {
    company: 'AMD',
    title: 'Climbing Stairs',
    entryFunctionName: 'climbStairs',
    functionSignature: {
      javascript: 'function climbStairs(n)',
      python: 'def climbStairs(n):',
      cpp: 'int climbStairs(int n)',
      java: 'public int climbStairs(int n)',
    },
    problemStatement:
      'Count how many distinct ways you can reach the top of a staircase if each move can advance either one step or two steps.',
    inputFormat: 'Single integer n representing the number of steps.',
    outputFormat: 'Return the total number of ways to reach step n.',
    constraints: ['n is at least 1.', 'Solutions should be efficient for large n.'],
    testCases: [
      { input: '[2]', expected: '2', hidden: false },
      { input: '[3]', expected: '3', hidden: false },
      { input: '[4]', expected: '5', hidden: false },
      { input: '[5]', expected: '8', hidden: true },
      { input: '[8]', expected: '34', hidden: true },
      { input: '[10]', expected: '89', hidden: true },
    ],
    publicTestCases: [
      { input: 'n = 2', expectedOutput: '2' },
      { input: 'n = 3', expectedOutput: '3' },
      { input: 'n = 4', expectedOutput: '5' },
    ],
    hiddenTestCases: [
      { input: 'n = 5', expectedOutput: '8', isHidden: true },
      { input: 'n = 8', expectedOutput: '34', isHidden: true },
      { input: 'n = 10', expectedOutput: '89', isHidden: true },
    ],
    referenceSolution:
      'Build the answer iteratively using the previous two counts, which is equivalent to a Fibonacci-style recurrence.',
    rubric: [
      'Handles base cases.',
      'Uses dynamic programming or iterative recurrence.',
      'Runs in linear time and constant space.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
  },
  {
    company: 'AMD',
    title: 'Valid Parentheses',
    entryFunctionName: 'isValid',
    functionSignature: {
      javascript: 'function isValid(s)',
      python: 'def isValid(s):',
      cpp: 'bool isValid(string s)',
      java: 'public boolean isValid(String s)',
    },
    problemStatement:
      'Given a string containing bracket characters, determine whether the string is balanced and properly nested.',
    inputFormat: 'A string containing only bracket characters.',
    outputFormat: 'Return true if the string is balanced, otherwise false.',
    constraints: ['Only the characters (), {}, and [] appear.'],
    testCases: [
      { input: '["()[]{}"]', expected: 'true', hidden: false },
      { input: '["(]"]', expected: 'false', hidden: false },
      { input: '["([{}])"]', expected: 'true', hidden: false },
      { input: '["((())"]', expected: 'false', hidden: true },
      { input: '["["]', expected: 'false', hidden: true },
      { input: '[""]', expected: 'true', hidden: true },
    ],
    publicTestCases: [
      { input: 's = "()[]{}"', expectedOutput: 'true' },
      { input: 's = "(]"', expectedOutput: 'false' },
      { input: 's = "([{}])"', expectedOutput: 'true' },
    ],
    hiddenTestCases: [
      { input: 's = "((())"', expectedOutput: 'false', isHidden: true },
      { input: 's = "["', expectedOutput: 'false', isHidden: true },
      { input: 's = ""', expectedOutput: 'true', isHidden: true },
    ],
    referenceSolution:
      'Use a stack to push opening brackets and verify each closing bracket matches the latest opener.',
    rubric: [
      'Handles nested and interleaved brackets.',
      'Rejects premature or unmatched closing brackets.',
      'Uses a stack-based approach.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
  },
  {
    company: 'AMD',
    title: 'Longest Substring Without Repeating Characters',
    entryFunctionName: 'lengthOfLongestSubstring',
    functionSignature: {
      javascript: 'function lengthOfLongestSubstring(s)',
      python: 'def lengthOfLongestSubstring(s):',
      cpp: 'int lengthOfLongestSubstring(string s)',
      java: 'public int lengthOfLongestSubstring(String s)',
    },
    problemStatement:
      'Find the length of the longest contiguous substring that contains no repeated characters.',
    inputFormat: 'A single string s.',
    outputFormat: 'Return the maximum substring length as an integer.',
    constraints: ['The input may contain mixed letters, digits, and symbols.'],
    testCases: [
      { input: '["abcabcbb"]', expected: '3', hidden: false },
      { input: '["bbbbb"]', expected: '1', hidden: false },
      { input: '["pwwkew"]', expected: '3', hidden: false },
      { input: '[""]', expected: '0', hidden: true },
      { input: '["dvdf"]', expected: '3', hidden: true },
      { input: '["anviaj"]', expected: '5', hidden: true },
    ],
    publicTestCases: [
      { input: 's = "abcabcbb"', expectedOutput: '3' },
      { input: 's = "bbbbb"', expectedOutput: '1' },
      { input: 's = "pwwkew"', expectedOutput: '3' },
    ],
    hiddenTestCases: [
      { input: 's = ""', expectedOutput: '0', isHidden: true },
      { input: 's = "dvdf"', expectedOutput: '3', isHidden: true },
      { input: 's = "anviaj"', expectedOutput: '5', isHidden: true },
    ],
    referenceSolution:
      'Use a sliding window and remember the last seen position of each character.',
    rubric: [
      'Maintains a moving window without duplicates.',
      'Updates the left boundary correctly.',
      'Runs in linear time.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
  },
  {
    company: 'AMD',
    title: 'Binary Search',
    entryFunctionName: 'search',
    functionSignature: {
      javascript: 'function search(nums, target)',
      python: 'def search(nums, target):',
      cpp: 'int search(vector<int>& nums, int target)',
      java: 'public int search(int[] nums, int target)',
    },
    problemStatement:
      'Search for a target value inside a sorted array and return its index, or -1 if the target is absent.',
    inputFormat: 'Sorted integer array nums and integer target.',
    outputFormat: 'Return an index or -1.',
    constraints: ['The array is sorted in ascending order.'],
    testCases: [
      { input: '[[-1, 0, 3, 5, 9, 12], 9]', expected: '4', hidden: false },
      { input: '[[-1, 0, 3, 5, 9, 12], 2]', expected: '-1', hidden: false },
      { input: '[[5], 5]', expected: '0', hidden: false },
      { input: '[[5], -5]', expected: '-1', hidden: true },
      { input: '[[1, 3, 5, 7, 9], 1]', expected: '0', hidden: true },
      { input: '[[1, 3, 5, 7, 9], 9]', expected: '4', hidden: true },
    ],
    publicTestCases: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', expectedOutput: '4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', expectedOutput: '-1' },
      { input: 'nums = [5], target = 5', expectedOutput: '0' },
    ],
    hiddenTestCases: [
      { input: 'nums = [5], target = -5', expectedOutput: '-1', isHidden: true },
      { input: 'nums = [1,3,5,7,9], target = 1', expectedOutput: '0', isHidden: true },
      { input: 'nums = [1,3,5,7,9], target = 9', expectedOutput: '4', isHidden: true },
    ],
    referenceSolution:
      'Perform binary search with two pointers that shrink toward the target.',
    rubric: [
      'Uses logarithmic-time search.',
      'Handles empty or single-element arrays.',
      'Returns -1 when missing.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
  },
  {
    company: 'LinkedIn',
    title: 'LRU Cache',
    problemStatement:
      'Implement a cache with a fixed capacity that evicts the least recently used entry whenever the cache is full.',
    inputFormat: 'Capacity plus a sequence of get and put operations.',
    outputFormat: 'Return values for get operations and maintain cache state.',
    constraints: ['Both get and put should be efficient.', 'Eviction must be based on recency of use.'],
    publicTestCases: [
      {
        input: 'capacity = 2; put(1,1); put(2,2); get(1); put(3,3); get(2)',
        expectedOutput: '[1, -1]',
      },
      {
        input: 'capacity = 2; put(2,1); put(2,2); get(2)',
        expectedOutput: '[2]',
      },
    ],
    hiddenTestCases: [
      {
        input: 'capacity = 1; put(1,1); put(2,2); get(1); get(2)',
        expectedOutput: '[-1, 2]',
        isHidden: true,
      },
    ],
    referenceSolution:
      'Combine a hash map for O(1) lookup with a doubly linked list to track recency.',
    rubric: [
      'Correct eviction behavior.',
      'O(1) access and update operations.',
      'Updates recency on reads and writes.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java'],
  },
  {
    company: 'LinkedIn',
    title: 'Implement Array.prototype.filter',
    problemStatement:
      'Write a custom array filtering helper that returns a new array containing only the values that satisfy a predicate.',
    inputFormat: 'An array, a callback function, and an optional thisArg.',
    outputFormat: 'Return a new array of matching values.',
    constraints: ['Do not mutate the original array.', 'Support callback execution on each index.'],
    publicTestCases: [
      {
        input: '[1,2,3,4], value => value % 2 === 0',
        expectedOutput: '[2,4]',
      },
      {
        input: '["a","ab","abc"], value => value.length >= 2',
        expectedOutput: '["ab","abc"]',
      },
    ],
    hiddenTestCases: [
      { input: '[], () => true', expectedOutput: '[]', isHidden: true },
      { input: '[0,1], value => value', expectedOutput: '[1]', isHidden: true },
    ],
    referenceSolution:
      'Iterate over the array, call the predicate for each element, and collect values that pass.',
    rubric: [
      'Does not mutate the source array.',
      'Calls the predicate correctly.',
      'Returns the expected filtered array.',
    ],
    languageHints: ['JavaScript', 'TypeScript'],
  },
  {
    company: 'LinkedIn',
    title: 'Debounce Function',
    problemStatement:
      'Create a helper that delays invoking a function until the calls stop for a specified time window, with optional leading and trailing behavior.',
    inputFormat: 'A function, a wait time, and options controlling leading and trailing invocation.',
    outputFormat: 'Return a debounced wrapper function.',
    constraints: ['Must preserve the last arguments.', 'Should support both leading and trailing modes.'],
    publicTestCases: [
      {
        input: 'debounce(fn, 100)',
        expectedOutput: 'Returns wrapper that delays invocation until inactivity.',
      },
      {
        input: 'debounce(fn, 100, { leading: true, trailing: false })',
        expectedOutput: 'Returns wrapper that fires on the first call in a burst.',
      },
    ],
    hiddenTestCases: [
      {
        input: 'debounce(fn, 50, { leading: false, trailing: true })',
        expectedOutput: 'Returns wrapper that fires after the quiet period.',
        isHidden: true,
      },
    ],
    referenceSolution:
      'Track the timeout handle, recent arguments, and whether the call should happen immediately or after the timer expires.',
    rubric: [
      'Handles timer reset correctly.',
      'Preserves context and arguments.',
      'Supports leading and trailing behavior.',
    ],
    languageHints: ['JavaScript', 'TypeScript'],
  },
  {
    company: 'LinkedIn',
    title: 'Implement Event Emitter',
    problemStatement:
      'Build a small event system with subscription, unsubscription, one-time listeners, and event emission.',
    inputFormat: 'Event names and listener functions.',
    outputFormat: 'The emitter should invoke the right listeners in order.',
    constraints: ['Listeners can be added multiple times.', 'One-time listeners should be removed after the first trigger.'],
    publicTestCases: [
      {
        input: 'on("ready", cb); emit("ready", 1)',
        expectedOutput: 'cb is invoked with 1',
      },
      {
        input: 'once("tick", cb); emit("tick"); emit("tick")',
        expectedOutput: 'cb is invoked exactly once',
      },
    ],
    hiddenTestCases: [
      {
        input: 'off("ready", cb); emit("ready")',
        expectedOutput: 'cb is not invoked',
        isHidden: true,
      },
    ],
    referenceSolution:
      'Store listeners in a map from event name to arrays of callbacks and wrap one-time callbacks so they remove themselves.',
    rubric: [
      'Correctly emits to listeners.',
      'Supports off and once.',
      'Handles empty events safely.',
    ],
    languageHints: ['JavaScript', 'TypeScript'],
  },
  {
    company: 'LinkedIn',
    title: 'Two Sum',
    problemStatement:
      'Given an integer array and a target, return the indices of two different elements that add to the target.',
    inputFormat: 'Array of integers nums and integer target.',
    outputFormat: 'Return a pair of indices.',
    constraints: ['A valid answer always exists.', 'Do not reuse the same index.'],
    publicTestCases: [
      { input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]' },
      { input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]' },
    ],
    hiddenTestCases: [
      { input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]', isHidden: true },
    ],
    referenceSolution:
      'Use a map from number to index and scan once through the array.',
    rubric: [
      'Returns correct indices.',
      'Uses an efficient lookup strategy.',
      'Handles duplicates safely.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java'],
  },
  {
    company: 'LinkedIn',
    title: 'Merge k Sorted Lists',
    problemStatement:
      'Merge multiple individually sorted linked lists into one sorted output list.',
    inputFormat: 'An array of sorted linked lists.',
    outputFormat: 'Return the head of a merged sorted linked list.',
    constraints: ['All lists are sorted.', 'The total number of nodes may be large.'],
    publicTestCases: [
      { input: '[[1,4,5],[1,3,4],[2,6]]', expectedOutput: '[1,1,2,3,4,4,5,6]' },
      { input: '[]', expectedOutput: '[]' },
    ],
    hiddenTestCases: [
      { input: '[[1],[0,2,3]]', expectedOutput: '[0,1,2,3]', isHidden: true },
    ],
    referenceSolution:
      'Use a min-heap or divide-and-conquer merging to repeatedly combine the smallest available node.',
    rubric: [
      'Produces sorted merged output.',
      'Handles empty input lists.',
      'Uses an efficient merging strategy.',
    ],
    languageHints: ['JavaScript', 'TypeScript', 'Python', 'Java'],
  },
  {
    company: 'LinkedIn',
    title: 'Bash Log Analyzer',
    problemStatement:
      'Write a shell-style data pipeline that counts how many times each IP address appears in an access log with HTTP 500 responses and prints the top five offenders.',
    inputFormat: 'A log file path containing access log lines.',
    outputFormat: 'Top five IP addresses and their counts in descending order.',
    constraints: ['Ignore non-500 responses.', 'Keep the output sorted by frequency.'],
    publicTestCases: [
      {
        input: 'log lines with repeated 500 entries from two IP addresses',
        expectedOutput: 'Top 5 IP addresses by count',
      },
    ],
    hiddenTestCases: [
      {
        input: 'log lines with mixed 200 and 500 responses',
        expectedOutput: 'Only 500-status IPs are counted',
        isHidden: true,
      },
    ],
    referenceSolution:
      'Filter 500-status lines, extract the IP field, aggregate counts, and sort by count descending.',
    rubric: [
      'Filters the right rows.',
      'Extracts the IP correctly.',
      'Sorts by descending frequency.',
    ],
    languageHints: ['Bash', 'Shell'],
  },
  {
    company: 'LinkedIn',
    title: 'Linux Process Management',
    problemStatement:
      'Given a sequence of shell commands or diagnostic observations, identify the process-management issue and explain the right debugging steps.',
    inputFormat: 'A prompt describing a process issue.',
    outputFormat: 'A concise diagnosis and action plan.',
    constraints: ['Focus on process-level debugging.', 'Explain SIGTERM vs SIGKILL.'],
    publicTestCases: [
      { input: 'Process using 100% CPU', expectedOutput: 'Use top/ps/strace and inspect the hot loop' },
    ],
    hiddenTestCases: [
      { input: 'Zombie process', expectedOutput: 'Parent must reap the child', isHidden: true },
    ],
    referenceSolution:
      'Explain how to inspect process state, identify the source of load, and terminate or restart safely.',
    rubric: [
      'Explains the right commands.',
      'Distinguishes signal behavior.',
      'Identifies the root cause clearly.',
    ],
    languageHints: ['Bash', 'Shell'],
  },
];

const findMatchingQuestion = async (problem) => {
  const question = await QuestionBank.findOne({
    normalizedTitle: normalizeText(problem.title),
    company: problem.company,
  }).lean();

  if (question) {
    return question;
  }

  return QuestionBank.findOne({
    normalizedTitle: normalizeText(problem.title),
  }).lean();
};

const run = async () => {
  const { dryRun, help } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log('Usage: node backend/scripts/seedCodingProblemDetails.js [--dry-run]');
    console.log('Seeds a curated set of original CodingProblemDetails documents.');
    return;
  }

  if (dryRun) {
    console.log('Dry run enabled. The script will preview matched questions and payloads without writing to MongoDB.');
  }

  const dbUri = process.env.MONGODB_URI;
  if (!dbUri && !dryRun) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  if (!dryRun) {
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB. Seeding coding problem details...');
  }

  let inserted = 0;
  let updated = 0;
  const skipped = [];

  for (const problem of curatedProblems) {
    const payload = {
      questionId: dryRun ? null : (await findMatchingQuestion(problem))?.questionId,
      problemStatement: problem.problemStatement,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      constraints: problem.constraints,
      publicTestCases: problem.publicTestCases,
      hiddenTestCases: problem.hiddenTestCases,
      testCases: problem.testCases || [],
      functionSignature: problem.functionSignature || {},
      entryFunctionName: problem.entryFunctionName || null,
      referenceSolution: problem.referenceSolution,
      rubric: problem.rubric,
      languageHints: problem.languageHints,
      source: 'curated-starter-set',
    };

    if (dryRun) {
      console.log(`Preview: ${problem.company} :: ${problem.title}`);
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }

    const question = await findMatchingQuestion(problem);

    if (!question) {
      skipped.push(`${problem.company} :: ${problem.title}`);
      continue;
    }

    payload.questionId = question.questionId;

    const result = await CodingProblemDetails.updateOne(
      { questionId: question.questionId },
      { $set: payload },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
    } else if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`Seed complete. Inserted: ${inserted}, Updated: ${updated}, Total curated: ${curatedProblems.length}`);
  if (skipped.length > 0) {
    console.log('Skipped because the matching QuestionBank row was not found:');
    skipped.forEach((item) => console.log(`- ${item}`));
  }

  if (!dryRun) {
    await mongoose.connection.close();
  }
};

run().catch((error) => {
  console.error('Coding problem seeding failed:', error);
  process.exit(1);
});