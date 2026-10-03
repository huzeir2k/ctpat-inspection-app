/**
 * PDF Filler Service
 * Fills the CTPAT 17/18-Point Trailer Inspection form with inspection data
 * Uses pdf-lib to draw X marks, text, and embed signature images
 * 
 * IMPORTANT: This version uses the local PDF template bundled in app assets
 * and maintains the ability to send the filled PDF to the frontend
 */

const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

class PdfFillerService {
  /**
   * Load the PDF template from local assets
   * Template is bundled with the app in assets/ctpatform.pdf
   * @returns {Buffer} - PDF file buffer
   */
  static loadPdfTemplate() {
    try {
      // Path to the bundled PDF template
      const pdfPath = path.join(__dirname, '../../assets/ctpatform.pdf');
      
      if (!fs.existsSync(pdfPath)) {
        console.warn(`⚠️  PDF template not found at: ${pdfPath}`);
        console.warn('    Ensure ctpatform.pdf is bundled in: ctpat-inspection/assets/');
        throw new Error(`PDF template not found: ${pdfPath}`);
      }
      
      const pdfBytes = fs.readFileSync(pdfPath);
      console.log(`✓ PDF template loaded from assets (${pdfBytes.length} bytes)`);
      return pdfBytes;
    } catch (error) {
      console.error('❌ Failed to load PDF template:', error.message);
      throw error;
    }
  }

