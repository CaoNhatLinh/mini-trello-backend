const nodemailer = require('nodemailer');
// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email
const sendVerificationEmail = async (email, code) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Mini Trello - Email Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0079bf;">Mini Trello Email Verification</h2>
          <p>Hello,</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #0079bf; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
          </div>
          <p>This code will expire in ${process.env.VERIFICATION_CODE_EXPIRY_MINUTES || 10} minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated email from Mini Trello. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error('Failed to send verification email');
  }
};

// Send invitation email
const sendInvitationEmail = async (email, boardName, inviterName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Mini Trello - You're invited to join "${boardName}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0079bf;">You're invited to collaborate!</h2>
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join the board <strong>"${boardName}"</strong> on Mini Trello.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/boards" style="background-color: #0079bf; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Invitation</a>
          </div>
          <p>Sign in to your Mini Trello account to accept or decline this invitation.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated email from Mini Trello. Please do not reply.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error('Failed to send invitation email');
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendInvitationEmail
};