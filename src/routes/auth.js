const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  validateSendVerificationCode,
  validateSignin,
  validateUpdateProfile 
} = require('../middleware/validation');

// Send verification code to email
router.post('/send-verification-code', 
  validateSendVerificationCode,
  authController.sendVerificationCode
);

// Verify code and auto login/signup
router.post('/verify-code', 
  validateSignin, 
  authController.verifyCode
);

// GitHub OAuth initiation 
router.get('/github', 
  authenticateToken,
  authController.githubAuth
);

// GitHub OAuth callback
router.get('/github/callback', 
  authController.githubCallback
);

// Get user profile 
router.get('/profile', 
  authenticateToken,
  authController.getProfile
);

// Update user profile )
router.put('/profile', 
  authenticateToken,
  validateUpdateProfile,
  authController.updateProfile
);

// Refresh JWT token 
router.post('/refresh-token', 
  authenticateToken,
  authController.refreshToken
);

// Logout
router.post('/logout', 
  optionalAuth,
  (req, res) => {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
);

module.exports = router;