/**
 * Inspection Service
 *
 * The workflow behind the inspection API: validate a submission against its
 * form definition, render the PDF, store it, and save the record.
 *
 * Every read or write that touches saved inspections is scoped to the calling
 * user (`createdBy`), so one user can never see or change another's records.
 */

const { v4: uuidv4 } = require('uuid');
const { APIError } = require('../middleware/errorHandler');
const { validateSubmission } = require('../validators/submissionValidator');

const DUPLICATE_KEY_ERROR = 11000;

// Fields shown in the history list; signatures and full answers are left out.
const LIST_PROJECTION = 'inspectionId formId templateVersion summaryId createdAt values.freightBillNumber values.printName values.date values.time';

const isAllowedRecipient = (email, allowedDomains) =>
  allowedDomains.length === 0 || allowedDomains.includes(email.split('@').pop());

const createInspectionService = ({
  Inspection,
  storage,
  pdfFiller,
  emailer,
  getForm,
  allowedEmailDomains = [],
  logger = console,
}) => {
  const resolveForm = (body) => {
    const form = typeof body?.formId === 'string' ? getForm(body.formId) : null;
    if (!form) throw new APIError('Unknown inspection form', 400);
    return form;
  };

  const owned = (userId, inspectionId) => ({ createdBy: userId, inspectionId });

  const findOwnedOrFail = async (userId, inspectionId) => {
    const inspection = await Inspection.findOne(owned(userId, inspectionId)).lean();
    if (!inspection) throw new APIError('Inspection not found', 404);
    return inspection;
  };

  const splitSignatures = (form, values) => {
    const answers = {};
    const signatures = {};
    for (const field of form.fields) {
      const target = field.type === 'signature' ? signatures : answers;
      if (values[field.key] !== undefined) target[field.key] = values[field.key];
    }
    return { answers, signatures };
  };

  const findByIdempotencyKey = (userId, idempotencyKey) =>
    idempotencyKey ? Inspection.findOne({ createdBy: userId, idempotencyKey }).lean() : null;

  const getPdf = async (userId, inspectionId) => {
    const inspection = await findOwnedOrFail(userId, inspectionId);
    return { inspection, pdf: await storage.read(inspection.pdfStoragePath) };
  };

  return {
    /** Renders a PDF from possibly incomplete data without saving anything. */
    async preview(body) {
      const form = resolveForm(body);
      const data = validateSubmission(form, body, { complete: false });
      return pdfFiller.generate(form, data);
    },

    /** @returns {Promise<{inspection: object, isDuplicate: boolean}>} */
    async create(userId, body, idempotencyKey) {
      const form = resolveForm(body);
      const data = validateSubmission(form, body);

      const existing = await findByIdempotencyKey(userId, idempotencyKey);
      if (existing) return { inspection: existing, isDuplicate: true };

      const inspectionId = uuidv4();
      const pdfStoragePath = `inspections/${userId}/${inspectionId}.pdf`;
      await storage.save(pdfStoragePath, await pdfFiller.generate(form, data));

      const { answers, signatures } = splitSignatures(form, data.values);
      try {
        const saved = await Inspection.create({
          inspectionId,
          createdBy: userId,
          formId: form.id,
          templateVersion: form.version,
          summaryId: answers[form.primaryIdKey],
          checklist: form.checklist.map(({ id, label }) => ({ id, label, checked: data.checklist[id] })),
          values: answers,
          signatures,
          pdfStoragePath,
          idempotencyKey,
          auditLog: [{ action: 'created' }],
        });
        return { inspection: saved.toObject(), isDuplicate: false };
      } catch (error) {
        await storage.remove(pdfStoragePath).catch((e) => logger.error('Could not clean up PDF', e.message));

        // Two identical requests raced: return the winner instead of failing.
        if (error.code === DUPLICATE_KEY_ERROR && idempotencyKey) {
          const winner = await findByIdempotencyKey(userId, idempotencyKey);
          if (winner) return { inspection: winner, isDuplicate: true };
        }
        throw error;
      }
    },

    async list(userId, { page, limit, formId }) {
      const filter = { createdBy: userId, ...(formId && { formId }) };
      const [inspections, total] = await Promise.all([
        Inspection.find(filter)
          .select(LIST_PROJECTION)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Inspection.countDocuments(filter),
      ]);
      return { inspections, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
    },

    get: findOwnedOrFail,

    getPdf,

    async remove(userId, inspectionId) {
      const inspection = await findOwnedOrFail(userId, inspectionId);
      await Inspection.deleteOne(owned(userId, inspectionId));
      await storage.remove(inspection.pdfStoragePath).catch((e) => logger.error('Could not delete PDF', e.message));
    },

    async sendEmail(userId, inspectionId, recipientEmail) {
      if (!isAllowedRecipient(recipientEmail, allowedEmailDomains)) {
        throw new APIError('Recipient email domain is not allowed', 403);
      }

      const { inspection, pdf } = await getPdf(userId, inspectionId);
      try {
        const result = await emailer.sendInspectionReport({
          to: recipientEmail,
          form: getForm(inspection.formId),
          inspection,
          pdf,
        });
        await Inspection.updateOne(owned(userId, inspectionId), {
          $push: { auditLog: { action: 'emailed', details: recipientEmail } },
        });
        return result;
      } catch (error) {
        logger.error('Email delivery failed:', error.message);
        throw new APIError('The email could not be sent. Please try again later.', 502);
      }
    },

    async stats(userId) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [total, thisMonth, thisWeek] = await Promise.all([
        Inspection.countDocuments({ createdBy: userId }),
        Inspection.countDocuments({ createdBy: userId, createdAt: { $gte: startOfMonth } }),
        Inspection.countDocuments({ createdBy: userId, createdAt: { $gte: startOfWeek } }),
      ]);
      return { total, thisMonth, thisWeek };
    },
  };
};

module.exports = { createInspectionService };