  /**
   * Generate a filled PDF by placing X marks and text at specific coordinates
   * PDF dimensions: 772.8 x 950.4 points
   * 
   * @param {object} inspectionData - Inspection form data (includes signatures)
   * @param {array} inspectionPoints - 18-point checklist items
   * @returns {Buffer} - Filled PDF file buffer (can be sent to frontend or saved)
   */
  static async generateFilledPdf(inspectionData, inspectionPoints, photos) {
    try {
      // Load the original PDF form from local assets
      const pdfBytes = this.loadPdfTemplate();

      // Load the PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the first page
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      console.log(`[PdfFiller] PDF size: ${width} x ${height}`);

      // Coordinate mappings for the LANDSTAR/CTPAT form
      // Converted from image pixels (751x924) to PDF points (772.8x950.4)
      // Scale factors: X = 772.8/751 = 1.029027, Y = 950.4/924 = 1.028571
      // Y coordinates inverted (PDF origin is bottom-left, image is top-left)
      const imageWidth = 751;
      const imageHeight = 924;
      const pdfWidth = 772.8;
      const pdfHeight = 950.4;
      const scaleX = pdfWidth / imageWidth;
      const scaleY = pdfHeight / imageHeight;

      // Helper function to convert image pixels to PDF points
      const convertCoord = (pixelX, pixelY) => ({
        x: pixelX * scaleX,
        y: pdfHeight - pixelY * scaleY, // Invert Y-axis
      });

      // Coordinate mappings for checklist items and signature areas
      const coords = {
        // Top section - 18-point checklist items
        checklistStartX: 56 * scaleX,
        checklistYPositions: [
          pdfHeight - 268 * scaleY, // 1. Bumper/Tires/Rims
          pdfHeight - 284 * scaleY, // 2. Engine/Battery Box
          pdfHeight - 300 * scaleY, // 3. Tires (truck & trailer)
          pdfHeight - 317 * scaleY, // 4. Floor
          pdfHeight - 333 * scaleY, // 5. Fuel Tanks
          pdfHeight - 349 * scaleY, // 6. Interior Cab Compartments/Sleeper
          pdfHeight - 381 * scaleY, // 7. Air Breather
          pdfHeight - 397 * scaleY, // 8. Faring/Roof
          pdfHeight - 413 * scaleY, // 9. Fifth Wheel/Plate
          pdfHeight - 429 * scaleY, // 10. Outside/Undercarriage
          pdfHeight - 445 * scaleY, // 11. Floor
          pdfHeight - 461 * scaleY, // 12. Headlights/Outside Doors
          pdfHeight - 478 * scaleY, // 13. Side Walls (Left/Right)
          pdfHeight - 494 * scaleY, // 14. Ceiling/Roof
          pdfHeight - 510 * scaleY, // 15. Front Wall/Exterior Front/Sides
          pdfHeight - 541 * scaleY, // 16. Refrigeration Unit
          pdfHeight - 558 * scaleY, // 17. Rear (Bumper/Doors)
          pdfHeight - 574 * scaleY, // 18. Clean for agricultural pests
        ],

        // Bottom section - Inspection Signoff area
        truckTrailerX: 193 * scaleX,
        truckTrailerY: pdfHeight - 694 * scaleY,

        sealNumberX: 149 * scaleX,
        sealNumberY: pdfHeight - 716 * scaleY,

        // Freight Bill Number - placed beside Seal Number (no dedicated
        // printed field on the original form). Verify/adjust visually.
        freightBillNumberX: 420 * scaleX,
        freightBillNumberY: pdfHeight - 716 * scaleY,

        // Signature areas
        inspectorSignatureX: 100 * scaleX,
        inspectorSignatureY: pdfHeight - 800 * scaleY,
        
        sealVerifiedSigX: 530 * scaleX,
        sealVerifiedSigY: pdfHeight - 743 * scaleY,

        // Checkboxes
        securityCheckX: 60 * scaleX,
        securityCheckY: pdfHeight - 773 * scaleY,

        agriculturalCheckX: 60 * scaleX,
        agriculturalCheckY: pdfHeight - 790 * scaleY,
      };

      // Helper function to draw X mark
      const drawXMark = (x, y, size = 10) => {
        const offset = size / 2;
        firstPage.drawLine({
          start: { x: x - offset, y: y - offset },
          end: { x: x + offset, y: y + offset },
          thickness: 2,
          color: rgb(0, 0, 0),
        });
        firstPage.drawLine({
          start: { x: x - offset, y: y + offset },
          end: { x: x + offset, y: y - offset },
          thickness: 2,
          color: rgb(0, 0, 0),
        });
      };

      // Helper function to draw text
      const drawText = (text, x, y, fontSize = 12) => {
        firstPage.drawText(text, {
          x,
          y,
          size: fontSize,
          color: rgb(0, 0, 0),
        });
      };

      console.log('[PdfFiller] Filling checklist items...');

      // Fill checklist items with X marks
      if (Array.isArray(inspectionPoints) && inspectionPoints.length > 0) {
        inspectionPoints.slice(0, 18).forEach((point, index) => {
          if (point.checked) {
            const yPos = coords.checklistYPositions[index];
            drawXMark(coords.checklistStartX + 8, yPos, 8);
            console.log(`  ✓ Item ${index + 1}: ${point.title || 'N/A'}`);
          }
        });
      }

      console.log('[PdfFiller] Filling inspection details...');

      // Fill truck and trailer numbers
      if (inspectionData.truckNumber) {
        drawText(inspectionData.truckNumber, coords.truckTrailerX, coords.truckTrailerY, 11);
      }
      if (inspectionData.trailerNumber) {
        drawText(inspectionData.trailerNumber, coords.truckTrailerX + 200, coords.truckTrailerY, 11);
      }

      // Fill seal number
      if (inspectionData.sealNumber) {
        drawText(inspectionData.sealNumber, coords.sealNumberX, coords.sealNumberY, 11);
      }

      // Fill freight bill number
      if (inspectionData.freightBillNumber) {
        drawText(`FB#: ${inspectionData.freightBillNumber}`, coords.freightBillNumberX, coords.freightBillNumberY, 11);
      }

      // Draw security check checkbox if checked
      if (inspectionData.securityCheckboxChecked) {
        drawXMark(coords.securityCheckX, coords.securityCheckY, 6);
      }

      // Draw agricultural/pest check checkbox if checked
      if (inspectionData.agriculturalPestCheckboxChecked) {
        drawXMark(coords.agriculturalCheckX, coords.agriculturalCheckY, 6);
      }

      // Draw signatures if available
      // Note: Signature handling would require embedding image data
      // For now, just note that signatures should be added here
      if (inspectionData.inspectorSignature) {
        // TODO: Embed signature image at inspectorSignatureX, inspectorSignatureY
        console.log('[PdfFiller] Inspector signature present (image embedding not yet implemented)');
      }

      if (inspectionData.verifiedBySignature) {
        // TODO: Embed verified-by signature image
        console.log('[PdfFiller] Verified-by signature present (image embedding not yet implemented)');
      }

      // Serialize PDF to bytes. useObjectStreams: false avoids compressed
      // cross-reference streams, which some strict PDF readers (e.g. Foxit)
      // are pickier about than lenient browser-based viewers.
      // Append one page per captured photo: image on top, caption below
      // (caption is drawn as separate text, never burned into the image).
      if (Array.isArray(photos) && photos.length > 0) {
        await this.addPhotoPages(pdfDoc, photos, pdfWidth, pdfHeight);
      }

      const filledPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      console.log(`✓ PDF generated successfully (${filledPdfBytes.length} bytes)`);

      return filledPdfBytes;
    } catch (error) {
      console.error('❌ Failed to generate filled PDF:', error.message);
      throw error;
    }
  }

