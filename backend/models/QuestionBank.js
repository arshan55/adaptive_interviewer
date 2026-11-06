const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const QuestionBankSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => randomUUID()
  },
  company: {
    type: String,
    trim: true,
    index: true,
    default: null
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  tags: {
    type: [String],
    default: []
  },
  // Canonical DSA pattern tags (e.g. 'two-pointers', 'sliding-window')
  patterns: {
    type: [String],
    default: [],
    index: true
  },
  role: {
    type: String,
    required: true,
    enum: [
      'software-engineer',
      'frontend-developer',
      'backend-developer',
      'data-scientist',
      'product-manager',
      'devops-engineer'
    ]
  },
  isCodingProblem: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  frequency: {
    type: Number,
    default: 0
  },
  acceptanceRate: {
    type: Number,
    default: null
  },
  normalizedTitle: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  // Lightweight RAG fields
  embedding: {
    type: [Number],
    default: null
  },
  // Phase 1: track which embedding model generated this vector.
  // If the active model differs from stored embeddingModel, skip RAG for this doc.
  embeddingModel: {
    type: String,
    default: null
  },
  // Optional local overrides / fallbacks; primary coding references live in CodingProblemDetails
  modelAnswer: {
    type: String,
    trim: true,
    default: null
  },
  rubricNotes: {
    type: [String],
    default: []
  },
  sourceSystem: {
    type: String,
    trim: true,
    default: 'leetcode-company-wise'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastAskedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

QuestionBankSchema.index({ role: 1, difficulty: 1, company: 1, normalizedTitle: 1 });
QuestionBankSchema.index({ role: 1, difficulty: 1, company: 1, frequency: -1 });

module.exports = mongoose.model('QuestionBank', QuestionBankSchema);
