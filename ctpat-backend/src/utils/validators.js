const Joi = require('joi');

/**
 * Validation schema for email addresses
 * Ensures emails are properly formatted and from authorized domains
 */
const emailValidation = Joi.string()
  .email({ minDomainSegments: 2 })
  .lowercase()
  .messages({
    'string.email': 'Please provide a valid email address',
  });

/**
 * Schema for creating/updating an inspection
 */
const inspectionSchema = Joi.object({
  truckNumber: Joi.string().trim().required().messages({
    'string.empty': 'Truck number is required',
  }),
  trailerNumber: Joi.string().trim().required().messages({
    'string.empty': 'Trailer number is required',
  }),
  sealNumber: Joi.string().trim().required().messages({
    'string.empty': 'Seal number is required',
  }),
  inspectionPoints: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().required(),
        title: Joi.string().required(),
        description: Joi.string().required(),
        checked: Joi.boolean().required(),
      })
    )
    .required()
    .messages({
      'array.base': 'Inspection points must be an array',
    }),
  verifiedByName: Joi.string().trim().required().messages({
    'string.empty': 'Verified by name is required',
  }),
  verifiedBySignatureId: Joi.string().optional().allow(null),
  securityCheckboxChecked: Joi.boolean().default(false),
  agriculturalPestCheckboxChecked: Joi.boolean().default(false),
  date: Joi.string().required().messages({
    'string.empty': 'Date is required',
  }),
  time: Joi.string().required().messages({
    'string.empty': 'Time is required',
  }),
  printName: Joi.string().trim().required().messages({
    'string.empty': 'Inspector name is required',
  }),
  inspectorSignatureId: Joi.string().optional().allow(null),
  pdfData: Joi.string()
    .optional()
    .allow(null, '')
    .max(52428800) // 50MB in base64 ≈ 37.5MB actual
    .messages({
      'string.base': 'PDF data must be a base64 string',
      'string.max': 'PDF file too large (maximum 50MB)',
    }),
  pdfFileName: Joi.string().optional().allow(null, ''),
  recipientEmail: emailValidation.optional().allow(null, ''),
  notes: Joi.string().optional().allow(''),
});

/**
 * Schema for query parameters (listing inspections)
 */
const listInspectionsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string()
    .valid('draft', 'submitted', 'archived')
    .optional()
    .allow(null),
  sortBy: Joi.string()
    .valid('createdAt', 'completedAt', 'truckNumber')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  inspectionSchema,
  listInspectionsSchema,
};
