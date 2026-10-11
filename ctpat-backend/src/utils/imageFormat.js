/** Recognises the image formats accepted for signatures by their leading bytes. */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** @returns {'png' | 'jpeg' | null} */
const detectImageFormat = (base64) => {
  const head = Buffer.from(base64.slice(0, 16), 'base64');
  if (head.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return 'png';
  if (head.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) return 'jpeg';
  return null;
};

module.exports = { detectImageFormat };
