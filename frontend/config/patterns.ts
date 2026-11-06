/**
 * Canonical DSA Pattern List & UI Labels for Frontend
 */

export const DSA_PATTERNS = [
  'two-pointers',
  'sliding-window',
  'fast-slow-pointers',
  'binary-search',
  'prefix-sum',
  'hashing',
  'stack/monotonic-stack',
  'linked-list',
  'tree-dfs',
  'tree-bfs',
  'graph-bfs/dfs',
  'topological-sort',
  'union-find',
  'heap/top-k',
  'intervals',
  'backtracking',
  'dp-1d',
  'dp-2d',
  'greedy',
  'trie',
  'bit-manipulation'
] as const;

export type DsaPattern = typeof DSA_PATTERNS[number];

export const PATTERN_LABELS: Record<string, string> = {
  'two-pointers': 'Two Pointers',
  'sliding-window': 'Sliding Window',
  'fast-slow-pointers': 'Fast & Slow Pointers',
  'binary-search': 'Binary Search',
  'prefix-sum': 'Prefix Sum',
  'hashing': 'Hashing',
  'stack/monotonic-stack': 'Monotonic Stack',
  'linked-list': 'Linked List',
  'tree-dfs': 'Tree DFS',
  'tree-bfs': 'Tree BFS',
  'graph-bfs/dfs': 'Graph BFS / DFS',
  'topological-sort': 'Topological Sort',
  'union-find': 'Union Find',
  'heap/top-k': 'Heap / Top K',
  'intervals': 'Intervals',
  'backtracking': 'Backtracking',
  'dp-1d': 'DP (1D)',
  'dp-2d': 'DP (2D / Grid)',
  'greedy': 'Greedy',
  'trie': 'Trie',
  'bit-manipulation': 'Bit Manipulation'
};

