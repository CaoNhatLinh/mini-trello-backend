const jwt = require('jsonwebtoken');
const { auth } = require('../config/firebase');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        firebase: true
      };
      return next();
    } catch (firebaseError) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
          uid: decoded.uid,
          email: decoded.email,
          emailVerified: decoded.emailVerified || false,
          firebase: false
        };
        return next();
      } catch (jwtError) {
        throw new Error('Invalid token');
      }
    }
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please refresh your authentication token'
      });
    }
    
    res.status(403).json({ 
      error: 'Invalid token',
      message: 'The provided token is invalid or malformed'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          emailVerified: decodedToken.email_verified,
          firebase: true
        };
      } catch (firebaseError) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = {
            uid: decoded.uid,
            email: decoded.email,
            emailVerified: decoded.emailVerified || false,
            firebase: false
          };
        } catch (jwtError) {
          
        }
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticateToken, optionalAuth };