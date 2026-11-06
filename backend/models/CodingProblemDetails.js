const mongoose = require('mongoose');

const TestCaseSchema = new mongoose.Schema({
  input: {
    type: String,
    required: true,
    trim: true
  },
  expectedOutput: {
    type: String,
    required: true,
    trim: true
  },
  stdin: {
    type: String,
    default: null,
    trim: true
  },
  notes: {
    type: String,
    default: null,
    trim: true
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const CodingProblemDetailsSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  problemStatement: {
    type: String,
    required: true,
    trim: true
  },
  inputFormat: {
    type: String,
    default: null,
    trim: true
  },
  outputFormat: {
    type: String,
    default: null,
    trim: true
  },
  constraints: {
    type: [String],
    default: []
  },
  publicTestCases: {
    type: [TestCaseSchema],
    default: []
  },
  hiddenTestCases: {
    type: [TestCaseSchema],
    default: []
  },
  // Phase 4: Standardized unified test cases
  testCases: [
    {
      input: { type: String, required: true, trim: true },
      expected: { type: String, required: true, trim: true },
      hidden: { type: Boolean, default: false }
    }
  ],
  // Function signature per language (e.g. { javascript: "function ...", python: "def ..." })
  functionSignature: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  entryFunctionName: {
    type: String,
    default: null,
    trim: true
  },
  referenceSolution: {
    type: String,
    default: null,
    trim: true
  },
  rubric: {
    type: [String],
    default: []
  },
  languageHints: {
    type: [String],
    default: []
  },
  source: {
    type: String,
    default: 'hand-curated',
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CodingProblemDetails', CodingProblemDetailsSchema);