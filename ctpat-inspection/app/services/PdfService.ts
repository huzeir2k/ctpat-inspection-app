import * as FileSystem from 'expo-file-system/legacy';
import { InspectionForm, InspectionPoint } from "../models/InspectionChecklist";
import { StoredSignature } from "./SignatureService";
import { StoredPhoto } from "./PhotoService";
import ApiService from './ApiService';
import { Platform } from 'react-native';

export interface PdfGenerationData {
  inspectionPoints: InspectionPoint[];
  formData: InspectionForm;
  inspectorSignature?: StoredSignature | null;
  verifiedBySignature?: StoredSignature | null;
  photos?: StoredPhoto[];
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Manually encode an ArrayBuffer to a base64 string.
 * Implemented by hand (rather than relying on `btoa`/`Buffer`, which are not
 * reliably available in React Native/Hermes) so binary PDF data survives the
 * round trip byte-for-byte. Losing even one byte corrupts the PDF's xref
 * table and stream lengths, which is what made generated PDFs fail to open
 * in strict readers like Foxit.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : undefined;

    result += BASE64_CHARS[byte1 >> 2];
    result += BASE64_CHARS[((byte1 & 0x03) << 4) | (byte2 !== undefined ? byte2 >> 4 : 0)];
    result += byte2 !== undefined
      ? BASE64_CHARS[((byte2 & 0x0f) << 2) | (byte3 !== undefined ? byte3 >> 6 : 0)]
      : '=';
    result += byte3 !== undefined ? BASE64_CHARS[byte3 & 0x3f] : '=';
  }

  return result;
}

/**
 * PDF Service - generates inspection reports
 * Communicates with backend to fill CTPAT form with inspection data
 */
class PdfService {
  /**
   * Generate timestamped filename format: CTPAT_HH:MM_DD/MM/YYYY
   */
  private generateTimestampedFilename(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `CTPAT_${hours}:${minutes}_${day}/${month}/${year}.pdf`;
  }

  /**
   * Generate filled CTPAT PDF from backend
   * Sends inspection data to backend which fills the form and returns PDF
   */
  async generatePdfFromTemplate(data: PdfGenerationData): Promise<string> {
    try {
      const { formData, inspectionPoints, inspectorSignature, verifiedBySignature, photos } = data;

      // Prepare payload for backend
      const payload = {
        inspectionData: {
          truckNumber: formData.truckNumber,
          trailerNumber: formData.trailerNumber,
          sealNumber: formData.sealNumber,
          freightBillNumber: formData.freightBillNumber,
          loadOrigin: formData.loadOrigin || '',
          loadDestination: formData.loadDestination || '',
          date: formData.date,
          time: formData.time,
          printName: formData.printName,
          verifiedByName: formData.verifiedByName,
          securityCheckboxChecked: formData.securityCheckboxChecked,
          agriculturalPestCheckboxChecked: formData.agriculturalPestCheckboxChecked,
          notes: formData.notes || '',
          verifiedBySignature: verifiedBySignature || undefined,
          inspectorSignature: inspectorSignature || undefined,
        },
        inspectionPoints: inspectionPoints.map(point => ({
          id: point.id,
          title: point.title,
          description: point.description,
          checked: point.checked,
        })),
        // Each photo becomes its own appended PDF page (image + caption)
        photos: (photos || []).map(photo => ({
          base64Data: photo.base64Data,
          takenAt: photo.takenAt,
          sealNumber: photo.sealNumber,
          freightBillNumber: photo.freightBillNumber,
          loadOrigin: photo.loadOrigin,
          loadDestination: photo.loadDestination,
          truckNumber: photo.truckNumber,
          trailerNumber: photo.trailerNumber,
        })),
      };

      // Call backend to generate PDF
      console.log('📤 Requesting PDF generation from backend...');
      const response = await fetch(`${ApiService.getBaseUrl()}/api/inspections/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error (${response.status}): ${errorText}`);
      }

      // Platform-specific handling.
      // IMPORTANT: a PDF is binary data. Reading it via response.text() (as this
      // used to do) decodes it as UTF-8, which silently corrupts any byte that
      // isn't valid UTF-8 and breaks the PDF's xref table/stream lengths. We
      // must read it as binary (blob/arrayBuffer) end-to-end to keep it byte-exact.
      if (Platform.OS === 'web') {
        // Web: read as a real Blob (binary-safe) and download it directly.
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const filename = `inspection_${Date.now()}.pdf`;

        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return filename;
      } else {
        // Native (iOS/Android): read as binary and base64-encode it ourselves,
        // then write with Base64 encoding so FileSystem stores the exact bytes.
        const arrayBuffer = await response.arrayBuffer();
        const base64Pdf = arrayBufferToBase64(arrayBuffer);

        const filename = `inspection_${Date.now()}.pdf`;
        const filePath = `${FileSystem.documentDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(filePath, base64Pdf, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return filePath;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Get bearer token from auth service
   * (You'll need to implement this based on your auth setup)
   */
  private getBearerToken(): string {
    // For now, return empty - the route is public for testing
    // In production, get this from AuthService
    return '';
  }
}

export default new PdfService();

