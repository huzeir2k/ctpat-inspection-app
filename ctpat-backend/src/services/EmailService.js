/**
 * Email Service
 * Handles sending inspection reports via SMTP
 * Uses Nodemailer for reliable email delivery
 */

const nodemailer = require('nodemailer');
const { APIError } = require('../middleware/errorHandler');

/**
 * Create email transporter based on environment or provided config
 * Supports multiple configurations:
 * - Dynamic SMTP from frontend request
 * - SMTP server (production)
 * - SendGrid
 * - Gmail with app password
 * - Ethereal (testing)
 */
const createTransporter = async (customConfig = null) => {
  // If custom config provided from frontend, use it
  if (customConfig) {
    if (customConfig.host && customConfig.port && customConfig.user && customConfig.password) {
      return nodemailer.createTransport({
        host: customConfig.host,
        port: parseInt(customConfig.port),
        secure: customConfig.port === 465 || customConfig.secure === true, // true for 465, false for other ports
        auth: {
          user: customConfig.user,
          pass: customConfig.password,
        },
      });
    }
  }

  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

  switch (emailProvider) {
    case 'sendgrid':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY,
        },
      });

    case 'gmail':
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

    case 'smtp':
    default:
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      });
  }
};

/**
 * Send inspection report email
 * @param {string} recipientEmail - Email address to send to
 * @param {object} inspectionData - Inspection form data
 * @param {Buffer} pdfBuffer - Optional PDF buffer
 * @param {string} pdfUrl - Optional PDF URL
 * @param {object} smtpConfig - Optional custom SMTP config { host, port, user, password, fromEmail }
 */
const sendInspectionReport = async (
  recipientEmail,
  inspectionData,
  pdfBuffer = null,
  pdfUrl = null,
  smtpConfig = null
) => {
  try {
    // Validate email
    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new APIError('Invalid recipient email address', 400);
    }

    // Create transporter with optional custom config
    const transporter = await createTransporter(smtpConfig);

    // Verify connection
    try {
      await transporter.verify();
    } catch (error) {
      console.warn('Email service verification failed:', error.message);
      // Continue anyway - may be rate limited or temporarily down
    }

    // Format inspection summary
    const checkedItems = inspectionData.inspectionPoints
      .filter((p) => p.checked)
      .map((p) => `  ✓ ${p.title}`)
      .join('\n');

    const completionPercentage = Math.round(
      (inspectionData.inspectionPoints.filter((p) => p.checked).length /
        inspectionData.inspectionPoints.length) *
        100
    );

    // Create email content
    const subject = `CTPAT Inspection Report - Truck ${inspectionData.truckNumber}`;

    const htmlContent = `
      <h2>CTPAT Inspection Report</h2>
      
      <h3>Vehicle Information</h3>
      <ul>
        <li><strong>Truck Number:</strong> ${inspectionData.truckNumber}</li>
        <li><strong>Trailer Number:</strong> ${inspectionData.trailerNumber}</li>
        <li><strong>Seal Number:</strong> ${inspectionData.sealNumber}</li>
      </ul>

      <h3>Inspection Details</h3>
      <ul>
        <li><strong>Date:</strong> ${inspectionData.date}</li>
        <li><strong>Time:</strong> ${inspectionData.time}</li>
        <li><strong>Inspector:</strong> ${inspectionData.printName}</li>
        <li><strong>Verified By:</strong> ${inspectionData.verifiedByName}</li>
      </ul>

      <h3>Compliance Checks</h3>
      <ul>
        <li>Security: ${inspectionData.securityCheckboxChecked ? '✓ Checked' : '✗ Not checked'}</li>
        <li>Agricultural Pest: ${inspectionData.agriculturalPestCheckboxChecked ? '✓ Checked' : '✗ Not checked'}</li>
      </ul>

      <h3>Inspection Points (${completionPercentage}% Complete)</h3>
      <pre>${checkedItems || 'No items checked'}</pre>

      ${inspectionData.notes ? `<h3>Notes</h3><p>${inspectionData.notes}</p>` : ''}

      ${pdfUrl ? `<p><a href="${pdfUrl}">View Full PDF Report</a></p>` : ''}

      <hr>
      <p><small>This is an automated message from the CTPAT Inspection System.</small></p>
    `;

    const textContent = `
CTPAT Inspection Report

Vehicle Information:
  Truck Number: ${inspectionData.truckNumber}
  Trailer Number: ${inspectionData.trailerNumber}
  Seal Number: ${inspectionData.sealNumber}

Inspection Details:
  Date: ${inspectionData.date}
  Time: ${inspectionData.time}
  Inspector: ${inspectionData.printName}
  Verified By: ${inspectionData.verifiedByName}

Compliance Checks:
  Security: ${inspectionData.securityCheckboxChecked ? 'Checked' : 'Not checked'}
  Agricultural Pest: ${inspectionData.agriculturalPestCheckboxChecked ? 'Checked' : 'Not checked'}

Inspection Points (${completionPercentage}% Complete):
${checkedItems || 'No items checked'}

${inspectionData.notes ? `\nNotes:\n${inspectionData.notes}` : ''}

${pdfUrl ? `\nView Full Report: ${pdfUrl}` : ''}
    `;

    // Prepare email options
    const mailOptions = {
      from: smtpConfig?.fromEmail || process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@ctpat-inspections.app',
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
      text: textContent,
    };

    // Attach PDF if provided
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `CTPAT_${inspectionData.truckNumber}_${inspectionData.date}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ];
    }

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log(`✓ Email sent to ${recipientEmail}: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: recipientEmail,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new APIError(`Failed to send email: ${error.message}`, 500);
  }
};

/**
 * Send bulk inspection reports
 */
const sendBulkReports = async (recipients, inspectionData) => {
  const results = [];

  for (const recipient of recipients) {
    try {
      const result = await sendInspectionReport(
        recipient,
        inspectionData
      );
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        recipient,
        error: error.message,
      });
    }
  }

  return results;
};

module.exports = {
  sendInspectionReport,
  sendBulkReports,
  createTransporter,
};
