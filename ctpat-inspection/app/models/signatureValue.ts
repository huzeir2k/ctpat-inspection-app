import { SignatureValue } from './InspectionForm';
import { StoredSignature } from '../services/SignatureService';

/** Decodes base64 text that may contain non-ASCII characters. */
const decodeBase64Text = (base64: string): string => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/**
 * Converts a signature saved by the app into the shape the backend expects.
 * "drawn" signatures are really typed text; "uploaded" ones are pictures.
 */
export const toSignatureValue = (signature: StoredSignature): SignatureValue =>
  signature.type === 'uploaded'
    ? { type: 'image', data: signature.base64Data }
    : { type: 'typed', text: decodeBase64Text(signature.base64Data).trim() };

/** Short description shown in the form once a signature is chosen. */
export const describeSignature = (value: SignatureValue): string =>
  value.type === 'typed' ? `Signed: ${value.text}` : 'Signature image added';
