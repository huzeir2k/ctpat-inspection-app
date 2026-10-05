/**
 * Helpers that describe WHERE a value is printed on a form template.
 *
 * Coordinates are in PDF points, measured from the TOP-LEFT corner of the
 * page (the same system `pdftotext -bbox` reports), which makes them easy to
 * read off a template. The renderer converts them to PDF's bottom-left origin.
 */

// Distance from the bottom of a text row's bounding box to the text baseline.
// Keeps typed text sitting just above the printed underline.
const BASELINE_OFFSET = 4.5;

/** Single-line text printed after a label. `rowBottom` is the label row's bottom edge. */
const textOnLine = (x, rowBottom, maxWidth) => ({
  kind: 'text',
  x,
  y: rowBottom - BASELINE_OFFSET,
  maxWidth,
});

/** An X drawn inside a checkbox whose centre is (x, y). */
const checkAt = (x, y) => ({ kind: 'check', x, y });

/** One checkbox per choice option, e.g. VVTT "Passed" / "N/A". */
const checkOptions = (options) => ({ kind: 'checkOptions', options });

/** An ellipse drawn around a printed word, e.g. Cross-Dock "Yes" / "No". */
const circleOptions = (options) => ({ kind: 'circleOptions', options });

/** A signature (image or typed text) whose bottom-left corner sits on a signature line. */
const signatureOnLine = (x, rowBottom, width, height = 20) => ({
  kind: 'signature',
  x,
  y: rowBottom - 2,
  width,
  height,
});

/** The ellipse around a word spanning [xStart, xEnd] on a row centred at `y`. */
const ringAround = (xStart, xEnd, y) => ({
  cx: (xStart + xEnd) / 2,
  cy: y,
  rx: (xEnd - xStart) / 2 + 1,
  ry: 8,
});

module.exports = {
  textOnLine,
  checkAt,
  checkOptions,
  circleOptions,
  signatureOnLine,
  ringAround,
};
