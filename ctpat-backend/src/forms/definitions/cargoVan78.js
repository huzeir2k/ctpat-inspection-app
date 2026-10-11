const { defineForm } = require('../defineForm');
const { passedCheck, freightBillField, sealFields, vvttField, signoffFields } = require('../fields');
const { textOnLine, checkAt, checkOptions, signatureOnLine, freightBillLayout } = require('../layout');

// Layout numbers come from the template: cargo-van-7-8.pdf (612 x 792 pt).
// This template has a wider left margin than the others (content starts at x = 72).
// It prints no vehicle number, so the seal number identifies the record.
module.exports = defineForm({
  id: 'cargo-van-7-8',
  label: '7/8-Point Cargo Van',
  title: '7/8 – Point Cargo Van Security & Agricultural (Pest) Inspection Form',
  template: 'cargo-van-7-8.pdf',
  version: 2,
  primaryIdKey: 'sealNumber',

  checklist: [
    { id: 'undercarriage-exterior-underside', label: 'Undercarriage/Exterior Underside' },
    { id: 'doors', label: 'Doors (Rear & Side) – Inside & Outside' },
    { id: 'right-side-exterior', label: 'Right Side Exterior' },
    { id: 'left-side-exterior', label: 'Left Side Exterior' },
    { id: 'front-wall-bulkhead', label: 'Front Wall/Bulkhead (Interior)' },
    { id: 'ceiling-roof', label: 'Ceiling/Roof' },
    { id: 'floor', label: 'Floor (Interior Cargo Area)' },
    { id: 'agricultural-pests', label: 'Agriculture/Pest Inspection (CTPAT & USDA)' },
  ],

  fields: [
    freightBillField(),
    ...sealFields(),
    passedCheck('securityPassed', 'Security Check – Passed'),
    passedCheck('agriculturalPassed', 'Agricultural/Pest Check – Passed'),
    vvttField(),
    ...signoffFields(),
  ],

  layout: {
    checklistX: 75.2,
    checklistRows: [278.8, 299.6, 320.3, 341.0, 361.7, 382.5, 403.2, 424.0],
    fields: {
      freightBillNumber: freightBillLayout(),
      sealNumber: textOnLine(133, 538.1, 198),
      sealVerifiedByName: textOnLine(242, 560.3, 95),
      sealVerifiedBySignature: signatureOnLine(384, 560.3, 95),
      securityPassed: checkAt(77.5, 575.5),
      agriculturalPassed: checkAt(76.9, 596.1),
      vvtt: checkOptions({
        passed: { x: 76.9, y: 618.8 },
        na_domestic: { x: 319.7, y: 619.5 },
      }),
      date: textOnLine(98, 648.8, 48),
      time: textOnLine(176, 648.8, 57),
      printName: textOnLine(292, 648.8, 93),
      inspectorSignature: signatureOnLine(433, 648.8, 88),
    },
  },
});
