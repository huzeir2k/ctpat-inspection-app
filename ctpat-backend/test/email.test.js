const test = require('node:test');
const assert = require('node:assert/strict');
const { getForm } = require('../src/forms');
const { sendInspectionReport, pdfFileName } = require('../src/services/EmailService');

const inspection = (values = {}) => ({
  formId: 'flatbed-6',
  summaryId: 'FB-20457',
  createdAt: '2026-10-05T14:30:00Z',
  values: { printName: 'Nandu Pena', date: '10/05/2026', time: '14:30', ...values },
});

test('the freight bill number appears in the file name, subject and body', async () => {
  let sent;
  const transporter = { sendMail: async (message) => ((sent = message), { messageId: 'x' }) };
  const record = inspection({ freightBillNumber: 'FB-0012345' });

  await sendInspectionReport({ to: 'a@b.com', form: getForm('flatbed-6'), inspection: record, pdf: Buffer.from('%PDF-'), transporter });

  assert.match(sent.subject, /Freight Bill FB-0012345/);
  assert.match(sent.text, /Freight Bill: FB-0012345/);
  assert.equal(sent.attachments[0].filename, 'CTPAT_flatbed-6_FB-FB-0012345_FB-20457_2026-10-05.pdf');
});

test('file names stay safe even for unusual freight bill numbers', () => {
  const name = pdfFileName(inspection({ freightBillNumber: 'a/b c.d' }));
  assert.match(name, /^[A-Za-z0-9._-]+$/);
});

test('records saved before the freight bill existed still produce a file name and email', async () => {
  assert.equal(pdfFileName(inspection()), 'CTPAT_flatbed-6_FB-20457_2026-10-05.pdf');

  let sent;
  const transporter = { sendMail: async (message) => ((sent = message), { messageId: 'x' }) };
  await sendInspectionReport({ to: 'a@b.com', form: getForm('flatbed-6'), inspection: inspection(), pdf: Buffer.from('%PDF-'), transporter });
  assert.match(sent.subject, /FB-20457$/);
});
