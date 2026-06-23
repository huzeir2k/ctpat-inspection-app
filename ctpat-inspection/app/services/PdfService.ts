import * as FileSystem from 'expo-file-system/legacy';
import { InspectionForm, InspectionPoint } from "../models/InspectionChecklist";
import { StoredSignature } from "./SignatureService";
import ApiService from './ApiService';
import { Platform } from 'react-native';

export interface PdfGenerationData {
  inspectionPoints: InspectionPoint[];
  formData: InspectionForm;
  inspectorSignature?: StoredSignature | null;
  verifiedBySignature?: StoredSignature | null;
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
      const { formData, inspectionPoints, inspectorSignature, verifiedBySignature } = data;

      // Prepare payload for backend
      const payload = {
        inspectionData: {
          truckNumber: formData.truckNumber,
          trailerNumber: formData.trailerNumber,
          sealNumber: formData.sealNumber,
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
      };

      // Call backend to generate PDF
      console.log('📤 Requesting PDF generation from backend...');
      const response = await fetch('http://localhost:3000/api/inspections/generate-pdf', {
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

      // Get PDF content as text
      const pdfContent = await response.text();

      // Platform-specific handling
      if (Platform.OS === 'web') {
        // Web: Use Blob and download
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
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
        // Native (iOS/Android): Use FileSystem
        const filename = `inspection_${Date.now()}.pdf`;
        const filePath = `${FileSystem.documentDirectory}${filename}`;

        await FileSystem.writeAsStringAsync(filePath, pdfContent, {
          encoding: FileSystem.EncodingType.UTF8,
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

