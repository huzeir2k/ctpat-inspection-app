const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * One submitted CTPAT inspection of any form type.
 *
 * What was inspected is described by `formId` + `templateVersion` (see
 * src/forms). The checklist keeps a snapshot of the labels so a record stays
 * readable even if a form definition changes later.
 */
const checklistItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    checked: { type: Boolean, required: true },
  },
  { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['created', 'emailed'], required: true },
    at: { type: Date, default: Date.now },
    details: { type: String },
  },
  { _id: false }
);

const inspectionSchema = new mongoose.Schema(
  {
    inspectionId: { type: String, default: uuidv4, unique: true },

    // Supabase user id (JWT `sub`). Every query must filter on it.
    createdBy: { type: String, required: true },

    formId: { type: String, required: true },
    templateVersion: { type: Number, required: true },

    // The number that identifies this record in lists (container / truck / seal number).
    summaryId: { type: String, required: true },

    checklist: { type: [checklistItemSchema], required: true },

    // Text, date, time, checkbox and choice answers. Signatures are kept apart.
    values: { type: mongoose.Schema.Types.Mixed, required: true },

    // Base64 PNGs by field key. Never returned unless explicitly selected.
    signatures: { type: mongoose.Schema.Types.Mixed, select: false },

    pdfStoragePath: { type: String, required: true },

    idempotencyKey: { type: String },
    auditLog: { type: [auditEntrySchema], default: [] },
  },
  { timestamps: true }
);

inspectionSchema.index({ createdBy: 1, createdAt: -1 });
inspectionSchema.index({ createdBy: 1, formId: 1, createdAt: -1 });
// A client-chosen key only has to be unique among that user's own submissions.
inspectionSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Inspection', inspectionSchema);
