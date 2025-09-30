const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Initialize Firebase Admin
require('./config/firebase');

// Import routes
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const githubRoutes = require('./routes/github');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import enhanced cache middleware
const { cacheManager } = require('./middleware/cache');

// Apply cache to specific routes that are frequently accessed
app.use('/api/boards/:id/members', cacheManager.middleware());
app.use('/api/boards/:boardId/cards', cacheManager.middleware());

// Add cache status endpoint for debugging
app.get('/api/cache/stats', (req, res) => {
  res.json({
    status: 'Cache statistics',
    ...cacheManager.getStats(),
    timestamp: new Date().toISOString()
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000), // Much higher limit for development
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 20, 
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Mini Trello API Server',
    version: '1.0.0',
    status: 'Running',
    documentation: '/api/docs',
    health: '/health'
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Mini Trello API Documentation',
    version: '1.0.0',
    baseUrl: req.protocol + '://' + req.get('host') + '/api',
    endpoints: {
      authentication: {
        'POST /auth/send-verification-code': 'Send verification code to email',
        'POST /auth/signup': 'Sign up with email and verification code',
        'POST /auth/signin': 'Sign in with email and verification code',
        'GET /auth/github': 'Initiate GitHub OAuth',
        'GET /auth/github/callback': 'GitHub OAuth callback',
        'GET /auth/profile': 'Get user profile',
        'PUT /auth/profile': 'Update user profile',
        'POST /auth/refresh-token': 'Refresh JWT token',
        'POST /auth/logout': 'Logout user'
      },
      boards: {
        'POST /boards': 'Create new board',
        'GET /boards': 'Get user boards',
        'GET /boards/:id': 'Get board by ID',
        'PUT /boards/:id': 'Update board',
        'DELETE /boards/:id': 'Delete board',
        'POST /boards/:boardId/invite': 'Invite member to board',
        'POST /boards/invitation/respond': 'Respond to invitation',
        'GET /boards/:id/members': 'Get board members',
        'DELETE /boards/:id/members/:memberId': 'Remove board member'
      },
      cards: {
        'POST /cards/board/:boardId': 'Create card in board',
        'GET /cards/board/:boardId': 'Get board cards',
        'GET /boards/:boardId/cards/:id': 'Get card by ID',
        'PUT /boards/:boardId/cards/:id': 'Update card',
        'DELETE /boards/:boardId/cards/:id': 'Delete card',
        'PATCH /cards/:id/move': 'Move card position',
        'POST /cards/:id/assign': 'Assign members to card',
        'POST /cards/:id/comments': 'Add comment to card',
        'GET /cards/:id/comments': 'Get card comments',
        'POST /cards/:id/attachments': 'Add attachment to card',
        'GET /cards/:id/attachments': 'Get card attachments'
      },
      tasks: {
        'POST /tasks/card/:cardId': 'Create task in card',
        'GET /tasks/card/:cardId': 'Get card tasks',
        'GET /tasks/:id': 'Get task by ID',
        'PUT /tasks/:id': 'Update task',
        'DELETE /tasks/:id': 'Delete task',
        'PATCH /tasks/:id/toggle': 'Toggle task completion',
        'POST /tasks/:id/assign': 'Assign task to members',
        'POST /tasks/:id/comments': 'Add comment to task',
        'GET /tasks/:id/comments': 'Get task comments',
        'POST /tasks/:id/github-attachments': 'Attach GitHub item to task',
        'GET /tasks/:id/github-attachments': 'Get task GitHub attachments'
      },
      github: {
        'GET /github/status': 'Get GitHub connection status',
        'DELETE /github/disconnect': 'Disconnect GitHub account',
        'GET /github/repositories': 'Get user repositories',
        'GET /github/repositories/search': 'Search repositories',
        'GET /github/repositories/:owner/:repo': 'Get repository info',
        'GET /github/repositories/:owner/:repo/github-info': 'Get repository GitHub info',
        'GET /github/repositories/:owner/:repo/branches': 'Get repository branches',
        'GET /github/repositories/:owner/:repo/issues': 'Get repository issues',
        'GET /github/repositories/:owner/:repo/issues/:issue_number': 'Get issue details',
        'GET /github/repositories/:owner/:repo/pulls': 'Get repository pull requests',
        'GET /github/repositories/:owner/:repo/pulls/:pull_number': 'Get pull request details',
        'GET /github/repositories/:owner/:repo/commits': 'Get repository commits',
        'GET /github/repositories/:owner/:repo/commits/:sha': 'Get commit details'
      }
    },
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <token>',
      note: 'Most endpoints require authentication. Use /auth/signin or /auth/signup to get a token.'
    }
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.method} ${req.originalUrl} does not exist`,
    availableRoutes: {
      'GET /': 'Root endpoint',
      'GET /health': 'Health check',
      'GET /api/docs': 'API documentation',
      'POST /api/auth/*': 'Authentication endpoints',
      'GET|POST|PUT|DELETE /api/boards/*': 'Board management endpoints',
      'GET|POST|PUT|DELETE /api/cards/*': 'Card management endpoints',
      'GET|POST|PUT|DELETE /api/tasks/*': 'Task management endpoints',
      'GET /api/github/*': 'GitHub integration endpoints'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  if (err.code && err.code.startsWith('auth/')) {
    return res.status(401).json({
      error: 'Authentication error',
      message: err.message || 'Invalid or expired token'
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Please provide a valid authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Please refresh your token or sign in again'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this information already exists'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request too large',
      message: 'The request payload is too large'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong' 
    : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: 'Server error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  } 
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server only if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  const HOST = process.env.HOST || 'localhost';
  
  const { createServer } = require('http');
  const { initSocket } = require('./socket/socketServer');
  
  const server = createServer(app);
  
  initSocket(server);
  
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Mini Trello API Server is running!`);
    console.log(`📍 Server: http://${HOST}:${PORT}`);
    console.log(`📖 API Docs: http://${HOST}:${PORT}/api/docs`);
    console.log(`❤️  Health Check: http://${HOST}:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`🔌 Socket.IO Server initialized`);
    console.log('='.repeat(60));
  });
}

module.exports = app;