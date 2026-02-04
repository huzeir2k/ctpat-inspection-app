/**
 * PDF Routes
 * Endpoints for PDF generation and management
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, APIError } = require('../middleware/errorHandler');
const PdfFillerService = require('../services/PdfFillerService');
const { getDatabase } = require('../config/database');

/**
 * POST /api/pdfs/generate
 * Generate a filled PDF from inspection data
 * Returns the PDF as Buffer (can be sent to frontend or saved)
 */
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    try {
      const { inspectionData, inspectionPoints } = req.body;

      if (!inspectionData) {
        throw new APIError('inspectionData is required', 400);
      }
      if (!Array.isArray(inspectionPoints)) {
        throw new APIError('inspectionPoints must be an array', 400);
      }

      console.log('[PDF Route] Generating PDF for truck:', inspectionData.truckNumber);

      // Generate filled PDF
      const pdfBuffer = await PdfFillerService.generateFilledPdf(
        inspectionData,
        inspectionPoints
      );

      // Send PDF as binary
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="inspection-${inspectionData.truckNumber || 'report'}.pdf"`
      );
      res.send(pdfBuffer);

      console.log('✓ PDF generated and sent to client');
    } catch (error) {
      console.error('❌ PDF generation error:', error.message);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to generate PDF',
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * GET /api/pdfs/template-info
 * Get information about the PDF template
 */
router.get(
  '/template-info',
  asyncHandler(async (req, res) => {
    try {
      // Verify template exists by trying to load it
      PdfFillerService.loadPdfTemplate();

      res.json({
        success: true,
        template: {
          name: 'ctpatform.pdf',
          source: 'local-assets',
          status: 'available',
          description: 'CTPAT 17/18-Point Trailer Inspection Form',
        },
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: {
          message: 'PDF template not found',
          statusCode: 404,
        },
      });
    }
  })
);

module.exports = router;
