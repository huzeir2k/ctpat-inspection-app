/**
 * PDF Filler Service
 *
 * Fills any registered CTPAT form template using the form's own layout:
 * ticks the checklist, prints text, circles choices and embeds signatures.
 * It knows nothing about specific forms - everything comes from the definition.
 *
 * Output is written for strict PDF readers (e.g. Foxit): a classic
 * cross-reference table (no object streams), only the standard Helvetica font
 * and no interactive content.
 */

const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATE_DIR = path.join(__dirname, '../../assets/forms');

const INK = rgb(0, 0, 0);
const TEXT_SIZE = 10;
const MIN_TEXT_SIZE = 6;
// Half-width and line thickness of the X drawn in each kind of box.
const CHECKLIST_MARK = { halfSize: 2.2, thickness: 1 }; // small checklist boxes
const SIGNOFF_MARK = { halfSize: 4, thickness: 1.2 }; // larger sign-off boxes

const templateCache = new Map();

const loadTemplate = async (form) => {
  if (!templateCache.has(form.id)) {
    templateCache.set(form.id, await fs.readFile(path.join(TEMPLATE_DIR, form.template)));
  }
  return templateCache.get(form.id);
};

/**
 * Draws onto one page using top-left based coordinates (see forms/layout.js).
 */
class PageWriter {
  constructor(pdfDoc, page, font) {
    this.pdfDoc = pdfDoc;
    this.page = page;
    this.font = font;
    this.pageHeight = page.getHeight();
    page.setFont(font); // registered once, so every drawText reuses the same font entry
  }

  /** Converts a top-left based y to PDF's bottom-left based y. */
  flipY(y) {
    return this.pageHeight - y;
  }

  drawCross(cx, cy, { halfSize, thickness }) {
    const options = { thickness, color: INK };
    const top = this.flipY(cy - halfSize);
    const bottom = this.flipY(cy + halfSize);
    this.page.drawLine({ start: { x: cx - halfSize, y: top }, end: { x: cx + halfSize, y: bottom }, ...options });
    this.page.drawLine({ start: { x: cx - halfSize, y: bottom }, end: { x: cx + halfSize, y: top }, ...options });
  }

  drawRing({ cx, cy, rx, ry }) {
    this.page.drawEllipse({
      x: cx,
      y: this.flipY(cy),
      xScale: rx,
      yScale: ry,
      borderColor: INK,
      borderWidth: 1,
    });
  }

  /** Prints text on one line, shrinking it so it never runs past maxWidth. */
  drawFittedText(value, { x, y, maxWidth }) {
    let size = TEXT_SIZE;
    while (size > MIN_TEXT_SIZE && this.font.widthOfTextAtSize(value, size) > maxWidth) {
      size -= 0.25;
    }
    this.page.drawText(value, { x, y: this.flipY(y), size, color: INK });
  }

  /** Embeds a base64 PNG, scaled to fit the box while keeping its proportions. */
  async drawSignature(base64Png, { x, y, width, height }) {
    const image = await this.pdfDoc.embedPng(Buffer.from(base64Png, 'base64'));
    const scale = Math.min(width / image.width, height / image.height);
    this.page.drawImage(image, {
      x,
      y: this.flipY(y),
      width: image.width * scale,
      height: image.height * scale,
    });
  }
}

class PdfFillerService {
  /**
   * @param {object} form - Form definition from src/forms.
   * @param {{checklist: object, values: object}} submission - Validated data.
   * @returns {Promise<Buffer>} The filled PDF.
   */
  async generate(form, { checklist, values }) {
    const pdfDoc = await PDFDocument.load(await loadTemplate(form));
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const writer = new PageWriter(pdfDoc, pdfDoc.getPage(0), font);

    this.fillChecklist(writer, form, checklist);
    for (const field of form.fields) {
      await this.fillField(writer, form.layout.fields[field.key], values[field.key]);
    }

    pdfDoc.setTitle(form.title);
    pdfDoc.setProducer('CTPAT Inspection');
    pdfDoc.setCreator('CTPAT Inspection');

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  fillChecklist(writer, form, checklist) {
    const { checklistX, checklistRows } = form.layout;
    form.checklist.forEach((item, index) => {
      if (checklist[item.id] === true) {
        writer.drawCross(checklistX, checklistRows[index], CHECKLIST_MARK);
      }
    });
  }

  async fillField(writer, layout, value) {
    if (value === undefined || value === null || value === '') return;

    switch (layout.kind) {
      case 'text':
        writer.drawFittedText(String(value), layout);
        break;
      case 'check':
        if (value === true) writer.drawCross(layout.x, layout.y, SIGNOFF_MARK);
        break;
      case 'checkOptions': {
        const box = layout.options[value];
        if (box) writer.drawCross(box.x, box.y, SIGNOFF_MARK);
        break;
      }
      case 'circleOptions': {
        const ring = layout.options[value];
        if (ring) writer.drawRing(ring);
        break;
      }
      case 'image':
        await writer.drawSignature(value, layout);
        break;
      default:
        throw new Error(`Unknown layout kind "${layout.kind}"`);
    }
  }
}

module.exports = new PdfFillerService();
