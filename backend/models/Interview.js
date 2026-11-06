const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    default: null
  },
  questionText: {
    type: String,
    required: true
  },
  answerText: {
    type: String,
    default: null
  },
  feedback: {
    type: String,
    default: null
  },
  score: {
    type: Number,
    default: null
  },
  codeAnswer: {
    type: String,
    default: null
  },
  programmingLanguage: {
    type: String,
    default: null
  },
  codeFeedback: {
    type: String,
    default: null
  },
  codeScore: {
    type: Number,
    default: null
  },
  audioAnswer: {
    type: String,
    default: null
  },
  wpm: {
    type: Number,
    default: null
  },
  fillerWordsCount: {
    type: Number,
    default: null
  },
  topic: {
    type: String,
    default: null
  },
  // Phase 1 additions — copied from QuestionBank at question-selection time
  isCodingProblem: {
    type: Boolean,
    default: false
  },
  normalizedTitle: {
    type: String,
    default: null
  },
  // improvements array stored from structured LLM output
  improvements: {
    type: [String],
    default: []
  },
  // Phase 2 addition: DSA pattern tags associated with this question
  patterns: {
    type: [String],
    default: []
  }
});

const TurnSchema = new mongoose.Schema({
  speaker: {
    type: String,
    enum: ['ai', 'candidate'],
    required: true
  },
  type: {
    type: String,
    enum: ['question', 'followup', 'hint', 'answer', 'system'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  questionRef: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  metrics: {
    wpm: { type: Number, default: null },
    fillerWordsCount: { type: Number, default: null },
    responseMs: { type: Number, default: null }
  }
}, { _id: false });

const ReportSchema = new mongoose.Schema({
  overallScore: { type: Number, default: null },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  perQuestionBreakdown: [{
    questionText: String,
    candidateAnswer: { type: String, default: null },
    topic: String,
    score: Number,
    feedback: String,
    signals: {
      clarity: Number,
      depth: Number,
      correctness: Number
    }
  }],
  communicationSummary: {
    averageWpm: Number,
    totalFillerWords: Number,
    paceAssessment: String,
    notes: String
  },
  patternPerformance: [{
    pattern: String,
    score: Number,
    notes: String
  }],
  nextPracticeRecommendations: { type: [String], default: [] },
  generatedAt: { type: Date, default: Date.now }
}, { _id: false });

const InterviewConfigSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ['hr', 'dsa', 'mixed'],
    default: 'mixed'
  },
  patterns: {
    type: [String],
    default: []
  },
  difficulty: {
    type: String,
    enum: ['adaptive', 'easy', 'medium', 'hard'],
    default: 'adaptive'
  },
  durationMin: {
    type: Number,
    default: 30
  },
  maxQuestions: {
    type: Number,
    default: 5
  },
  voice: {
    type: Boolean,
    default: false
  },
  company: {
    type: String,
    default: null
  },
  resumeMode: {
    type: String,
    enum: ['none', 'mix', 'pure'],
    default: 'none'
  },
  resumeText: {
    type: String,
    default: null
  }
}, { _id: false });

const InterviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: {
      validator: function(v) {
        return mongoose.Types.ObjectId.isValid(v);
      },
      message: props => `${props.value} is not a valid ObjectId!`
    }
  },
  role: {
    type: String,
    required: true,
    enum: ['software-engineer', 'frontend-developer', 'backend-developer', 'data-scientist', 'product-manager', 'devops-engineer']
  },
  programmingLanguage: {
    type: String,
    required: function() {
      return ['software-engineer', 'frontend-developer', 'backend-developer', 'data-scientist', 'devops-engineer'].includes(this.role);
    }
  },
  // Phase 2 session configuration & lifecycle
  config: {
    type: InterviewConfigSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['active', 'completing', 'completed'],
    default: 'active',
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  },
  turns: [TurnSchema],
  questions: [QuestionSchema],
  date: {
    type: Date,
    default: Date.now
  },
  overallFeedback: {
    type: String,
    default: null
  },
  overallScore: {
    type: Number,
    default: null
  },
  // Phase 3 comprehensive report & dynamic difficulty tracking
  report: {
    type: ReportSchema,
    default: null
  },
  runningDifficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  performanceStreak: {
    type: Number,
    default: 0
  }
});

// Add pre-save middleware to validate user reference
InterviewSchema.pre('save', function(next) {
  if (!mongoose.Types.ObjectId.isValid(this.user)) {
    next(new Error('Invalid user reference'));
  }
  next();
});

module.exports = mongoose.model('Interview', InterviewSchema);
