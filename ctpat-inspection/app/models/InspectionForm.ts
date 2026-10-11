/**
 * Inspection form models.
 *
 * The form definitions (checklist items and sign-off fields) are generated
 * from the backend by `npm run forms:export`, so the app has the same forms as
 * the server, works offline, and never needs a hand-written copy.
 */

import generated from './forms.generated.json';

export type FieldType = 'text' | 'date' | 'time' | 'boolean' | 'choice' | 'signature';

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FormField {
  key: string;
  type: FieldType;
  label: string;
  section: string;
  required: boolean;
  maxLength?: number;
  /** Regular expression source the text must match (checked again by the server). */
  pattern?: string;
  options?: FieldOption[];
  mustBeTrue?: boolean;
  /** The field is only asked when another field has this value. */
  showWhen?: { field: string; equals: string };
}

export interface FormDefinition {
  id: string;
  label: string;
  title: string;
  version: number;
  checklist: ChecklistItem[];
  fields: FormField[];
}

/** A signature is either a picture (PNG/JPEG, base64) or typed text. */
export type SignatureValue =
  | { type: 'image'; data: string }
  | { type: 'typed'; text: string };

export type FieldValue = string | boolean | SignatureValue;

/** An inspection being filled in on the device. */
export interface InspectionDraft {
  formId: string;
  checklist: Record<string, boolean>;
  values: Record<string, FieldValue>;
  /** Where to email the finished report. Used by the app only; not printed on the form. */
  recipientEmail: string;
}

export const FORMS: FormDefinition[] = (generated as { forms: FormDefinition[] }).forms;

export const getFormById = (formId: string): FormDefinition | undefined =>
  FORMS.find((form) => form.id === formId);

/** Today's date as MM/DD/YYYY, the format printed on the forms. */
export const formatDate = (now: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
};

/** The time as 24-hour HH:mm. */
export const formatTime = (now: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const createEmptyDraft = (form: FormDefinition, now: Date = new Date()): InspectionDraft => ({
  formId: form.id,
  checklist: Object.fromEntries(form.checklist.map((item) => [item.id, false])),
  values: { date: formatDate(now), time: formatTime(now) },
  recipientEmail: '',
});

/** Whether a field applies given the answers so far (e.g. Cross-Dock direction). */
export const isFieldVisible = (field: FormField, values: Record<string, FieldValue>): boolean =>
  !field.showWhen || values[field.showWhen.field] === field.showWhen.equals;

const isFilled = (field: FormField, value: FieldValue | undefined): boolean => {
  if (value === undefined) return false;
  if (field.type === 'boolean') return field.mustBeTrue ? value === true : true;
  if (field.type === 'signature') return typeof value === 'object';
  return typeof value === 'string' && value.trim().length > 0;
};

/** Labels of everything still missing before the form can be submitted. */
export const getMissingItems = (form: FormDefinition, draft: InspectionDraft): string[] => {
  const missing: string[] = [];

  const unchecked = form.checklist.filter((item) => !draft.checklist[item.id]).length;
  if (unchecked > 0) missing.push(`${unchecked} unchecked checklist item${unchecked === 1 ? '' : 's'}`);

  for (const field of form.fields) {
    if (!field.required || !isFieldVisible(field, draft.values)) continue;
    if (!isFilled(field, draft.values[field.key])) missing.push(field.label);
  }
  return missing;
};

/** The request body for the backend, with hidden fields left out. */
export const toSubmission = (form: FormDefinition, draft: InspectionDraft) => ({
  formId: form.id,
  templateVersion: form.version,
  checklist: draft.checklist,
  values: Object.fromEntries(
    form.fields
      .filter((field) => isFieldVisible(field, draft.values) && draft.values[field.key] !== undefined)
      .map((field) => [field.key, draft.values[field.key]])
  ),
});

/**
 * Applies a saved draft to the current form definition. Items and fields that no
 * longer exist are dropped, and signatures (never saved with drafts) are ignored.
 */
export const reconcileDraft = (form: FormDefinition, saved: Partial<InspectionDraft>): InspectionDraft => {
  const draft = createEmptyDraft(form);
  const fieldsByKey = new Map(form.fields.map((field) => [field.key, field]));

  for (const item of form.checklist) {
    if (saved.checklist?.[item.id] === true) draft.checklist[item.id] = true;
  }
  for (const [key, value] of Object.entries(saved.values ?? {})) {
    const field = fieldsByKey.get(key);
    if (field && field.type !== 'signature') draft.values[key] = value;
  }
  draft.recipientEmail = saved.recipientEmail ?? '';
  return draft;
};
