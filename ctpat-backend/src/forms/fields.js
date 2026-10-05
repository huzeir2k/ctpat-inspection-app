/**
 * Field builders shared by every form definition.
 *
 * A "field" describes one value the inspector provides on the sign-off part of
 * a form. Fields are plain data, so the same definition can drive validation,
 * the PDF renderer and the mobile app.
 *
 * Field types:
 *   text       free text, limited length and character set
 *   date       MM/DD/YYYY
 *   time       HH:mm (24h)
 *   boolean    a "Passed" style checkbox
 *   choice     exactly one of a fixed set of options (radio / circle)
 *   signature  base64 PNG drawn on the device
 */

const SECTIONS = Object.freeze({
  IDENTIFICATION: 'Vehicle Information',
  SEAL: 'Seal Verification',
  CHECKS: 'Compliance Checks',
  SIGNOFF: 'Sign Off',
});

const TEXT_MAX_LENGTH = 60;
const NAME_MAX_LENGTH = 40;
const SEAL_MAX_LENGTH = 30;

const text = (key, label, { section, maxLength = TEXT_MAX_LENGTH } = {}) => ({
  key,
  type: 'text',
  label,
  section,
  required: true,
  maxLength,
});

const date = () => ({
  key: 'date',
  type: 'date',
  label: 'Date',
  section: SECTIONS.SIGNOFF,
  required: true,
});

const time = () => ({
  key: 'time',
  type: 'time',
  label: 'Time',
  section: SECTIONS.SIGNOFF,
  required: true,
});

/** A checkbox that must be ticked before the inspection can be submitted. */
const passedCheck = (key, label) => ({
  key,
  type: 'boolean',
  label,
  section: SECTIONS.CHECKS,
  required: true,
  mustBeTrue: true,
});

const choice = (key, label, options, { section, showWhen } = {}) => ({
  key,
  type: 'choice',
  label,
  section,
  required: true,
  options,
  ...(showWhen && { showWhen }),
});

const signature = (key, label, section) => ({
  key,
  type: 'signature',
  label,
  section,
  required: true,
});

// ---------------------------------------------------------------------------
// Reusable groups of fields. Forms compose these so the differences between
// them stay visible in each definition file.
// ---------------------------------------------------------------------------

/** "Cross-Dock: Yes No  Into U.S. or Into Mexico (Circle)" */
const crossDockFields = () => [
  choice(
    'crossDock',
    'Cross-Dock',
    [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    { section: SECTIONS.IDENTIFICATION }
  ),
  choice(
    'crossDockDirection',
    'Cross-Dock Direction',
    [
      { value: 'into_us', label: 'Into U.S.' },
      { value: 'into_mexico', label: 'Into Mexico' },
    ],
    { section: SECTIONS.IDENTIFICATION, showWhen: { field: 'crossDock', equals: 'yes' } }
  ),
];

/** "Seal Number" and "Seal Application Verified by: Print Name / Signature" */
const sealFields = () => [
  text('sealNumber', 'Seal Number', { section: SECTIONS.IDENTIFICATION, maxLength: SEAL_MAX_LENGTH }),
  text('sealVerifiedByName', 'Seal Verified By (Print Name)', {
    section: SECTIONS.SEAL,
    maxLength: NAME_MAX_LENGTH,
  }),
  signature('sealVerifiedBySignature', 'Seal Verified By (Signature)', SECTIONS.SEAL),
];

/** "VVTT Check (View, Verify, Tug & Twist) - Passed OR N/A - Domestic Transport Only" */
const vvttField = () =>
  choice(
    'vvtt',
    'VVTT Check (View, Verify, Tug & Twist)',
    [
      { value: 'passed', label: 'Passed' },
      { value: 'na_domestic', label: 'N/A – Domestic Transport Only' },
    ],
    { section: SECTIONS.CHECKS }
  );

/** The sign-off line that closes every form. */
const signoffFields = () => [
  date(),
  time(),
  text('printName', 'Print Name', { section: SECTIONS.SIGNOFF, maxLength: NAME_MAX_LENGTH }),
  signature('inspectorSignature', 'Signature', SECTIONS.SIGNOFF),
];

module.exports = {
  SECTIONS,
  text,
  passedCheck,
  crossDockFields,
  sealFields,
  vvttField,
  signoffFields,
};
