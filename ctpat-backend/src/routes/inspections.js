const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  parseListQuery,
  parseEmailBody,
  parseInspectionId,
  parseIdempotencyKey,
} = require('../validators/queryValidator');
const { pdfFileName } = require('../services/EmailService');

const WINDOW_15_MIN = 15 * 60 * 1000;
const perUser = (req) => req.user.id;

/** What the history list shows for one inspection. */
const toListItem = (doc) => ({
  inspectionId: doc.inspectionId,
  formId: doc.formId,
  templateVersion: doc.templateVersion,
  summaryId: doc.summaryId,
  createdAt: doc.createdAt,
  printName: doc.values?.printName,
  date: doc.values?.date,
  time: doc.values?.time,
});

/** The full answers of one inspection. Signature images are never included. */
const toDetail = (doc) => ({
  ...toListItem(doc),
  checklist: doc.checklist,
  values: doc.values,
});

const sendPdf = (res, pdf, inspection, disposition) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${pdfFileName(inspection)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
};

/**
 * @param {ReturnType<import('../services/InspectionService').createInspectionService>} service
 */
const createInspectionRouter = (service) => {
  const router = express.Router();

  // PDF rendering costs CPU and email costs money, so both get tighter per-user limits.
  const writeLimiter = createRateLimiter({ windowMs: WINDOW_15_MIN, maxRequests: 30, keyGenerator: perUser });
  const emailLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyGenerator: perUser,
    message: 'Too many emails sent, please try again later',
  });

  router.post(
    '/preview',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const pdf = await service.preview(req.body);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="CTPAT_preview.pdf"');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(pdf);
    })
  );

  router.post(
    '/',
    writeLimiter,
    asyncHandler(async (req, res) => {
      const idempotencyKey = parseIdempotencyKey(req.get('Idempotency-Key'));
      const { inspection, isDuplicate } = await service.create(req.user.id, req.body, idempotencyKey);

      res.status(isDuplicate ? 200 : 201).json({
        success: true,
        isDuplicate,
        data: toListItem(inspection),
      });
    })
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { inspections, pagination } = await service.list(req.user.id, parseListQuery(req.query));
      res.json({ success: true, data: { inspections: inspections.map(toListItem), pagination } });
    })
  );

  router.get(
    '/stats/summary',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.stats(req.user.id) });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const inspection = await service.get(req.user.id, parseInspectionId(req.params.id));
      res.json({ success: true, data: toDetail(inspection) });
    })
  );

  router.get(
    '/:id/pdf',
    asyncHandler(async (req, res) => {
      const { inspection, pdf } = await service.getPdf(req.user.id, parseInspectionId(req.params.id));
      sendPdf(res, pdf, inspection, req.query.download === 'true' ? 'attachment' : 'inline');
    })
  );

  router.post(
    '/:id/send-email',
    emailLimiter,
    asyncHandler(async (req, res) => {
      const { recipientEmail } = parseEmailBody(req.body);
      const result = await service.sendEmail(req.user.id, parseInspectionId(req.params.id), recipientEmail);
      res.json({ success: true, data: result });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await service.remove(req.user.id, parseInspectionId(req.params.id));
      res.json({ success: true, message: 'Inspection deleted' });
    })
  );

  return router;
};

module.exports = { createInspectionRouter };
