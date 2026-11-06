require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const cors = require('cors');

// Connect Database
connectDB();

const app = express();

// --- Security: Helmet (sets safe HTTP headers) ---
app.use(helmet());

// --- CORS ---
// Reads CORS_ORIGINS env var (comma-separated); falls back to hardcoded list.
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [
      'https://frontend-m16o-b6nlfutww-arshans-projects-6f672697.vercel.app',
      'https://frontend-m16o.vercel.app',
      'http://localhost:3000',
    ];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// --- Rate limiting ---
// General limiter for all routes
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Stricter limiter for AI-calling routes
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait before submitting another answer.' },
});

app.use(generalLimiter);

// --- Body parsing: 2 MB max (audio/video no longer sent as base64) ---
app.use(express.json({ extended: false, limit: '2mb' }));

// --- Timeout middleware ---
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

app.use((req, res, next) => {
  req.on('timeout', () => {
    console.error('Request timeout for:', req.url);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

app.get('/', (req, res) => res.send('API Running'));

// Define Routes — apply AI limiter to interview routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/interviews', aiLimiter, require('./routes/api/interviews'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

// Set server timeout
server.timeout = 120000; // 120 seconds

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
