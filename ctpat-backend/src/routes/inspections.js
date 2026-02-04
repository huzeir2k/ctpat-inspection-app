const express = require('express');
const router = express.Router();
const Inspection = require('../models/Inspection');
const {
  asyncHandler,
  validateRequest,
  APIError,
} = require('../middleware/errorHandler');
const {
  uploadPDFToStorage,
  deletePDFFromStorage,
} = require('../config/supabase');
const { inspectionSchema, listInspectionsSchema } = require('../utils/validators');
const PdfFillerService = require('../services/PdfFillerService');

/**
 * Helper function to validate status transitions
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    draft: ['submitted', 'archived'],
    submitted: ['archived'],
    archived: [], // Terminal state
  };

  if (currentStatus === newStatus) {
    return true; // Allow no-op transitions
  }

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

/**
 * Helper function to check for duplicate submissions
 */
const checkDuplicateSubmission = async (idempotencyKey) => {
  if (!idempotencyKey) {
    return null;
  }

  return await Inspection.findOne({ idempotencyKey });
};

/**
 * POST /api/inspections/generate-pdf
 * Generate a filled CTPAT form PDF with inspection data
 * Returns the PDF as binary data
 */
router.post(
  '/generate-pdf',
  asyncHandler(async (req, res) => {
    const { inspectionData, inspectionPoints } = req.body;

    if (!inspectionData || !inspectionPoints) {
      throw new APIError('inspectionData and inspectionPoints are required', 400);
    }

    try {
      // Generate filled PDF
      const pdfBuffer = await PdfFillerService.generateFilledPdf(
        inspectionData,
        inspectionPoints
      );

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="CTPAT_Inspection_${inspectionData.truckNumber}_${new Date().getTime()}.pdf"`
      );

      // Send PDF buffer
      res.send(pdfBuffer);
      console.log('✓ PDF generated and sent to client');
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new APIError(`Failed to generate PDF: ${error.message}`, 500);
    }
  })
);

/**
 * POST /api/inspections/download-pdf
 * Download a preview of the generated PDF (for testing)
 * Same as /generate-pdf but with attachment headers for download
 */
router.post(
  '/download-pdf',
  asyncHandler(async (req, res) => {
    const { inspectionData, inspectionPoints } = req.body;

    if (!inspectionData || !inspectionPoints) {
      throw new APIError('inspectionData and inspectionPoints are required', 400);
    }

    try {
      // Generate filled PDF
      const pdfBuffer = await PdfFillerService.generateFilledPdf(
        inspectionData,
        inspectionPoints
      );

      // Set response headers for download/preview
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="CTPAT_Inspection_${inspectionData.truckNumber}_${new Date().getTime()}.pdf"`
      );

      // Send PDF
      res.send(pdfBuffer);
      console.log(`✓ PDF preview generated for truck ${inspectionData.truckNumber}`);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      throw new APIError(`Failed to generate PDF: ${error.message}`, 500);
    }
  })
);

/**
 * POST /api/inspections
 * Create a new inspection submission
 * Supports idempotency via Idempotency-Key header
 */
router.post(
  '/',
  validateRequest(inspectionSchema),
  asyncHandler(async (req, res) => {
    const inspectionData = req.validatedBody;
    const idempotencyKey = req.headers['idempotency-key'];

    // Check for duplicate submission
    if (idempotencyKey) {
      const existingInspection = await checkDuplicateSubmission(idempotencyKey);
      if (existingInspection) {
        return res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Duplicate submission detected. Returning existing record.',
          data: {
            inspectionId: existingInspection.inspectionId,
            truckNumber: existingInspection.truckNumber,
            trailerNumber: existingInspection.trailerNumber,
            completedAt: existingInspection.completedAt,
            pdfUrl: existingInspection.pdfPublicUrl,
            completionPercentage: existingInspection.completionPercentage,
          },
        });
      }
    }

    // Upload PDF to Supabase Storage if provided
    let pdfStoragePath = null;
    let pdfPublicUrl = null;

    if (inspectionData.pdfData && inspectionData.pdfFileName) {
      try {
        const buffer = Buffer.from(inspectionData.pdfData, 'base64');
        const uploadResult = await uploadPDFToStorage(
          inspectionData.pdfFileName,
          buffer
        );
        pdfStoragePath = uploadResult.path;
        pdfPublicUrl = uploadResult.publicUrl;
        console.log(`✓ PDF uploaded: ${pdfStoragePath}`);
      } catch (error) {
        console.error('Error uploading PDF:', error);
        throw new APIError('Failed to upload PDF file', 500);
      }
    }

    // Create new inspection document
    const inspection = new Inspection({
      ...inspectionData,
      pdfStoragePath,
      pdfPublicUrl,
      idempotencyKey,
      status: 'submitted',
    });

    // Save to MongoDB
    const savedInspection = await inspection.save();

    res.status(201).json({
      success: true,
      data: {
        inspectionId: savedInspection.inspectionId,
        truckNumber: savedInspection.truckNumber,
        trailerNumber: savedInspection.trailerNumber,
        completedAt: savedInspection.completedAt,
        pdfUrl: pdfPublicUrl,
        completionPercentage: savedInspection.completionPercentage,
        status: savedInspection.status,
      },
    });
  })
);

