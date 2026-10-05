const Joi = require('joi');
const { listForms } = require('../forms');
const { APIError } = require('../middleware/errorHandler');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,64}$/;

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  formId: Joi.string().valid(...listForms().map((form) => form.id)),
});

const emailSchema = Joi.object({
  recipientEmail: Joi.string().email({ minDomainSegments: 2 }).lowercase().max(254).required(),
});

const validate = (schema, input, what) => {
  const { error, value } = schema.validate(input, { abortEarly: false, errors: { wrap: { label: false } } });
  if (error) {
    const details = error.details.map((d) => d.message);
    throw new APIError(`Invalid ${what}: ${details.join('; ')}`, 400, details);
  }
  return value;
};

const parseListQuery = (query) => validate(listQuerySchema, query, 'query');
const parseEmailBody = (body) => validate(emailSchema, body, 'request');

/** Returns the id when it is a UUID; otherwise reports "not found" without touching the database. */
const parseInspectionId = (id) => {
  if (!UUID.test(id)) throw new APIError('Inspection not found', 404);
  return id.toLowerCase();
};

/** Returns the key, undefined when absent; throws when malformed. */
const parseIdempotencyKey = (header) => {
  if (header === undefined) return undefined;
  if (!IDEMPOTENCY_KEY.test(header)) {
    throw new APIError('Idempotency-Key must be 8-64 letters, digits, "-" or "_"', 400);
  }
  return header;
};

module.exports = { parseListQuery, parseEmailBody, parseInspectionId, parseIdempotencyKey };
