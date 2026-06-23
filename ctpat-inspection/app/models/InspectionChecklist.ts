/**
 * Inspection Checklist Models
 * Type definitions and default data for CTPAT inspection forms
 */

/**
 * Inspection point for the checklist
 */
export interface InspectionPoint {
  id: string;
  title: string;
  description: string;
  category: 'general' | 'security' | 'agricultural' | 'structural' | 'seals' | 'documentation';
  checked: boolean;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Inspection form data for sign-off
 */
export interface InspectionForm {
  // Vehicle Information
  truckNumber: string;
  trailerNumber: string;
  sealNumber: string;

  // Seal Verification
  verifiedByName: string;
  verifiedBySignatureId?: string;

  // Additional Information
  date: string;
  time: string;
  printName: string;
  recipientEmail: string;

  // Checkboxes
  securityCheckboxChecked: boolean;
  agriculturalPestCheckboxChecked: boolean;

  // Optional fields
  notes?: string;
}

/**
 * Default inspection checklist items
 */
export const DEFAULT_INSPECTION_POINTS: InspectionPoint[] = [
  {
    id: '1',
    title: 'Cargo Door Integrity',
    description: 'Check for damage, tampering, or deterioration',
    category: 'structural',
    checked: false,
  },
  {
    id: '2',
    title: 'Seals and Locks',
    description: 'Verify all seals and locks are intact and properly secured',
    category: 'seals',
    checked: false,
  },
  {
    id: '3',
    title: 'Floor Condition',
    description: 'Inspect for structural damage, holes, or contamination',
    category: 'structural',
    checked: false,
  },
  {
    id: '4',
    title: 'Documentation Present',
    description: 'Verify required shipping documents are available',
    category: 'documentation',
    checked: false,
  },
  {
    id: '5',
    title: 'Cargo Secured',
    description: 'Confirm cargo is properly secured and does not shift',
    category: 'general',
    checked: false,
  },
  {
    id: '6',
    title: 'Vehicle Cleanliness',
    description: 'Check for pest evidence, contamination, or debris',
    category: 'agricultural',
    checked: false,
  },
  {
    id: '7',
    title: 'Lighting Systems',
    description: 'Verify all lighting equipment is functional',
    category: 'structural',
    checked: false,
  },
  {
    id: '8',
    title: 'Security Device Operational',
    description: 'Confirm security devices are installed and functional',
    category: 'security',
    checked: false,
  },
  {
    id: '9',
    title: 'Registration and Insurance',
    description: 'Check vehicle registration and insurance documentation',
    category: 'documentation',
    checked: false,
  },
  {
    id: '10',
    title: 'Driver Identification',
    description: 'Verify driver identity and credentials',
    category: 'security',
    checked: false,
  },
  {
    id: '11',
    title: 'Roof and Side Panels',
    description: 'Inspect for holes, dents, or signs of tampering',
    category: 'structural',
    checked: false,
  },
  {
    id: '12',
    title: 'Wheel and Tire Condition',
    description: 'Check tires for proper inflation and damage',
    category: 'structural',
    checked: false,
  },
  {
    id: '13',
    title: 'Brake System Operational',
    description: 'Verify brakes are functioning properly',
    category: 'structural',
    checked: false,
  },
  {
    id: '14',
    title: 'Refrigeration Unit (if applicable)',
    description: 'Check temperature control systems are working',
    category: 'general',
    checked: false,
  },
  {
    id: '15',
    title: 'Pest Control Measures',
    description: 'Verify pest prevention and control measures are in place',
    category: 'agricultural',
    checked: false,
  },
  {
    id: '16',
    title: 'Chain of Custody Documentation',
    description: 'Verify chain of custody forms are complete and accurate',
    category: 'documentation',
    checked: false,
  },
  {
    id: '17',
    title: 'Hazmat Compliance',
    description: 'If applicable, verify hazmat placards and documentation',
    category: 'documentation',
    checked: false,
  },
  {
    id: '18',
    title: 'Final Security Verification',
    description: 'Final overall inspection for security and integrity',
    category: 'security',
    checked: false,
  },
];

/**
 * Default form data
 */
export const DEFAULT_FORM_DATA: InspectionForm = {
  truckNumber: '',
  trailerNumber: '',
  sealNumber: '',
  verifiedByName: '',
  verifiedBySignatureId: undefined,
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().split(' ')[0],
  printName: '',
  recipientEmail: '',
  securityCheckboxChecked: false,
  agriculturalPestCheckboxChecked: false,
  notes: '',
};
