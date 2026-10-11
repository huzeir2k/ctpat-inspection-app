const { defineForm } = require('../defineForm');
const { text, passedCheck, freightBillField, crossDockFields, sealFields, vvttField, signoffFields, SECTIONS } = require('../fields');
const { textOnLine, checkAt, checkOptions, circleOptions, signatureOnLine, ringAround, freightBillLayout } = require('../layout');

// Layout numbers come from the template: truck-trailer-17-18.pdf (612 x 792 pt).
const CROSS_DOCK_ROW_CENTER = 557.3;

module.exports = defineForm({
  id: 'truck-trailer-17-18',
  label: '17/18-Point Truck & Trailer',
  title: '17/18 - POINT TRUCK & TRAILER SECURITY & AGRICULTURAL (PEST) INSPECTION FORM',
  template: 'truck-trailer-17-18.pdf',
  version: 2,
  primaryIdKey: 'truckTrailerNumbers',

  checklist: [
    { id: 'bumper-tires-rims', label: 'Bumper/Tires/Rims' },
    { id: 'engine-battery-box', label: 'Engine/Battery Box' },
    { id: 'tires-truck-trailer', label: 'Tires (truck & trailer)' },
    { id: 'floor-truck', label: 'Floor' },
    { id: 'fuel-tanks', label: 'Fuel Tanks' },
    { id: 'interior-cab-sleeper', label: 'Interior Cab Compartments/Sleeper' },
    { id: 'air-breather', label: 'Air Breather' },
    { id: 'fairing-roof', label: 'Faring/Roof' },
    { id: 'fifth-wheel-skid-plate', label: 'Fifth Wheel/Skid Plate' },
    { id: 'outside-undercarriage', label: 'Outside/Undercarriage' },
    { id: 'floor-trailer', label: 'Floor' },
    { id: 'inside-outside-doors', label: 'Inside/Outside Doors' },
    { id: 'side-walls', label: 'Side Walls (Left/Right)' },
    { id: 'ceiling-roof', label: 'Ceiling/Roof' },
    { id: 'front-wall-exterior', label: 'Front Wall/Exterior Front/Sides' },
    { id: 'refrigeration-unit', label: 'Refrigeration Unit' },
    { id: 'rear-bumper-doors', label: 'Rear (Bumper/Doors)' },
    {
      id: 'agricultural-pests',
      label: 'Agricultural pests and debris',
      description:
        'Check for agricultural pests and debris in all points. Also check areas of refrigerated trailers that have an air intake, fan housing, refrigeration unit, etc. These locations must also be checked for debris, nest pods, insects, etc.',
    },
  ],

  fields: [
    freightBillField(),
    ...crossDockFields(),
    text('truckTrailerNumbers', 'Truck/Trailer Numbers', { section: SECTIONS.IDENTIFICATION }),
    ...sealFields(),
    passedCheck('securityPassed', 'Security Check – Passed'),
    passedCheck('agriculturalPassed', 'Agricultural/Pest Check – Passed'),
    vvttField(),
    ...signoffFields(),
  ],

  layout: {
    checklistX: 39.2,
    checklistRows: [215.2, 229.0, 242.7, 256.3, 270.0, 283.7, 310.6, 324.4, 338.0, 351.7, 365.4, 379.1, 392.9, 406.5, 420.2, 447.1, 460.8, 473.5],
    fields: {
      freightBillNumber: freightBillLayout(),
      crossDock: circleOptions({
        yes: ringAround(91.4, 105.6, CROSS_DOCK_ROW_CENTER),
        no: ringAround(117.0, 129.0, CROSS_DOCK_ROW_CENTER),
      }),
      crossDockDirection: circleOptions({
        into_us: ringAround(140.4, 175.9, CROSS_DOCK_ROW_CENTER),
        into_mexico: ringAround(189.5, 239.0, CROSS_DOCK_ROW_CENTER),
      }),
      truckTrailerNumbers: textOnLine(138, 585.5, 400),
      sealNumber: textOnLine(97, 606.6, 200),
      sealVerifiedByName: textOnLine(207, 627.8, 145),
      sealVerifiedBySignature: signatureOnLine(401, 627.8, 145),
      securityPassed: checkAt(41.2, 642.1),
      agriculturalPassed: checkAt(40.8, 662.7),
      vvtt: checkOptions({
        passed: { x: 40.8, y: 683.4 },
        na_domestic: { x: 289.8, y: 684.2 },
      }),
      date: textOnLine(62, 712.4, 43),
      time: textOnLine(135, 712.4, 58),
      printName: textOnLine(250, 712.4, 135),
      inspectorSignature: signatureOnLine(436, 712.4, 100),
    },
  },
});
