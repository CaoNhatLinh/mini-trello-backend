const { database } = require('../config/firebase');
const { generateVerificationCode } = require('../utils/emailService');

class User {
  // Create new user
  static async create(uid, userData) {
    try {
      const userRef = database.ref(`users/${uid}`);
      const newUser = {
        email: userData.email,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        emailVerified: userData.emailVerified || false,
        githubAccessToken: userData.githubAccessToken || null,
        githubProfile: userData.githubProfile || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await userRef.set(newUser);
      return { id: uid, ...newUser };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  // Find user by ID
  static async findById(uid) {
    try {
      const userRef = database.ref(`users/${uid}`);
      const snapshot = await userRef.once('value');

      if (!snapshot.exists()) return null;

      return { id: uid, ...snapshot.val() };
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const usersRef = database.ref('users');
      const snapshot = await usersRef.orderByChild('email').equalTo(email).once('value');

      if (!snapshot.exists()) return null;

      let userData;
      snapshot.forEach(childSnapshot => {
        userData = { id: childSnapshot.key, ...childSnapshot.val() };
        return true; // Break after first match
      });
      return userData;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  // Find user by GitHub ID
  static async findByGitHubId(githubId) {
    try {
      const usersRef = database.ref('users');
      const snapshot = await usersRef.orderByChild('githubProfile/id').equalTo(githubId).once('value');

      if (!snapshot.exists()) return null;

      let userData;
      snapshot.forEach(childSnapshot => {
        userData = { id: childSnapshot.key, ...childSnapshot.val() };
        return true; // Break after first match
      });
      return userData;
    } catch (error) {
      throw new Error(`Error finding user by GitHub ID: ${error.message}`);
    }
  }

  // Update user
  static async update(uid, updateData) {
    try {
      const userRef = database.ref(`users/${uid}`);
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await userRef.update(updatedData);
      return true;
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  // Delete user
  static async delete(uid) {
    try {
      const userRef = database.ref(`users/${uid}`);
      await userRef.remove();
      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  // Store verification code temporarily
  static async storeVerificationCode(email, code) {
    try {
      const expiresAt = new Date(Date.now() + (process.env.VERIFICATION_CODE_EXPIRY_MINUTES || 10) * 60 * 1000);
      
      const tempAuthRef = database.ref(`tempAuth/${email.replace(/\./g, '_')}`);
      await tempAuthRef.set({
        email,
        verificationCode: code,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      throw new Error(`Error storing verification code: ${error.message}`);
    }
  }

  // Verify verification code
  static async verifyCode(email, code) {
    try {
      const tempAuthRef = database.ref(`tempAuth/${email.replace(/\./g, '_')}`);
      const snapshot = await tempAuthRef.once('value');

      if (!snapshot.exists()) {
        return { valid: false, message: 'Verification code not found' };
      }

      const data = snapshot.val();
      const now = new Date();
      const expiresAt = new Date(data.expiresAt);

      if (now > expiresAt) {
        await tempAuthRef.remove();
        return { valid: false, message: 'Verification code expired' };
      }

      if (data.verificationCode !== code) {
        return { valid: false, message: 'Invalid verification code' };
      }

      // Clean up used code
      await tempAuthRef.remove();
      return { valid: true, message: 'Code verified successfully' };
    } catch (error) {
      throw new Error(`Error verifying code: ${error.message}`);
    }
  }

  // Update GitHub information
  static async updateGitHubInfo(uid, githubProfile, accessToken) {
    try {
      const userRef = database.ref(`users/${uid}`);
      await userRef.update({
        githubProfile,
        githubAccessToken: accessToken,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Error updating GitHub info: ${error.message}`);
    }
  }
}

module.exports = User;