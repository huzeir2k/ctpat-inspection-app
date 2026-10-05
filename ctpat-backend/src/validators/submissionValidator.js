/**
 * Builds a Joi schema from a form definition and validates an inspection
 * submission against it. The definition is the only source of truth: unknown
 * checklist items, unknown fields and values of the wrong type are rejected.
 */

const Joi = require('joi');
const { APIError } = require('../middleware/errorHandler');

// Printable Latin-1: the character set the PDF font (WinAnsi) can print.
const PRINTABLE_LATIN1 = /^[\x20-\x7E\u00A0-\u00FF]+$/;
const DATE_FORMAT = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Base64 characters (not bytes) allowed per signature image.
const MAX_SIGNATURE_LENGTH = 200000;

const isRealDate = (value, helpers) => {
  const [month, day, year] = value.split('/').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return valid ? value : helpers.error('any.invalid');
};

const isPng = (value, helpers) =>
  Buffer.from(value.slice(0, 16), 'base64').subarray(0, 8).equals(PNG_MAGIC)
    ? value
    : helpers.error('any.invalid');

/** The Joi schema for one value, ignoring whether it is required. */
const valueSchema = (field) => {
  switch (field.type) {
    case 'text':
      return Joi.string().trim().max(field.maxLength).pattern(PRINTABLE_LATIN1);
    case 'date':
      return Joi.string().pattern(DATE_FORMAT).custom(isRealDate);
    case 'time':
      return Joi.string().pattern(TIME_FORMAT);
    case 'boolean':
      return field.mustBeTrue ? Joi.boolean().strict().valid(true) : Joi.boolean().strict();
    case 'choice':
      return Joi.string().valid(...field.options.map((o) => o.value));
    case 'signature':
      return Joi.string().base64({ paddingRequired: true }).max(MAX_SIGNATURE_LENGTH).custom(isPng);
    default:
      throw new Error(`Unsupported field type "${field.type}"`);
  }
};

const fieldSchema = (field, { complete }) => {
  const schema = valueSchema(field).label(field.label);

  if (field.showWhen) {
    // Only collected when the controlling field has the expected value.
    const { field: controller, equals } = field.showWhen;
    return Joi.any().when(controller, {
      is: equals,
      then: complete ? schema.required() : schema,
      otherwise: Joi.forbidden(),
    });
  }
  return complete && field.required ? schema.required() : schema;
};

const buildSchema = (form, { complete }) => {
  const checklistKeys = {};
  for (const item of form.checklist) {
    const schema = Joi.boolean().strict().label(item.label);
    checklistKeys[item.id] = complete ? schema.valid(true).required() : schema;
  }

  const valueKeys = {};
  for (const field of form.fields) {
    valueKeys[field.key] = fieldSchema(field, { complete });
  }

  return Joi.object({
    formId: Joi.string().valid(form.id).required(),
    templateVersion: Joi.number().valid(form.version).required().messages({
      'any.only': 'This form has been updated. Please update the app.',
    }),
    checklist: Joi.object(checklistKeys).required(),
    values: Joi.object(valueKeys).required(),
  });
};

// Plain-language messages that never echo the submitted value back.
const MESSAGES = {
  'string.pattern.base': '{{#label}} contains unsupported characters or an invalid format',
  'any.only': '{{#label}} is missing or not an allowed value',
  'any.invalid': '{{#label}} is invalid',
  'any.unknown': '{{#label}} is not allowed here',
  'object.unknown': '{{#label}} is not allowed here',
};

const schemaCache = new Map();

const getSchema = (form, complete) => {
  const cacheKey = `${form.id}:${complete}`;
  if (!schemaCache.has(cacheKey)) {
    schemaCache.set(cacheKey, buildSchema(form, { complete }));
  }
  return schemaCache.get(cacheKey);
};

/**
 * Validates a submission body for the given form.
 * @param {object} form - Form definition from src/forms.
 * @param {object} body - Request body.
 * @param {{complete?: boolean}} options - complete=true (default) requires every
 *   checklist item and field; complete=false allows a partial preview.
 * @returns {{checklist: object, values: object}} Sanitised data.
 * @throws {APIError} 400 listing every problem found.
 */
const validateSubmission = (form, body, { complete = true } = {}) => {
  const { error, value } = getSchema(form, complete).validate(body, {
    abortEarly: false,
    errors: { wrap: { label: false } },
    messages: MESSAGES,
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    throw new APIError(`Validation failed: ${details.join('; ')}`, 400, details);
  }
  return { checklist: value.checklist, values: value.values };
};

module.exports = { validateSubmission };
