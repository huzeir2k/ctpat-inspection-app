const { defineForm } = require('../defineForm');
const { text, passedCheck, signoffFields, SECTIONS } = require('../fields');
const { textOnLine, checkAt, signatureOnLine } = require('../layout');

// Layout numbers come from the template: flatbed-6.pdf (612 x 792 pt).
// This form has no seal, Cross-Dock or VVTT section.
module.exports = defineForm({
  id: 'flatbed-6',
  label: '6-Point Flatbed',
  title: '6-POINT FLATBED TRAILER SECURITY & AGRICULTURAL (PEST) INSPECTION FORM',
  template: 'flatbed-6.pdf',
  version: 1,
  primaryIdKey: 'unitNumber',

  checklist: [
    { id: 'outside-undercarriage', label: 'Outside/Undercarriage' },
    { id: 'deck-floor', label: 'Deck/Floor' },
    { id: 'tension-devices', label: 'Tension Devices' },
    { id: 'tailgate', label: 'Tailgate' },
    { id: 'other-components', label: 'Any other component & equipment used for load' },
    { id: 'agricultural-pests', label: 'Agricultural pests and debris', description: 'Check for agricultural pests and debris in all points.' },
  ],

  fields: [
    text('unitNumber', 'Truck/Trailer/IIT Number', { section: SECTIONS.IDENTIFICATION, maxLength: 40 }),
    passedCheck('securityPassed', 'Security Check – Passed'),
    passedCheck('agriculturalPassed', 'Agricultural/Pest Check – Passed'),
    ...signoffFields(),
  ],

  layout: {
    checklistX: 39.2,
    checklistRows: [231.9, 252.6, 273.3, 294.0, 314.8, 347.8],
    fields: {
      unitNumber: textOnLine(149, 566.4, 175),
      securityPassed: checkAt(41.5, 580.8),
      agriculturalPassed: checkAt(40.8, 601.4),
      date: textOnLine(62, 651.1, 47),
      time: textOnLine(140, 651.1, 57),
      printName: textOnLine(257, 651.1, 135),
      inspectorSignature: signatureOnLine(443, 651.1, 100),
    },
  },
});
