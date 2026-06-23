/**
 * Email Service
 * Sends emails via SMTP with graceful fallback
 * Queues emails if offline
 */

const nodemailer = require('nodemailer');
const EmailQueueService = require('./EmailQueueService');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter from environment variables
   * Set by SecureCredentialsService during app initialization
   */
  initializeTransporter() {
    try {
      // Check if SMTP is configured
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('⚠️  SMTP not configured - emails will be queued for later sending');
        this.isConfigured = false;
        return;
      }

      // Determine secure connection based on port
      const port = parseInt(process.env.SMTP_PORT || '587');
      const secure = port === 465; // 465 = TLS, 587 = STARTTLS

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      this.isConfigured = true;
      console.log(`✓ Email service configured for ${process.env.SMTP_HOST}:${port}`);
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Check if SMTP is configured
   * @returns {boolean}
   */
  isSmtpConfigured() {
    return this.isConfigured;
  }

  /**
   * Send email immediately (if SMTP configured) or queue for later
   * 
   * @param {object} emailData - Email data
   * @param {string} emailData.inspectionId - Associated inspection ID
   * @param {string} emailData.recipientEmail - Recipient email address
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.body - Email body (HTML)
   * @param {object} emailData.options - Optional: metadata, attachments, etc
   * @returns {Promise<object>} - Send result
   */
  async sendEmail(emailData) {
    const { inspectionId, recipientEmail, subject, body, options = {} } = emailData;

    try {
      console.log(`[EmailService] Sending email for inspection: ${inspectionId}`);
      console.log(`  To: ${recipientEmail}`);
      console.log(`  Subject: ${subject}`);

      // If SMTP not configured, queue for later
      if (!this.isSmtpConfigured()) {
        console.log(`[EmailService] SMTP not configured - queuing email`);
        return await EmailQueueService.queueEmail(
          inspectionId,
          recipientEmail,
          subject,
          body,
          options
        );
      }

      // Try to send immediately
      return await this.sendEmailNow(inspectionId, recipientEmail, subject, body, options);
    } catch (error) {
      console.error('❌ Email send error:', error.message);
      
      // Queue for retry
      console.log(`[EmailService] Queuing email for retry...`);
      return await EmailQueueService.queueEmail(
        inspectionId,
        recipientEmail,
        subject,
        body,
        options
      );
    }
  }

  /**
   * Send email now via SMTP
   * @private
   */
  async sendEmailNow(inspectionId, recipientEmail, subject, body, options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('SMTP transporter not initialized');
      }

      const mailOptions = {
        from: `CTPAT Inspection <${process.env.SMTP_USER}>`,
        to: recipientEmail,
        subject: subject,
        html: body,
      };

      // Add attachments if provided
      if (options.attachments && Array.isArray(options.attachments)) {
        mailOptions.attachments = options.attachments;
      }

      console.log(`[EmailService] Sending via SMTP to ${recipientEmail}...`);
      const result = await this.transporter.sendMail(mailOptions);

      console.log(`✓ Email sent successfully`);
      console.log(`  Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Failed to send email via SMTP:', error.message);
      throw error;
    }
  }

  /**
   * Process queued emails and send pending ones
   * Called when connectivity is restored or periodically
   * 
   * @param {number} limit - Max emails to process in one batch
   * @returns {Promise<object>} - Process results
   */
  async processQueuedEmails(limit = 5) {
    try {
      console.log(`[EmailService] Processing queued emails...`);

      if (!this.isSmtpConfigured()) {
        console.warn('⚠️  SMTP not configured - cannot process queue');
        return { success: false, sent: 0, failed: 0 };
      }

      const pendingEmails = await EmailQueueService.getPendingEmails(limit);

      if (pendingEmails.length === 0) {
        console.log(`[EmailService] No pending emails in queue`);
        return { success: true, sent: 0, failed: 0 };
      }

      let sent = 0;
      let failed = 0;

      for (const email of pendingEmails) {
        try {
          console.log(`[EmailService] Sending queued email: ${email.emailId}`);

          const mailOptions = {
            from: `CTPAT Inspection <${process.env.SMTP_USER}>`,
            to: email.recipientEmail,
            subject: email.subject,
            html: email.body,
          };

          // Parse metadata if present
          let attachments = [];
          if (email.metadata) {
            try {
              const metadata = JSON.parse(email.metadata);
              attachments = metadata.attachments || [];
            } catch (e) {
              // Ignore metadata parse errors
            }
          }

          if (attachments.length > 0) {
            mailOptions.attachments = attachments;
          }

          const result = await this.transporter.sendMail(mailOptions);

          console.log(`✓ Queued email sent: ${email.emailId}`);
          await EmailQueueService.markSent(email.emailId);
          sent++;
        } catch (error) {
          console.error(`✗ Failed to send queued email ${email.emailId}:`, error.message);
          
          // Only retry up to 3 times
          if (email.retryCount < 3) {
            await EmailQueueService.markFailed(email.emailId, error.message);
            failed++;
          } else {
            console.warn(`⚠️  Email ${email.emailId} exceeded max retries - giving up`);
            await EmailQueueService.markFailed(email.emailId, 'Max retries exceeded');
            failed++;
          }
        }
      }

      console.log(`[EmailService] Queue processing complete: ${sent} sent, ${failed} failed`);
      return { success: true, sent, failed };
    } catch (error) {
      console.error('❌ Failed to process email queue:', error.message);
      return { success: false, sent: 0, failed: 0 };
    }
  }

  /**
   * Get email queue statistics
   * @returns {Promise<object>}
   */
  async getQueueStats() {
    return await EmailQueueService.getQueueStats();
  }

  /**
   * Test SMTP connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        console.warn('⚠️  SMTP transporter not initialized');
        return false;
      }

      console.log('[EmailService] Testing SMTP connection...');
      await this.transporter.verify();
      console.log('✓ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP connection test failed:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
