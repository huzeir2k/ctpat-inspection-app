/**
 * Request Validation Schemas
 * Using Joi for runtime validation
 */

const joi = require('joi');

const inspectionSchema = joi.object({
  truckNumber: joi.string().required().max(50),
  trailerNumber: joi.string().max(50),
  sealNumber: joi.string().max(50),
  verifiedByName: joi.string().max(100),
  printName: joi.string().max(100),
  date: joi.string().max(20),
  time: joi.string().max(20),
  securityCheckboxChecked: joi.boolean().default(false),
  agriculturalPestCheckboxChecked: joi.boolean().default(false),
  recipientEmail: joi.string().email().optional(),
  inspectionPoints: joi.array().items(
    joi.object({
      id: joi.string(),
      label: joi.string(),
      checked: joi.boolean(),
    })
  ).required(),
  completionPercentage: joi.number().min(0).max(100),
});

const listInspectionsSchema = joi.object({
  page: joi.number().min(1).default(1),
  limit: joi.number().min(1).max(100).default(50),
  status: joi.string().valid('draft', 'submitted', 'archived'),
  sortBy: joi.string().valid('createdAt', 'date', 'truckNumber').default('createdAt'),
  sortOrder: joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  inspectionSchema,
  listInspectionsSchema,
};
