const { defineForm } = require('../defineForm');
const { text, passedCheck, crossDockFields, sealFields, vvttField, signoffFields, SECTIONS } = require('../fields');
const { textOnLine, checkAt, checkOptions, circleOptions, signatureOnLine, ringAround } = require('../layout');

// Layout numbers come from the template: container-7-8.pdf (612 x 792 pt).
const CROSS_DOCK_ROW_CENTER = 527.5;

module.exports = defineForm({
  id: 'container-7-8',
  label: '7/8-Point Container',
  title: '7/8 - POINT CONTAINER SECURITY & AGRICULTURAL (PEST) INSPECTION FORM',
  template: 'container-7-8.pdf',
  version: 1,
  primaryIdKey: 'containerNumber',

  checklist: [
    { id: 'outside-undercarriage', label: 'Outside/Undercarriage' },
    { id: 'inside-outside-doors', label: 'Inside/Outside Doors' },
    { id: 'right-side', label: 'Right Side' },
    { id: 'left-side', label: 'Left Side' },
    { id: 'front-wall', label: 'Front Wall' },
    { id: 'ceiling-roof', label: 'Ceiling/Roof' },
    { id: 'floor', label: 'Floor' },
    {
      id: 'agricultural-pests',
      label: 'Agricultural pests and debris',
      description:
        'Check for agricultural pests and debris in all points. Also check areas of refrigerated containers that have an air intake, fan housing, refrigeration unit, etc. These locations must also be checked for debris, nest pods, insects, etc.',
    },
  ],

  fields: [
    ...crossDockFields(),
    text('containerNumber', 'Container Number', { section: SECTIONS.IDENTIFICATION, maxLength: 20 }),
    ...sealFields(),
    passedCheck('securityPassed', 'Security Check – Passed'),
    passedCheck('agriculturalPassed', 'Agricultural/Pest Check – Passed'),
    vvttField(),
    ...signoffFields(),
  ],

  layout: {
    checklistX: 39.2,
    checklistRows: [244.9, 265.7, 286.5, 307.2, 328.0, 348.7, 369.4, 390.1],
    fields: {
      crossDock: circleOptions({
        yes: ringAround(91.4, 105.6, CROSS_DOCK_ROW_CENTER),
        no: ringAround(117.0, 129.0, CROSS_DOCK_ROW_CENTER),
      }),
      crossDockDirection: circleOptions({
        into_us: ringAround(140.4, 175.9, CROSS_DOCK_ROW_CENTER),
        into_mexico: ringAround(189.5, 239.0, CROSS_DOCK_ROW_CENTER),
      }),
      containerNumber: textOnLine(120, 555.6, 175),
      sealNumber: textOnLine(97, 576.7, 200),
      sealVerifiedByName: textOnLine(207, 597.8, 145),
      sealVerifiedBySignature: signatureOnLine(401, 597.8, 145),
      securityPassed: checkAt(41.2, 612.3),
      agriculturalPassed: checkAt(40.8, 632.8),
      vvtt: checkOptions({
        passed: { x: 40.8, y: 653.6 },
        na_domestic: { x: 284.6, y: 654.3 },
      }),
      date: textOnLine(62, 703.8, 48),
      time: textOnLine(140, 703.8, 58),
      printName: textOnLine(257, 703.8, 135),
      inspectorSignature: signatureOnLine(443, 703.8, 100),
    },
  },
});
