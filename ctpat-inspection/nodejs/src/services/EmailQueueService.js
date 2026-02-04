/**
 * Email Queue Service
 * Manages offline email queuing and sending when online
 * Stores emails in SQLite for later delivery
 */

const { getDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class EmailQueueService {
  /**
   * Queue an email in the database
   * Email will be sent later when online
   * 
   * @param {string} inspectionId - Associated inspection ID
   * @param {string} recipientEmail - Email recipient
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML)
   * @param {object} options - Optional: pdfBuffer, attachments, etc
   * @returns {Promise<object>} - Queued email record
   */
  static async queueEmail(inspectionId, recipientEmail, subject, body, options = {}) {
    try {
      const db = getDatabase();
      const emailId = uuidv4();
      const now = new Date().toISOString();

      console.log(`[EmailQueue] Queuing email for inspection: ${inspectionId}`);
      console.log(`  To: ${recipientEmail}`);
      console.log(`  Subject: ${subject}`);

      // Serialize optional data (PDF buffer, attachments, etc)
      const metadata = options.metadata ? JSON.stringify(options.metadata) : null;

      const stmt = db.prepare(`
        INSERT INTO email_queue 
        (emailId, inspectionId, recipientEmail, subject, body, status, metadata, createdAt, retryCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        emailId,
        inspectionId,
        recipientEmail,
        subject,
        body,
        'pending',
        metadata,
        now,
        0
      );

      console.log(`✓ Email queued with ID: ${emailId}`);

      return {
        emailId,
        inspectionId,
        recipientEmail,
        subject,
        status: 'pending',
        createdAt: now,
      };
    } catch (error) {
      console.error('❌ Failed to queue email:', error.message);
      throw error;
    }
  }

  /**
   * Get all pending emails in queue
   * @returns {Promise<array>} - Array of pending emails
   */
  static async getPendingEmails(limit = 10) {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT * FROM email_queue 
        WHERE status = 'pending' 
        ORDER BY createdAt ASC 
        LIMIT ?
      `);

      const emails = stmt.all(limit);
      console.log(`[EmailQueue] Found ${emails.length} pending email(s)`);
      return emails;
    } catch (error) {
      console.error('❌ Failed to get pending emails:', error.message);
      return [];
    }
  }

  /**
   * Mark email as sent
   * @param {string} emailId - Email ID
   * @returns {Promise<void>}
   */
  static async markSent(emailId) {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        UPDATE email_queue 
        SET status = 'sent', sentAt = ? 
        WHERE emailId = ?
      `);

      stmt.run(now, emailId);
      console.log(`✓ Email marked as sent: ${emailId}`);
    } catch (error) {
      console.error('❌ Failed to mark email as sent:', error.message);
      throw error;
    }
  }

  /**
   * Mark email as failed and increment retry count
   * @param {string} emailId - Email ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<void>}
   */
  static async markFailed(emailId, errorMessage) {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        UPDATE email_queue 
        SET status = 'failed', error = ?, retryCount = retryCount + 1 
        WHERE emailId = ?
      `);

      stmt.run(errorMessage.substring(0, 255), emailId);
      console.log(`⚠️  Email marked as failed: ${emailId}`);
      console.log(`   Error: ${errorMessage}`);
    } catch (error) {
      console.error('❌ Failed to mark email as failed:', error.message);
      throw error;
    }
  }

  /**
   * Get email queue statistics
   * @returns {Promise<object>} - Queue stats
   */
  static async getQueueStats() {
    try {
      const db = getDatabase();

      const pendingStmt = db.prepare(`
        SELECT COUNT(*) as count FROM email_queue WHERE status = 'pending'
      `);
      const sentStmt = db.prepare(`
        SELECT COUNT(*) as count FROM email_queue WHERE status = 'sent'
      `);
      const failedStmt = db.prepare(`
        SELECT COUNT(*) as count FROM email_queue WHERE status = 'failed'
      `);

      const pending = pendingStmt.get();
      const sent = sentStmt.get();
      const failed = failedStmt.get();

      const stats = {
        pending: pending?.count || 0,
        sent: sent?.count || 0,
        failed: failed?.count || 0,
        total: (pending?.count || 0) + (sent?.count || 0) + (failed?.count || 0),
      };

      console.log('[EmailQueue] Queue stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Failed to get queue stats:', error.message);
      return { pending: 0, sent: 0, failed: 0, total: 0 };
    }
  }

  /**
   * Clear old sent emails (optional cleanup)
   * @param {number} olderThanDays - Remove sent emails older than N days
   * @returns {Promise<number>} - Number of emails deleted
   */
  static async clearOldSentEmails(olderThanDays = 30) {
    try {
      const db = getDatabase();
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

      const stmt = db.prepare(`
        DELETE FROM email_queue 
        WHERE status = 'sent' AND sentAt < ?
      `);

      const result = stmt.run(cutoffDate);
      console.log(`✓ Cleared ${result.changes} old sent email(s)`);
      return result.changes;
    } catch (error) {
      console.error('❌ Failed to clear old emails:', error.message);
      return 0;
    }
  }

  /**
   * Get queue info for a specific inspection
   * @param {string} inspectionId - Inspection ID
   * @returns {Promise<array>} - Array of emails for inspection
   */
  static async getInspectionEmailQueue(inspectionId) {
    try {
      const db = getDatabase();
      const stmt = db.prepare(`
        SELECT * FROM email_queue 
        WHERE inspectionId = ? 
        ORDER BY createdAt DESC
      `);

      return stmt.all(inspectionId);
    } catch (error) {
      console.error('❌ Failed to get inspection email queue:', error.message);
      return [];
    }
  }
}

module.exports = EmailQueueService;
