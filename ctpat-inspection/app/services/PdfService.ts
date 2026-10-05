import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import ApiService from './ApiService';

/**
 * PDF Service - gets filled CTPAT PDFs from the backend and hands them to the user.
 * The backend fills the form template; this service only moves the bytes around.
 */

// Converts in chunks so large PDFs do not overflow the call stack.
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
};

class PdfService {
  /**
   * Render a PDF from the data entered so far (nothing is saved on the server)
   * and open it.
   */
  async previewDraft(submission: object): Promise<void> {
    const pdf = await ApiService.previewPdf(submission);
    await this.deliver(pdf, `CTPAT_preview_${Date.now()}.pdf`);
  }

  /**
   * Download the stored PDF of a submitted inspection and open it.
   * @returns the local file path (empty on web, where the browser handles the download)
   */
  async openInspectionPdf(inspectionId: string): Promise<string> {
    const pdf = await ApiService.getInspectionPdf(inspectionId);
    return this.deliver(pdf, `CTPAT_${inspectionId.slice(0, 8)}.pdf`);
  }

  /**
   * Download the stored PDF of a submitted inspection without opening it.
   * Used to attach it to an email from the device's mail app.
   */
  async downloadInspectionPdf(inspectionId: string): Promise<string> {
    const pdf = await ApiService.getInspectionPdf(inspectionId);
    return this.save(pdf, `CTPAT_${inspectionId.slice(0, 8)}.pdf`);
  }

  private async deliver(pdf: ArrayBuffer, fileName: string): Promise<string> {
    const path = await this.save(pdf, fileName);
    if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(path, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    }
    return path;
  }

  private async save(pdf: ArrayBuffer, fileName: string): Promise<string> {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return '';
    }

    // The cache directory is cleared by the OS; reports contain personal details.
    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, arrayBufferToBase64(pdf), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  }
}

export default new PdfService();
