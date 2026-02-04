import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from "react-native";

export interface StoredSignature {
  id: string;
  base64Data: string;
  type: 'drawn' | 'uploaded';
  savedAt: string;
  name: string;
}

class SignatureService {
  private readonly SIGNATURES_DIR = `${FileSystem.documentDirectory}signatures`;
  private isWeb = Platform.OS === 'web';
  private webSignatures: Map<string, StoredSignature> = new Map();

  /**
   * Initialize signatures directory
   */
  private async ensureDirectoryExists(): Promise<void> {
    if (this.isWeb) return;

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.SIGNATURES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.SIGNATURES_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Error creating signatures directory:', error);
      throw error;
    }
  }

  /**
   * Save a signature (either drawn or uploaded)
   */
  async saveSignature(base64Data: string, type: 'drawn' | 'uploaded'): Promise<StoredSignature> {
    if (this.isWeb) {
      return this.saveSignatureWeb(base64Data, type);
    }

    try {
      await this.ensureDirectoryExists();

      const signatureId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filename = `${signatureId}.png`;
      const filePath = `${this.SIGNATURES_DIR}/${filename}`;

      // Save the signature as a file
      await FileSystem.writeAsStringAsync(filePath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const signature: StoredSignature = {
        id: signatureId,
        base64Data,
        type,
        savedAt: new Date().toISOString(),
        name: `${type === 'drawn' ? 'Drawn' : 'Uploaded'} - ${new Date().toLocaleString()}`,
      };

      console.log(`✓ Signature ${signatureId} saved (${type})`);
      return signature;
    } catch (error) {
      console.error('Error saving signature:', error);
      throw new Error('Failed to save signature');
    }
  }

  private saveSignatureWeb(base64Data: string, type: 'drawn' | 'uploaded'): StoredSignature {
    const signatureId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const signature: StoredSignature = {
      id: signatureId,
      base64Data,
      type,
      savedAt: new Date().toISOString(),
      name: `${type === 'drawn' ? 'Drawn' : 'Uploaded'} - ${new Date().toLocaleString()}`,
    };
    this.webSignatures.set(signatureId, signature);
    console.log(`✓ Signature ${signatureId} saved to web storage (${type})`);
    return signature;
  }

  /**
   * Load a signature by ID
   */
  async loadSignature(signatureId: string): Promise<string | null> {
    if (this.isWeb) {
      const sig = this.webSignatures.get(signatureId);
      return sig?.base64Data || null;
    }

    try {
      const filePath = `${this.SIGNATURES_DIR}/${signatureId}.png`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (!fileInfo.exists) {
        console.warn(`Signature ${signatureId} not found`);
        return null;
      }

      const base64Data = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return base64Data;
    } catch (error) {
      console.error('Error loading signature:', error);
      return null;
    }
  }

  /**
   * Get all saved signatures
   */
  async getAllSignatures(): Promise<StoredSignature[]> {
    if (this.isWeb) {
      return Array.from(this.webSignatures.values());
    }

    try {
      await this.ensureDirectoryExists();

      const files = await FileSystem.readDirectoryAsync(this.SIGNATURES_DIR);
      const signatures: StoredSignature[] = [];

      for (const filename of files) {
        if (filename.endsWith('.png')) {
          try {
            const filePath = `${this.SIGNATURES_DIR}/${filename}`;
            const base64Data = await FileSystem.readAsStringAsync(filePath, {
              encoding: FileSystem.EncodingType.Base64,
            });

            const signatureId = filename.replace('.png', '');
            const fileInfo = await FileSystem.getInfoAsync(filePath);

            signatures.push({
              id: signatureId,
              base64Data,
              type: 'drawn',
              savedAt: fileInfo.modificationTime ? new Date(fileInfo.modificationTime * 1000).toISOString() : new Date().toISOString(),
              name: `Signature - ${new Date().toLocaleString()}`,
            });
          } catch (e) {
            console.error(`Error reading signature file ${filename}:`, e);
          }
        }
      }

      return signatures;
    } catch (error) {
      console.error('Error getting all signatures:', error);
      return [];
    }
  }

  /**
   * Delete a signature
   */
  async deleteSignature(signatureId: string): Promise<void> {
    if (this.isWeb) {
      this.webSignatures.delete(signatureId);
      console.log(`Signature ${signatureId} deleted from web storage`);
      return;
    }

    try {
      const filePath = `${this.SIGNATURES_DIR}/${signatureId}.png`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        console.log(`✓ Signature ${signatureId} deleted`);
      }
    } catch (error) {
      console.error('Error deleting signature:', error);
      throw new Error('Failed to delete signature');
    }
  }

  /**
   * Clear all signatures
   */
  async clearAllSignatures(): Promise<void> {
    if (this.isWeb) {
      this.webSignatures.clear();
      console.log('All signatures cleared from web storage');
      return;
    }

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.SIGNATURES_DIR);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.SIGNATURES_DIR);
        console.log('✓ All signatures cleared');
      }
    } catch (error) {
      console.error('Error clearing signatures:', error);
      throw new Error('Failed to clear signatures');
    }
  }
}

export default new SignatureService();
