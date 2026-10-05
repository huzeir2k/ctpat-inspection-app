/**
 * Credentials Routes
 * Endpoints for backend to access stored credentials
 * Only accessible internally (localhost)
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In-memory credentials store (loaded from AsyncStorage via API call)
let storedCredentials = null;

/**
 * GET /api/credentials/config
 * Retrieve stored app credentials (JWT secret, SMTP config)
 * Called during backend startup
 */
router.get('/config', (req, res) => {
  try {
    if (!storedCredentials) {
      console.log('⚠️  No credentials stored yet - using defaults');
      return res.json({
        success: true,
        credentials: {
          smtpConfig: null,
        },
      });
    }

    // Never echo the JWT secret back over the API — only expose SMTP config.
    res.json({
      success: true,
      credentials: { smtpConfig: storedCredentials.smtpConfig || null },
    });
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve credentials',
        statusCode: 500,
      },
    });
  }
});

/**
 * POST /api/credentials/store
 * Store credentials from frontend (called via AsyncStorage bridge)
 * Credentials already encrypted in SecureStore on frontend
 */
router.post('/store', express.json(), (req, res) => {
  try {
    const { smtpConfig } = req.body;

    // Store in memory
    storedCredentials = {
      smtpConfig,
    };

    // Set environment variables for EmailService to use
    if (smtpConfig) {
      process.env.SMTP_HOST = smtpConfig.host || '';
      process.env.SMTP_PORT = smtpConfig.port || '587';
      process.env.SMTP_USER = smtpConfig.user || '';
      process.env.SMTP_PASSWORD = smtpConfig.password || '';
      process.env.SMTP_RECIPIENT_EMAIL = smtpConfig.recipientEmail || '';
      
      console.log('📧 SMTP Configuration Updated:', {
        host: smtpConfig.host,
        port: smtpConfig.port,
        user: smtpConfig.user ? smtpConfig.user.substring(0, 3) + '***' : 'not-set',
        password: smtpConfig.password ? '***' : 'not-set',
        recipientEmail: smtpConfig.recipientEmail,
      });
    }

    res.json({
      success: true,
      message: 'Credentials stored successfully',
    });
  } catch (error) {
    console.error('Error storing credentials:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to store credentials',
        statusCode: 500,
      },
    });
  }
});

/**
 * GET /api/credentials/smtp-config
 * Get SMTP configuration
 */
router.get('/smtp-config', (req, res) => {
  try {
    const config = storedCredentials?.smtpConfig;
    
    if (!config) {
      return res.json({
        success: true,
        configured: false,
        config: null,
      });
    }

    res.json({
      success: true,
      configured: true,
      config: {
        host: config.host,
        port: config.port,
        user: config.user,
        recipientEmail: config.recipientEmail,
        // Password not returned (stored securely in memory only)
      },
    });
  } catch (error) {
    console.error('Error retrieving SMTP config:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve SMTP config',
        statusCode: 500,
      },
    });
  }
});

module.exports = router;
