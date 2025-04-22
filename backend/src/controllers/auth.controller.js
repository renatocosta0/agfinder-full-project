const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, BonusTransaction } = require('../models');
const logger = require('../utils/logger');

// Initialize Google OAuth clients for different platforms
const googleClientWeb = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);
const googleClientAndroid = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_ANDROID);
const googleClientIOS = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_IOS);
// For Expo, we'll use a different approach as it uses the auth.expo.io proxy

// Google OAuth login/signup
const googleAuth = async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'No token provided',
      });
    }

    // Select appropriate client based on platform
    let ticket;
    let clientId;

    try {
      switch (platform) {
        case 'web':
          clientId = process.env.GOOGLE_CLIENT_ID_WEB;
          ticket = await googleClientWeb.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
          break;
        case 'android':
          clientId = process.env.GOOGLE_CLIENT_ID_ANDROID;
          ticket = await googleClientAndroid.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
          break;
        case 'ios':
          clientId = process.env.GOOGLE_CLIENT_ID_IOS;
          ticket = await googleClientIOS.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
          break;
        case 'expo':
          // For Expo, we check against both Android and iOS client IDs
          // since Expo uses a proxy and can send either ID
          try {
            clientId = process.env.GOOGLE_CLIENT_ID_IOS; // Try iOS first
            ticket = await googleClientIOS.verifyIdToken({
              idToken: token,
              audience: clientId,
            });
          } catch (error) {
            // If iOS fails, try Android
            clientId = process.env.GOOGLE_CLIENT_ID_ANDROID;
            ticket = await googleClientAndroid.verifyIdToken({
              idToken: token,
              audience: clientId,
            });
          }
          break;
        default:
          // Default to web client
          clientId = process.env.GOOGLE_CLIENT_ID_WEB;
          ticket = await googleClientWeb.verifyIdToken({
            idToken: token,
            audience: clientId,
          });
      }
    } catch (verifyError) {
      logger.error('Token verification error:', verifyError);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token',
        details: verifyError.message,
      });
    }

    const { sub, email, name, picture } = ticket.getPayload();

    // Find or create user
    let user = await User.findOne({ where: { google_id: sub } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await User.create({
        google_id: sub,
        email,
        name,
        profile_picture: picture,
        bonus_points: 0,
        subscription_type: 'none',
      });

      // Give welcome bonus to new users
      await BonusTransaction.create({
        user_id: user.id,
        amount: parseInt(process.env.BONUS_WELCOME, 10),
        transaction_type: 'welcome',
        description: 'Welcome bonus',
      });

      // Update user bonus points
      user.bonus_points += parseInt(process.env.BONUS_WELCOME, 10);
      await user.save();

      logger.info(`New user created: ${user.id}`);
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      status: 'success',
      message: isNewUser ? 'User created successfully' : 'User logged in successfully',
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.subscription_type,
          subscription_end: user.subscription_end,
          is_banned: user.is_banned,
        },
        isNewUser,
      },
    });
  } catch (error) {
    logger.error('Google auth error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
    });
  }
};

// Get current user info
const getCurrentUser = async (req, res) => {
  try {
    const { user } = req;
    
    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.subscription_type,
          subscription_end: user.subscription_end,
          is_banned: user.is_banned,
        },
      },
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching user information',
    });
  }
};

module.exports = {
  googleAuth,
  getCurrentUser,
}; 