  /**
   * Appends one page per photo to the PDF document: the photo image is
   * drawn near the top of the page, and a caption (timestamp, freight bill
   * number, seal number, load origin/destination, truck/trailer) is drawn
   * as text below it.
   * @param {PDFDocument} pdfDoc
   * @param {array} photos
   * @param {number} pageWidth
   * @param {number} pageHeight
   */
  static async addPhotoPages(pdfDoc, photos, pageWidth, pageHeight) {
    const margin = 36;
    const captionFontSize = 11;
    const captionLineHeight = 16;
    const maxImageWidth = pageWidth - margin * 2;

    for (const photo of photos) {
      if (!photo || !photo.base64Data) continue;

      try {
        const imageBytes = Buffer.from(photo.base64Data, 'base64');

        let embeddedImage;
        try {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } catch (jpgError) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        }

        const captionLines = this.buildPhotoCaptionLines(photo);
        const captionBlockHeight = captionLines.length * captionLineHeight;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const maxImageHeight = pageHeight - margin * 2 - captionBlockHeight - 20;
        const scale = Math.min(
          maxImageWidth / embeddedImage.width,
          maxImageHeight / embeddedImage.height,
          1
        );
        const drawWidth = embeddedImage.width * scale;
        const drawHeight = embeddedImage.height * scale;
        const imageX = (pageWidth - drawWidth) / 2;
        const imageY = pageHeight - margin - drawHeight;

        page.drawImage(embeddedImage, {
          x: imageX,
          y: imageY,
          width: drawWidth,
          height: drawHeight,
        });

        let captionY = imageY - 24;
        captionLines.forEach((line) => {
          page.drawText(line, {
            x: margin,
            y: captionY,
            size: captionFontSize,
            color: rgb(0, 0, 0),
          });
          captionY -= captionLineHeight;
        });

        console.log('✓ Added photo page to PDF');
      } catch (error) {
        console.warn('Failed to embed photo page:', error.message);
      }
    }
  }

  /**
   * Builds the caption text lines for a photo page.
   */
  static buildPhotoCaptionLines(photo) {
    const lines = [];
    const takenAt = photo.takenAt ? new Date(photo.takenAt) : null;
    lines.push(`Date/Time: ${takenAt ? takenAt.toLocaleString() : 'Unknown'}`);

    if (photo.freightBillNumber) lines.push(`Freight Bill Number: ${photo.freightBillNumber}`);
    if (photo.sealNumber) lines.push(`Seal Number: ${photo.sealNumber}`);
    if (photo.loadOrigin || photo.loadDestination) {
      lines.push(`Load Origin / Destination: ${photo.loadOrigin || '—'} / ${photo.loadDestination || '—'}`);
    }
    if (photo.truckNumber || photo.trailerNumber) {
      lines.push(`Truck/Trailer: ${photo.truckNumber || '—'} / ${photo.trailerNumber || '—'}`);
    }

    return lines;
  }

  /**
   * Generate a filled PDF and save to file system
   * Returns the file path for storage/retrieval
   * 
   * @param {object} inspectionData - Inspection form data
   * @param {array} inspectionPoints - 18-point checklist items
   * @param {string} outputDir - Directory to save PDF (optional)
   * @returns {Promise<string>} - File path to saved PDF
   */
  static async generateAndSavePdf(inspectionData, inspectionPoints, outputDir = './pdfs', photos) {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate filled PDF
      const pdfBytes = await this.generateFilledPdf(inspectionData, inspectionPoints, photos);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `inspection-${inspectionData.truckNumber || 'unknown'}-${timestamp}.pdf`;
      const filepath = path.join(outputDir, filename);

      // Save to file system
      fs.writeFileSync(filepath, pdfBytes);
      console.log(`✓ PDF saved to: ${filepath}`);

      return filepath;
    } catch (error) {
      console.error('❌ Failed to save PDF:', error.message);
      throw error;
    }
  }
}

module.exports = PdfFillerService;
