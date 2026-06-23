const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Inspection Point Schema
 * Represents a single checklist item in the inspection
 */
const inspectionPointSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  checked: {
    type: Boolean,
    default: false,
  },
});

/**
 * Inspection Schema
 * Represents a complete inspection submission
 */
const inspectionSchema = new mongoose.Schema(
  {
    inspectionId: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    // Vehicle Information
    truckNumber: {
      type: String,
      required: true,
      trim: true,
    },
    trailerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    sealNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Inspection Points
    inspectionPoints: [inspectionPointSchema],

    // Verification Information
    verifiedByName: {
      type: String,
      required: true,
      trim: true,
    },
    verifiedBySignatureId: {
      type: String,
      default: null,
    },

    // Compliance Checks
    securityCheckboxChecked: {
      type: Boolean,
      default: false,
    },
    agriculturalPestCheckboxChecked: {
      type: Boolean,
      default: false,
    },

    // Date & Time
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },

    // Inspector Information
    printName: {
      type: String,
      required: true,
      trim: true,
    },
    inspectorSignatureId: {
      type: String,
      default: null,
    },

    // PDF Information
    pdfStoragePath: {
      type: String,
      default: null,
    },
    pdfPublicUrl: {
      type: String,
      default: null,
    },

    // Metadata
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'archived'],
      default: 'submitted',
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    // Audit trail for compliance and debugging
    auditLog: [
      {
        action: {
          type: String,
          enum: ['created', 'modified', 'status_changed', 'pdf_updated', 'archived'],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        status: String,
        modifiedBy: String,
        details: String,
      },
    ],
    // Idempotency key to prevent duplicate submissions
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
inspectionSchema.index({ truckNumber: 1, createdAt: -1 });
inspectionSchema.index({ completedAt: -1 });
inspectionSchema.index({ status: 1, createdAt: -1 });
inspectionSchema.index({ recipientEmail: 1, status: 1 });
inspectionSchema.index({ idempotencyKey: 1 }, { sparse: true });

// Virtual for completion percentage
inspectionSchema.virtual('completionPercentage').get(function () {
  if (this.inspectionPoints.length === 0) return 0;
  const checked = this.inspectionPoints.filter((p) => p.checked).length;
  return Math.round((checked / this.inspectionPoints.length) * 100);
});

// Ensure virtuals are included in JSON
inspectionSchema.set('toJSON', { virtuals: true });

/**
 * Pre-save middleware to validate inspection data and status transitions
 */
inspectionSchema.pre('save', function (next) {
  const now = new Date();
  
  // Validate that at least some inspection points are checked
  if (this.inspectionPoints && this.inspectionPoints.length === 0) {
    console.warn('Warning: Saving inspection with no checklist items');
  }

  // Validate status transitions
  if (this.isModified('status')) {
    const validTransitions = {
      draft: ['submitted', 'archived'],
      submitted: ['archived'],
      archived: [], // Cannot transition from archived
    };

    // Get previous status from database
    // Note: For new documents, _id doesn't exist yet, so skip validation
    if (this._id) {
      const currentStatus = this.status;
      
      // This is a simplified check - in production, query the DB for the previous state
      // For now, we rely on the route handlers to enforce this
    }
  }

  // Set completedAt timestamp when submitted
  if (this.status === 'submitted' && !this.completedAt) {
    this.completedAt = now;
  }

  // Add audit timestamp
  if (!this.auditLog) {
    this.auditLog = [];
  }

  this.auditLog.push({
    action: this.isNew ? 'created' : 'modified',
    timestamp: now,
    status: this.status,
  });

  next();
});

// Create model
const Inspection = mongoose.model('Inspection', inspectionSchema);

module.exports = Inspection;
