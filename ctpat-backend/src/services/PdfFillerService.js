/**
 * PDF Filler Service
 * Fills the CTPAT 17/18-Point Trailer Inspection form with inspection data
 * Uses pdf-lib to draw X marks, text, and embed signature images
 */

const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

class PdfFillerService {
  /**
   * Generate a filled PDF by placing X marks and text at specific coordinates, and embedding signatures
   * PDF dimensions: 772.8 x 950.4 points
   * @param {object} inspectionData - Inspection form data (includes signatures)
   * @param {array} inspectionPoints - 18-point checklist items
   * @returns {Buffer} - PDF file buffer
   */
  async generateFilledPdf(inspectionData, inspectionPoints, photos) {
    try {
      // Load the original PDF form
      const pdfPath = path.join(__dirname, '../../assets/ctpatform.pdf');
      const pdfBytes = fs.readFileSync(pdfPath);

      // Load the PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get the first page
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      console.log(`PDF size: ${width} x ${height}`);

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
        y: pdfHeight - (pixelY * scaleY) // Invert Y-axis
      });
      
      const coords = {
        // Top section - 18-point checklist items with variable spacing
        // Converted from pixels to PDF points with float precision
        checklistStartX: 56 * scaleX,      // X position for checkboxes (adjusted for smaller boxes)
        
        // Y positions for each checklist item (inverted for PDF coordinate system)
        checklistYPositions: [
          pdfHeight - (268 * scaleY),   // 1. Bumper/Tires/Rims
          pdfHeight - (284 * scaleY),   // 2. Engine/Battery Box
          pdfHeight - (300 * scaleY),   // 3. Tires (truck & trailer)
          pdfHeight - (317 * scaleY),   // 4. Floor
          pdfHeight - (333 * scaleY),   // 5. Fuel Tanks
          pdfHeight - (349 * scaleY),   // 6. Interior Cab Compartments/Sleeper
          pdfHeight - (381 * scaleY),   // 7. Air Breather
          pdfHeight - (397 * scaleY),   // 8. Faring/Roof
          pdfHeight - (413 * scaleY),   // 9. Fifth Wheel/Plate
          pdfHeight - (429 * scaleY),   // 10. Outside/Undercarriage
          pdfHeight - (445 * scaleY),   // 11. Floor
          pdfHeight - (461 * scaleY),   // 12. Headlights/Outside Doors
          pdfHeight - (478 * scaleY),   // 13. Side Walls (Left/Right)
          pdfHeight - (494 * scaleY),   // 14. Ceiling/Roof
          pdfHeight - (510 * scaleY),   // 15. Front Wall/Exterior Front/Sides
          pdfHeight - (541 * scaleY),   // 16. Refrigeration Unit
          pdfHeight - (558 * scaleY),   // 17. Rear (Bumper/Doors)
          pdfHeight - (574 * scaleY),   // 18. Clean for agricultural pests
        ],
        
        // Bottom section - Inspection Signoff area
        // "Truck/Trailer Numbers:" field
        truckTrailerX: 193 * scaleX,
        truckTrailerY: pdfHeight - (694 * scaleY),
        
        // "Seal Number:" field
        sealNumberX: 149 * scaleX,
        sealNumberY: pdfHeight - (716 * scaleY),

        // "Freight Bill Number" - placed on the Seal Number row, to the
        // right of it (there's no dedicated printed field on the original
        // form for this). Verify placement visually and adjust X/Y as needed.
        freightBillNumberX: 420 * scaleX,
        freightBillNumberY: pdfHeight - (716 * scaleY),
        
        // "Seal Application Verified by: Print Name"
        sealVerifiedNameX: 301 * scaleX,
        sealVerifiedNameY: pdfHeight - (742 * scaleY),
        
        // "Seal Application Verified by: Signature"
        sealVerifiedSigX: 530 * scaleX,
        sealVerifiedSigY: pdfHeight - (743 * scaleY),
        
        // Security Check - Passed checkbox
        securityCheckX: 60 * scaleX,
        securityCheckY: pdfHeight - (773 * scaleY),
        
        // Agricultural/Pest Check - Passed checkbox
        agriculturalCheckX: 60 * scaleX,
        agriculturalCheckY: pdfHeight - (797 * scaleY),
        
        // Date field
        dateX: 96 * scaleX,
        dateY: pdfHeight - (822 * scaleY),
        
        // Time field
        timeX: 197 * scaleX,
        timeY: pdfHeight - (818 * scaleY),
        
        // Print Name field (bottom)
        printNameX: 318 * scaleX,
        printNameY: pdfHeight - (818 * scaleY),
        
        // Signature field (bottom)
        signatureX: 597 * scaleX,
        signatureY: pdfHeight - (808 * scaleY),
      };

