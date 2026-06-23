/**
 * Email Routes
 * Endpoints for email sending, queuing, and management
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, APIError } = require('../middleware/errorHandler');
const EmailService = require('../services/EmailService');
const EmailQueueService = require('../services/EmailQueueService');
const PdfFillerService = require('../services/PdfFillerService');

/**
 * POST /api/emails/send-inspection
 * Send inspection report via email
 * Queues if offline or SMTP not configured
 */
router.post(
  '/send-inspection',
  asyncHandler(async (req, res) => {
    try {
      const {
        inspectionId,
        recipientEmail,
        inspectionData,
        inspectionPoints,
        includeAttachment = true,
      } = req.body;

      if (!inspectionId) {
        throw new APIError('inspectionId is required', 400);
      }
      if (!recipientEmail) {
        throw new APIError('recipientEmail is required', 400);
      }

      console.log(`[Email Route] Sending inspection report: ${inspectionId}`);
      console.log(`  To: ${recipientEmail}`);

      // Prepare email content
      const subject = `CTPAT Inspection Report - ${inspectionData?.truckNumber || 'Report'}`;
      const body = `
        <h2>CTPAT Inspection Report</h2>
        <p><strong>Truck Number:</strong> ${inspectionData?.truckNumber || 'N/A'}</p>
        <p><strong>Trailer Number:</strong> ${inspectionData?.trailerNumber || 'N/A'}</p>
        <p><strong>Seal Number:</strong> ${inspectionData?.sealNumber || 'N/A'}</p>
        <p><strong>Date:</strong> ${inspectionData?.date || 'N/A'}</p>
        <p><strong>Time:</strong> ${inspectionData?.time || 'N/A'}</p>
        <hr />
        <p>Please see attached PDF for detailed inspection report.</p>
      `;

      // Prepare options (PDF attachment, metadata, etc)
      const options = {};

      // Generate PDF if requested
      if (includeAttachment && inspectionData && inspectionPoints) {
        try {
          console.log('[Email Route] Generating PDF for attachment...');
          const pdfBuffer = await PdfFillerService.generateFilledPdf(
            inspectionData,
            inspectionPoints
          );

          options.attachments = [
            {
              filename: `inspection-${inspectionData.truckNumber || 'report'}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ];

          console.log(`✓ PDF generated (${pdfBuffer.length} bytes)`);
        } catch (error) {
          console.warn('⚠️  Failed to generate PDF for attachment:', error.message);
          // Continue without attachment
        }
      }

      // Send email (queued if offline)
      const result = await EmailService.sendEmail({
        inspectionId,
        recipientEmail,
        subject,
        body,
        options,
      });

      res.json({
        success: true,
        data: {
          ...result,
          queued: result.status === 'pending',
        },
      });
    } catch (error) {
      console.error('❌ Email send error:', error.message);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to send email',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * GET /api/emails/queue-stats
 * Get email queue statistics
 */
router.get(
  '/queue-stats',
  asyncHandler(async (req, res) => {
    try {
      const stats = await EmailService.getQueueStats();

      res.json({
        success: true,
        data: {
          queue: stats,
          smtpConfigured: EmailService.isSmtpConfigured(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get queue stats',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * POST /api/emails/process-queue
 * Process queued emails and send pending ones
 * Called when connectivity is restored
 */
router.post(
  '/process-queue',
  asyncHandler(async (req, res) => {
    try {
      const { limit = 5 } = req.body;

      console.log('[Email Route] Processing email queue...');
      const result = await EmailService.processQueuedEmails(limit);

      res.json({
        success: true,
        data: {
          processed: result.sent + result.failed,
          sent: result.sent,
          failed: result.failed,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to process queue',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * GET /api/emails/queue
 * Get list of queued emails
 */
router.get(
  '/queue',
  asyncHandler(async (req, res) => {
    try {
      const { inspectionId } = req.query;

      let emails;
      if (inspectionId) {
        emails = await EmailQueueService.getInspectionEmailQueue(inspectionId);
      } else {
        emails = await EmailQueueService.getPendingEmails(50);
      }

      res.json({
        success: true,
        data: {
          emails,
          count: emails.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get email queue',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * POST /api/emails/test-connection
 * Test SMTP connection
 */
router.post(
  '/test-connection',
  asyncHandler(async (req, res) => {
    try {
      console.log('[Email Route] Testing SMTP connection...');
      const connected = await EmailService.testConnection();

      res.json({
        success: true,
        data: {
          connected,
          message: connected ? 'SMTP connection successful' : 'SMTP connection failed',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Test connection failed',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * GET /api/emails/inspection/:inspectionId
 * Get email history for a specific inspection
 */
router.get(
  '/inspection/:inspectionId',
  asyncHandler(async (req, res) => {
    try {
      const { inspectionId } = req.params;

      const emails = await EmailQueueService.getInspectionEmailQueue(inspectionId);

      res.json({
        success: true,
        data: {
          inspectionId,
          emails,
          count: emails.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get inspection emails',
          statusCode: 500,
        },
      });
    }
  })
);

module.exports = router;
