import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * A photo captured during an inspection, stamped with the shipment context
 * at the moment it was taken (timestamp, freight bill number, seal number,
 * load origin/destination, truck/trailer number).
 */
export interface StoredPhoto {
  id: string;
  base64Data: string;
  takenAt: string;
  sealNumber?: string;
  freightBillNumber?: string;
  loadOrigin?: string;
  loadDestination?: string;
  truckNumber?: string;
  trailerNumber?: string;
}

export type PhotoCaptureMetadata = Omit<StoredPhoto, 'id' | 'base64Data' | 'takenAt'>;

class PhotoService {
  private readonly PHOTOS_DIR = `${FileSystem.documentDirectory}photos`;
  private isWeb = Platform.OS === 'web';
  private webPhotos: Map<string, StoredPhoto> = new Map();

  /**
   * Initialize photos directory
   */
  private async ensureDirectoryExists(): Promise<void> {
    if (this.isWeb) return;

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.PHOTOS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.PHOTOS_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Error creating photos directory:', error);
      throw error;
    }
  }

  /**
   * Save a captured photo along with the inspection metadata active at
   * capture time (timestamp, seal number, freight bill number, origin/destination).
   */
  async savePhoto(base64Data: string, metadata: PhotoCaptureMetadata): Promise<StoredPhoto> {
    const photo: StoredPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      base64Data,
      takenAt: new Date().toISOString(),
      ...metadata,
    };

    if (this.isWeb) {
      this.webPhotos.set(photo.id, photo);
      console.log(`✓ Photo ${photo.id} saved to web storage`);
      return photo;
    }

    try {
      await this.ensureDirectoryExists();

      const filePath = `${this.PHOTOS_DIR}/${photo.id}.json`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(photo));

      console.log(`✓ Photo ${photo.id} saved`);
      return photo;
    } catch (error) {
      console.error('Error saving photo:', error);
      throw new Error('Failed to save photo');
    }
  }

  /**
   * Get all photos saved for the current inspection session
   */
  async getAllPhotos(): Promise<StoredPhoto[]> {
    if (this.isWeb) {
      return Array.from(this.webPhotos.values());
    }

    try {
      await this.ensureDirectoryExists();

      const files = await FileSystem.readDirectoryAsync(this.PHOTOS_DIR);
      const photos: StoredPhoto[] = [];

      for (const filename of files) {
        if (filename.endsWith('.json')) {
          try {
            const filePath = `${this.PHOTOS_DIR}/${filename}`;
            const data = await FileSystem.readAsStringAsync(filePath);
            photos.push(JSON.parse(data));
          } catch (e) {
            console.error(`Error reading photo file ${filename}:`, e);
          }
        }
      }

      return photos.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    } catch (error) {
      console.error('Error getting all photos:', error);
      return [];
    }
  }

  /**
   * Delete a photo
   */
  async deletePhoto(photoId: string): Promise<void> {
    if (this.isWeb) {
      this.webPhotos.delete(photoId);
      console.log(`Photo ${photoId} deleted from web storage`);
      return;
    }

    try {
      const filePath = `${this.PHOTOS_DIR}/${photoId}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        console.log(`✓ Photo ${photoId} deleted`);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error('Failed to delete photo');
    }
  }

  /**
   * Clear all photos (used when starting a new inspection)
   */
  async clearAllPhotos(): Promise<void> {
    if (this.isWeb) {
      this.webPhotos.clear();
      console.log('All photos cleared from web storage');
      return;
    }

    try {
      const dirInfo = await FileSystem.getInfoAsync(this.PHOTOS_DIR);

      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.PHOTOS_DIR);
        console.log('✓ All photos cleared');
      }
    } catch (error) {
      console.error('Error clearing photos:', error);
      throw new Error('Failed to clear photos');
    }
  }
}

export default new PhotoService();
