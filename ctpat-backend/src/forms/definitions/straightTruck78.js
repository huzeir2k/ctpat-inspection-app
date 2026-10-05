const { defineForm } = require('../defineForm');
const { passedCheck, sealFields, vvttField, signoffFields } = require('../fields');
const { textOnLine, checkAt, checkOptions, signatureOnLine } = require('../layout');

// Layout numbers come from the template: straight-truck-7-8.pdf (612 x 792 pt).
// It prints no vehicle number, so the seal number identifies the record.
module.exports = defineForm({
  id: 'straight-truck-7-8',
  label: '7/8-Point Straight Truck',
  title: '7/8 - POINT STRAIGHT TRUCK SECURITY & AGRICULTURAL (PEST) INSPECTION FORM',
  template: 'straight-truck-7-8.pdf',
  version: 1,
  primaryIdKey: 'sealNumber',

  checklist: [
    { id: 'front-wall-bulkhead', label: 'Front Wall/Bulkhead' },
    { id: 'left-side-wall', label: 'Left Side Wall' },
    { id: 'right-side-wall', label: 'Right Side Wall' },
    { id: 'floor', label: 'Floor' },
    { id: 'ceiling-roof', label: 'Ceiling/Roof' },
    { id: 'doors', label: 'Doors (Rear Door/Side Door)' },
    { id: 'outside-undercarriage', label: 'Outside/Undercarriage' },
    { id: 'agricultural-pests', label: 'Agricultural pests and debris', description: 'Check for agricultural pests and debris in all points.' },
  ],

  fields: [
    ...sealFields(),
    passedCheck('securityPassed', 'Security Check – Passed'),
    passedCheck('agriculturalPassed', 'Agricultural/Pest Check – Passed'),
    vvttField(),
    ...signoffFields(),
  ],

  layout: {
    checklistX: 39.2,
    checklistRows: [249.9, 270.8, 291.7, 312.6, 333.4, 354.3, 375.2, 396.1],
    fields: {
      sealNumber: textOnLine(103, 550.4, 183),
      sealVerifiedByName: textOnLine(221, 571.7, 135),
      sealVerifiedBySignature: signatureOnLine(407, 571.7, 134),
      securityPassed: checkAt(41.5, 586.8),
      agriculturalPassed: checkAt(40.8, 607.4),
      vvtt: checkOptions({
        passed: { x: 40.8, y: 628.1 },
        na_domestic: { x: 294.2, y: 628.8 },
      }),
      date: textOnLine(64, 677.5, 43),
      time: textOnLine(140, 677.5, 52),
      printName: textOnLine(255, 677.5, 125),
      inspectorSignature: signatureOnLine(435, 677.5, 92),
    },
  },
});
