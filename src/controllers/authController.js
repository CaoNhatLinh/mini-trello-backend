const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GitHubService = require('../services/githubService');
const { generateVerificationCode, sendVerificationEmail } = require('../utils/emailService');

const authController = {
  async sendVerificationCode(req, res) {
    try {
      const { email } = req.body;

      const verificationCode = generateVerificationCode();

      await User.storeVerificationCode(email, verificationCode);

      // Send email
      await sendVerificationEmail(email, verificationCode);

      res.status(200).json({
        success: true,
        message: 'Verification code sent to your email',
        email
      });
    } catch (error) {
      console.error('Send verification code error:', error);
      res.status(500).json({
        error: 'Failed to send verification code',
        message: error.message
      });
    }
  },
  
  async verifyCode(req, res) {
    try {
      const { email, verificationCode } = req.body;

      const verification = await User.verifyCode(email, verificationCode);
      if (!verification.valid) {
        return res.status(400).json({
          error: 'Invalid verification code',
          message: verification.message
        });
      }

      let user = await User.findByEmail(email);
      let isNewUser = false;

      if (!user) {
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        user = await User.create(userId, {
          email,
          emailVerified: true,
          displayName: email.split('@')[0] 
        });
        isNewUser = true;
      }

      // Generate JWT token
      const token = generateJWTToken(user);

      res.status(200).json({
        success: true,
        message: isNewUser ? 'Account created and signed in successfully' : 'Signed in successfully',
        isNewUser,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          githubProfile: user.githubProfile
        },
        accessToken: token
      });
    } catch (error) {
      console.error('Verify code error:', error);
      res.status(500).json({
        error: 'Verification failed',
        message: error.message
      });
    }
  },

  async githubAuth(req, res) {
    try {
      const userId = req.user?.uid;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to link GitHub account'
        });
      }

      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&scope=user:email,repo&state=${userId}`;
      
      res.json({
        success: true,
        authUrl: githubAuthUrl,
        message: 'Redirect to this URL for GitHub account linking'
      });
    } catch (error) {
      console.error('GitHub auth initiate error:', error);
      res.status(500).json({
        error: 'Failed to initiate GitHub authentication',
        message: error.message
      });
    }
  },

  async githubCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.status(400).json({
          error: 'Authorization code required',
          message: 'GitHub authorization code is missing'
        });
      }

      const accessToken = await GitHubService.exchangeCodeForToken(code);
      const githubUser = await GitHubService.getGitHubUser(accessToken);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const existingUserWithGitHub = await User.findByGitHubId(githubUser.id);
      if (existingUserWithGitHub) {
        return res.redirect(`${frontendUrl}/dashboard?error=${encodeURIComponent('This GitHub account is already linked to another user')}`);
      }
      if (state) {
        try {
          const userIdFromState = state;
          const user = await User.findById(userIdFromState);
          
          if (user) {
            await User.updateGitHubInfo(user.id, githubUser, accessToken);
            return res.redirect(`${frontendUrl}/dashboard?success=${encodeURIComponent('GitHub account linked successfully')}`);
          }
        } catch (error) {
          console.error('Error linking GitHub account:', error);
        }
      }

      res.redirect(`${frontendUrl}/dashboard?error=${encodeURIComponent('Unable to link GitHub account. Please try again.')}`);
    } catch (error) {
      console.error('GitHub callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/dashboard?error=${encodeURIComponent('GitHub linking failed')}`);
    }
  },
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.uid);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          githubProfile: user.githubProfile,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to fetch profile',
        message: error.message
      });
    }
  },

  async updateProfile(req, res) {
    try {
      const { displayName, photoURL } = req.body;
      const userId = req.user.uid;

      await User.update(userId, {
        displayName: displayName || '',
        photoURL: photoURL || ''
      });

      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        message: error.message
      });
    }
  },

  async refreshToken(req, res) {
    try {
      const user = await User.findById(req.user.uid);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Generate new JWT token
      const token = generateJWTToken(user);
      

      res.json({
        success: true,
        accessToken: token,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        error: 'Failed to refresh token',
        message: error.message
      });
    }
  }

  
};
const generateJWTToken = (user) => {
  return jwt.sign(
    {
      uid: user.id,
      email: user.email,
      emailVerified: user.emailVerified
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

module.exports = authController;