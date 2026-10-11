/**
 * Email Service
 * Sends a finished inspection PDF by email. SMTP settings come only from the
 * server's environment - a client can choose the recipient, never the server.
 */

const nodemailer = require('nodemailer');

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let cachedTransporter = null;

const createTransporter = (env = process.env) => {
  switch (env.EMAIL_PROVIDER || 'smtp') {
    case 'sendgrid':
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: { user: 'apikey', pass: env.SENDGRID_API_KEY },
      });
    case 'gmail':
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      });
    default:
      return nodemailer.createTransport({
        host: env.SMTP_HOST || 'localhost',
        port: Number(env.SMTP_PORT) || 587,
        secure: env.SMTP_SECURE === 'true',
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      });
  }
};

const getTransporter = () => {
  if (!cachedTransporter) cachedTransporter = createTransporter();
  return cachedTransporter;
};

/** Safe for a file name: letters, digits, dot, dash and underscore only. */
const toFileNamePart = (value) => String(value).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40);

// Records saved before the freight bill existed have none, so it is optional here.
const freightBillOf = (inspection) => inspection.values?.freightBillNumber;

const pdfFileName = (inspection) => {
  const { formId, summaryId, createdAt } = inspection;
  const day = new Date(createdAt).toISOString().slice(0, 10);
  const freightBill = freightBillOf(inspection);
  const parts = ['CTPAT', formId, ...(freightBill ? [`FB-${freightBill}`] : []), summaryId, day];
  return `${parts.map(toFileNamePart).join('_')}.pdf`;
};

/**
 * @param {{to: string, form: object, inspection: object, pdf: Buffer, transporter?: object}} args
 */
const sendInspectionReport = async ({ to, form, inspection, pdf, transporter = getTransporter() }) => {
  const { values } = inspection;
  const freightBill = freightBillOf(inspection);
  const summary = [
    ['Form', form.label],
    ...(freightBill ? [['Freight Bill', freightBill]] : []),
    ['Reference', inspection.summaryId],
    ['Inspector', values.printName],
    ['Date', `${values.date} ${values.time}`],
  ];

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@ctpat-inspections.app',
    to,
    subject: `CTPAT ${form.label} Inspection - ${freightBill ? `Freight Bill ${freightBill}` : inspection.summaryId}`,
    text: ['CTPAT Inspection Report', '', ...summary.map(([k, v]) => `${k}: ${v}`)].join('\n'),
    html: `<h2>CTPAT Inspection Report</h2><ul>${summary
      .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
      .join('')}</ul><p>The completed form is attached.</p>`,
    attachments: [{ filename: pdfFileName(inspection), content: pdf, contentType: 'application/pdf' }],
  });

  return { messageId: info.messageId, recipient: to };
};

module.exports = { sendInspectionReport, pdfFileName };