/**
 * GET /api/inspections
 * List all inspections with pagination
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { error, value } = require('../utils/validators').listInspectionsSchema
      .validate(req.query);

    if (error) {
      throw new APIError(`Invalid query parameters: ${error.message}`, 400);
    }

    const { page, limit, status, sortBy, sortOrder } = value;
    const skip = (page - 1) * limit;

    // Build query filter
    const filter = {};
    if (status) filter.status = status;

    // Build sort order
    const sortObject = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .sort(sortObject)
        .skip(skip)
        .limit(limit)
        .lean(),
      Inspection.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        inspections,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

/**
 * GET /api/inspections/:id
 * Get a specific inspection by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const inspection = await Inspection.findOne({
      inspectionId: req.params.id,
    });

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    res.json({
      success: true,
      data: inspection,
    });
  })
);

/**
 * PUT /api/inspections/:id
 * Update an inspection
 * Validates status transitions
 */
router.put(
  '/:id',
  validateRequest(inspectionSchema),
  asyncHandler(async (req, res) => {
    const inspectionData = req.validatedBody;

    const inspection = await Inspection.findOne({
      inspectionId: req.params.id,
    });

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    // Validate status transition if status is being changed
    if (inspectionData.status && inspectionData.status !== inspection.status) {
      if (!validateStatusTransition(inspection.status, inspectionData.status)) {
        throw new APIError(
          `Invalid status transition from '${inspection.status}' to '${inspectionData.status}'`,
          400
        );
      }
    }

    // Handle PDF update
    if (inspectionData.pdfData && inspectionData.pdfFileName) {
      try {
        // Delete old PDF if exists
        if (inspection.pdfStoragePath) {
          await deletePDFFromStorage(inspection.pdfStoragePath);
        }

        // Upload new PDF
        const buffer = Buffer.from(inspectionData.pdfData, 'base64');
        const uploadResult = await uploadPDFToStorage(
          inspectionData.pdfFileName,
          buffer
        );
        inspectionData.pdfStoragePath = uploadResult.path;
        inspectionData.pdfPublicUrl = uploadResult.publicUrl;

        // Add audit entry for PDF update
        if (!inspection.auditLog) inspection.auditLog = [];
        inspection.auditLog.push({
          action: 'pdf_updated',
          timestamp: new Date(),
          details: `PDF updated: ${uploadResult.path}`,
        });
      } catch (error) {
        console.error('Error updating PDF:', error);
        throw new APIError('Failed to update PDF file', 500);
      }
    }

    // Update inspection
    Object.assign(inspection, inspectionData);
    const updatedInspection = await inspection.save();

    res.json({
      success: true,
      data: {
        inspectionId: updatedInspection.inspectionId,
        truckNumber: updatedInspection.truckNumber,
        trailerNumber: updatedInspection.trailerNumber,
        completedAt: updatedInspection.completedAt,
        pdfUrl: updatedInspection.pdfPublicUrl,
        completionPercentage: updatedInspection.completionPercentage,
        status: updatedInspection.status,
      },
    });
  })
);

/**
 * DELETE /api/inspections/:id
 * Delete an inspection and its PDF
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const inspection = await Inspection.findOne({
      inspectionId: req.params.id,
    });

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    // Delete PDF from Supabase if exists
    if (inspection.pdfStoragePath) {
      try {
        await deletePDFFromStorage(inspection.pdfStoragePath);
        console.log(`✓ Deleted PDF: ${inspection.pdfStoragePath}`);
      } catch (error) {
        console.error('Error deleting PDF from storage:', error);
        // Continue with inspection deletion even if PDF delete fails
      }
    }

    // Delete inspection from MongoDB
    await Inspection.deleteOne({ inspectionId: req.params.id });

    res.json({
      success: true,
      message: `Inspection ${req.params.id} deleted successfully`,
    });
  })
);

/**
 * POST /api/inspections/:id/send-email
 * Send inspection report via email with PDF attachment
 * Generates PDF from inspection data and sends via email
 */
router.post(
  '/:id/send-email',
  asyncHandler(async (req, res) => {
    const { 
      recipientEmail,
      inspectionData,
      inspectionPoints,
      smtpConfig // Optional: { host, port, user, password, fromEmail }
    } = req.body;

    if (!recipientEmail) {
      throw new APIError('Recipient email is required', 400);
    }

    if (!inspectionData || !inspectionPoints) {
      throw new APIError('inspectionData and inspectionPoints are required', 400);
    }

    const inspection = await Inspection.findOne({
      inspectionId: req.params.id,
    });

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    try {
      // Generate PDF with inspection data
      const pdfBuffer = await PdfFillerService.generateFilledPdf(
        inspectionData,
        inspectionPoints
      );

      // Import email service
      const { sendInspectionReport } = require('../services/EmailService');

      // Send email with PDF attachment
      const result = await sendInspectionReport(
        recipientEmail,
        inspection.toObject(),
        Buffer.from(pdfBuffer, 'utf8'), // Convert string buffer to actual buffer
        null, // No pdfUrl since we're attaching the PDF
        smtpConfig
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw new APIError(`Failed to send email: ${error.message}`, 500);
    }
  })
);

/**
 * GET /api/inspections/stats/summary
 * Get inspection statistics
 */
router.get(
  '/stats/summary',
  asyncHandler(async (req, res) => {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [totalCount, thisMonthCount, thisWeekCount] = await Promise.all([
        Inspection.countDocuments(),
        Inspection.countDocuments({ createdAt: { $gte: thisMonth } }),
        Inspection.countDocuments({ createdAt: { $gte: thisWeek } }),
      ]);

      res.json({
        success: true,
        data: {
          total: totalCount,
          thisMonth: thisMonthCount,
          thisWeek: thisWeekCount,
        },
      });
    } catch (error) {
      // MongoDB is offline in development mode - return mock data
      console.warn('⚠️  MongoDB unavailable, returning mock stats');
      res.json({
        success: true,
        isMockData: true,
        data: {
          total: 0,
          thisMonth: 0,
          thisWeek: 0,
        },
      });
    }
  })
);

module.exports = router;
