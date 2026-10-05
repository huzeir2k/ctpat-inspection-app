/**
 * Sample inspection data for the preview script and the tests.
 */

const zlib = require('zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** A transparent 200x60 PNG with a wavy "signature" stroke, as base64. */
const sampleSignaturePng = () => {
  const width = 200;
  const height = 60;
  const raw = Buffer.alloc((width * 4 + 1) * height); // each row starts with a filter byte (0)
  for (let x = 10; x < 190; x += 1) {
    const y = Math.round(30 + 18 * Math.sin(x / 9) * Math.cos(x / 31));
    for (let dy = -1; dy <= 1; dy += 1) {
      const offset = (y + dy) * (width * 4 + 1) + 1 + x * 4;
      raw.set([20, 20, 120, 255], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
};

const SAMPLE_TEXT = {
  containerNumber: 'MSKU1234567',
  truckTrailerNumbers: 'T-4821 / TR-90713',
  unitNumber: 'FB-20457',
  sealNumber: 'SL-7788123',
  sealVerifiedByName: 'Maria Gonzalez',
  printName: 'Nandu Peña',
};

/**
 * A complete, valid submission for the given form definition.
 * `optionIndex` picks which option of every choice field is selected.
 */
const sampleSubmission = (form, { optionIndex = 0 } = {}) => {
  const signature = sampleSignaturePng();
  const values = {};
  // Fields that reveal other fields keep their first option so the dependent field applies.
  const controllers = new Set(form.fields.filter((f) => f.showWhen).map((f) => f.showWhen.field));

  for (const field of form.fields) {
    if (field.showWhen) {
      values[field.key] = field.options[optionIndex].value;
      continue;
    }
    switch (field.type) {
      case 'text':
        values[field.key] = SAMPLE_TEXT[field.key] || 'Sample';
        break;
      case 'date':
        values[field.key] = '10/05/2026';
        break;
      case 'time':
        values[field.key] = '14:30';
        break;
      case 'boolean':
        values[field.key] = true;
        break;
      case 'choice':
        values[field.key] = field.options[controllers.has(field.key) ? 0 : optionIndex].value;
        break;
      case 'signature':
        // Alternate between the two kinds so both are exercised.
        values[field.key] =
          optionIndex === 0 || field.key === 'sealVerifiedBySignature'
            ? { type: 'image', data: signature }
            : { type: 'typed', text: 'Nandu Peña' };
        break;
      default:
        throw new Error(`Unhandled field type ${field.type}`);
    }
  }

  return {
    formId: form.id,
    templateVersion: form.version,
    checklist: Object.fromEntries(form.checklist.map((item) => [item.id, true])),
    values,
  };
};

module.exports = { sampleSubmission, sampleSignaturePng };