      const fontSize = 10;
      const checkFontSize = 12; // X mark font size
      const textColor = rgb(0, 0, 0);
      const checkColor = rgb(0, 0, 0);
      const textBaselineOffset = 3; // Offset for text baseline alignment

      // Draw X marks for 18-point checklist items
      inspectionPoints.forEach((point, index) => {
        if (point && point.checked && index < coords.checklistYPositions.length) {
          const itemY = coords.checklistYPositions[index] - textBaselineOffset;
          
          // Draw X mark in checkbox
          firstPage.drawText('X', {
            x: coords.checklistStartX,
            y: itemY,
            size: checkFontSize,
            color: checkColor,
          });
        }
      });

      // Draw inspection signoff information
      
      // Truck/Trailer Numbers
      if (inspectionData.truckNumber || inspectionData.trailerNumber) {
        const truckTrailerText = `${inspectionData.truckNumber || ''} / ${inspectionData.trailerNumber || ''}`.trim();
        firstPage.drawText(truckTrailerText, {
          x: coords.truckTrailerX,
          y: coords.truckTrailerY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Seal Number
      if (inspectionData.sealNumber) {
        firstPage.drawText(inspectionData.sealNumber, {
          x: coords.sealNumberX,
          y: coords.sealNumberY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Freight Bill Number (drawn beside the Seal Number row; the original
      // form has no dedicated printed field for this)
      if (inspectionData.freightBillNumber) {
        firstPage.drawText(`FB#: ${inspectionData.freightBillNumber}`, {
          x: coords.freightBillNumberX,
          y: coords.freightBillNumberY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Seal Application Verified by: Print Name
      if (inspectionData.verifiedByName) {
        firstPage.drawText(inspectionData.verifiedByName, {
          x: coords.sealVerifiedNameX,
          y: coords.sealVerifiedNameY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Security Check - Passed checkbox
      if (inspectionData.securityCheckboxChecked) {
        firstPage.drawText('X', {
          x: coords.securityCheckX,
          y: coords.securityCheckY - textBaselineOffset,
          size: checkFontSize,
          color: checkColor,
        });
      }

      // Agricultural/Pest Check - Passed checkbox
      if (inspectionData.agriculturalPestCheckboxChecked) {
        firstPage.drawText('X', {
          x: coords.agriculturalCheckX,
          y: coords.agriculturalCheckY - textBaselineOffset,
          size: checkFontSize,
          color: checkColor,
        });
      }

      // Date
      if (inspectionData.date) {
        firstPage.drawText(inspectionData.date, {
          x: coords.dateX,
          y: coords.dateY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Time
      if (inspectionData.time) {
        firstPage.drawText(inspectionData.time, {
          x: coords.timeX,
          y: coords.timeY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Print Name
      if (inspectionData.printName) {
        firstPage.drawText(inspectionData.printName, {
          x: coords.printNameX,
          y: coords.printNameY - textBaselineOffset,
          size: fontSize,
          color: textColor,
        });
      }

      // Embed signatures if available
      if (inspectionData.verifiedBySignature && inspectionData.verifiedBySignature.base64Data) {
        try {
          const verifiedByImage = await pdfDoc.embedPng(
            Buffer.from(inspectionData.verifiedBySignature.base64Data, 'base64')
          );
          const verifiedByImageWidth = 80;
          const verifiedByImageHeight = 40;
          firstPage.drawImage(verifiedByImage, {
            x: coords.sealVerifiedSigX,
            y: coords.sealVerifiedSigY - verifiedByImageHeight + 25,
            width: verifiedByImageWidth,
            height: verifiedByImageHeight,
          });
          console.log('✓ Verified by signature embedded');
        } catch (error) {
          console.warn('Failed to embed verified by signature:', error.message);
        }
      }

      // Embed inspector signature if available
      if (inspectionData.inspectorSignature && inspectionData.inspectorSignature.base64Data) {
        try {
          // Define inspector signature position (bottom right area)
          const inspectorSigX = 550; // Adjusted X position for bottom right
          const inspectorSigY = pdfHeight - (795 * scaleY); // Y position for signature line (moved up 20 points)
          
          const inspectorImage = await pdfDoc.embedPng(
            Buffer.from(inspectionData.inspectorSignature.base64Data, 'base64')
          );
          const inspectorImageWidth = 80;
          const inspectorImageHeight = 40;
          firstPage.drawImage(inspectorImage, {
            x: inspectorSigX,
            y: inspectorSigY - inspectorImageHeight + 5,
            width: inspectorImageWidth,
            height: inspectorImageHeight,
          });
          console.log('✓ Inspector signature embedded');
        } catch (error) {
          console.warn('Failed to embed inspector signature:', error.message);
        }
      }

      // Append one page per captured photo: image on top, caption below.
      // Captions are drawn as separate text on the page (NOT burned into
      // the photo pixels) per the requested design.
      if (Array.isArray(photos) && photos.length > 0) {
        await this.addPhotoPages(pdfDoc, photos, pdfWidth, pdfHeight);
      }

      // Save the filled PDF. useObjectStreams: false avoids compressed
      // cross-reference streams, which some strict PDF readers (e.g. Foxit)
      // are pickier about than lenient browser-based viewers.
      const filledPdfBytes = await pdfDoc.save({ useObjectStreams: false });
      return Buffer.from(filledPdfBytes);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Appends one page per photo to the PDF document: the photo image is
   * drawn near the top of the page, and a caption (timestamp, freight bill
   * number, seal number, load origin/destination, truck/trailer) is drawn
   * as text below it. Captions are never drawn on top of / into the image.
   * @param {PDFDocument} pdfDoc
   * @param {array} photos - array of { base64Data, takenAt, sealNumber, freightBillNumber, loadOrigin, loadDestination, truckNumber, trailerNumber }
   * @param {number} pageWidth
   * @param {number} pageHeight
   */
  async addPhotoPages(pdfDoc, photos, pageWidth, pageHeight) {
    const margin = 36;
    const captionFontSize = 11;
    const captionLineHeight = 16;
    const maxImageWidth = pageWidth - margin * 2;

    for (const photo of photos) {
      if (!photo || !photo.base64Data) continue;

      try {
        const imageBytes = Buffer.from(photo.base64Data, 'base64');

        // Photos captured via the device camera are JPEGs; fall back to
        // PNG in case a different source/format is ever used.
        let embeddedImage;
        try {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } catch (jpgError) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        }

        const captionLines = this.buildPhotoCaptionLines(photo);
        const captionBlockHeight = captionLines.length * captionLineHeight;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Scale the image to fit within the available width/height while
        // preserving aspect ratio, reserving space at the bottom for the caption.
        const maxImageHeight = pageHeight - margin * 2 - captionBlockHeight - 20;
        const scale = Math.min(
          maxImageWidth / embeddedImage.width,
          maxImageHeight / embeddedImage.height,
          1 // never upscale beyond original resolution
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

        // Draw caption below the image
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
   * Builds the caption text lines for a photo page: timestamp, freight bill
   * number, seal number, load origin/destination, and truck/trailer numbers.
   */
  buildPhotoCaptionLines(photo) {
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
}

module.exports = new PdfFillerService();
