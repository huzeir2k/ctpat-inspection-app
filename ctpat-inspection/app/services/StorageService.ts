import AsyncStorage from '@react-native-async-storage/async-storage';
import { InspectionForm, InspectionPoint } from '../models/InspectionChecklist';

export interface SavedInspection {
  id: string;
  inspectionPoints: InspectionPoint[];
  formData: InspectionForm;
  savedAt: string;
  completedAt?: string;
}

class StorageService {
  private readonly INSPECTION_HISTORY_KEY = 'ctpat_inspection_history';
  private readonly CURRENT_INSPECTION_KEY = 'ctpat_current_inspection';
  private readonly SETTINGS_KEY = 'ctpat_settings';

  /**
   * Save the current inspection in progress
   */
  async saveCurrentInspection(
    inspectionPoints: InspectionPoint[],
    formData: InspectionForm
  ): Promise<void> {
    try {
      const inspection: SavedInspection = {
        id: this.generateId(),
        inspectionPoints,
        formData,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        this.CURRENT_INSPECTION_KEY,
        JSON.stringify(inspection)
      );
      console.log('Current inspection saved');
    } catch (error) {
      console.error('Error saving current inspection:', error);
      throw new Error('Failed to save inspection data');
    }
  }

  /**
   * Load the current inspection in progress
   */
  async loadCurrentInspection(): Promise<SavedInspection | null> {
    try {
      const data = await AsyncStorage.getItem(this.CURRENT_INSPECTION_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error loading current inspection:', error);
      return null;
    }
  }

  /**
   * Complete and archive an inspection to history
   */
  async completeInspection(
    inspectionPoints: InspectionPoint[],
    formData: InspectionForm
  ): Promise<string> {
    try {
      const inspection: SavedInspection = {
        id: this.generateId(),
        inspectionPoints,
        formData,
        savedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      // Get existing history
      const history = await this.getInspectionHistory();
      
      // Add new inspection to history
      history.push(inspection);

      // Save updated history
      await AsyncStorage.setItem(
        this.INSPECTION_HISTORY_KEY,
        JSON.stringify(history)
      );

      // Clear current inspection
      await AsyncStorage.removeItem(this.CURRENT_INSPECTION_KEY);

      console.log('Inspection completed and archived');
      return inspection.id;
    } catch (error) {
      console.error('Error completing inspection:', error);
      throw new Error('Failed to complete inspection');
    }
  }

  /**
   * Get all completed inspections from history
   */
  async getInspectionHistory(): Promise<SavedInspection[]> {
    try {
      const data = await AsyncStorage.getItem(this.INSPECTION_HISTORY_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error loading inspection history:', error);
      return [];
    }
  }

  /**
   * Get a specific inspection by ID
   */
  async getInspectionById(id: string): Promise<SavedInspection | null> {
    try {
      const history = await this.getInspectionHistory();
      return history.find((inspection) => inspection.id === id) || null;
    } catch (error) {
      console.error('Error retrieving inspection:', error);
      return null;
    }
  }

  /**
   * Delete an inspection from history
   */
  async deleteInspection(id: string): Promise<void> {
    try {
      const history = await this.getInspectionHistory();
      const filtered = history.filter((inspection) => inspection.id !== id);
      await AsyncStorage.setItem(
        this.INSPECTION_HISTORY_KEY,
        JSON.stringify(filtered)
      );
      console.log('Inspection deleted');
    } catch (error) {
      console.error('Error deleting inspection:', error);
      throw new Error('Failed to delete inspection');
    }
  }

  /**
   * Clear current inspection (without completing)
   */
  async clearCurrentInspection(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CURRENT_INSPECTION_KEY);
      console.log('Current inspection cleared');
    } catch (error) {
      console.error('Error clearing current inspection:', error);
    }
  }

  /**
   * Save application settings
   */
  async saveSettings(settings: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      console.log('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Load application settings
   */
  async loadSettings(): Promise<Record<string, any> | null> {
    try {
      const data = await AsyncStorage.getItem(this.SETTINGS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  }

  /**
   * Get statistics about inspections
   */
  async getInspectionStats(): Promise<{
    totalInspections: number;
    thisMonth: number;
    thisWeek: number;
  }> {
    try {
      const history = await this.getInspectionHistory();
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const thisMonthCount = history.filter((inspection) => {
        const date = new Date(inspection.completedAt || inspection.savedAt);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      }).length;

      const thisWeekCount = history.filter((inspection) => {
        const date = new Date(inspection.completedAt || inspection.savedAt);
        return date >= weekAgo;
      }).length;

      return {
        totalInspections: history.length,
        thisMonth: thisMonthCount,
        thisWeek: thisWeekCount,
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return { totalInspections: 0, thisMonth: 0, thisWeek: 0 };
    }
  }

  /**
   * Clear all data (for debugging/reset)
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.INSPECTION_HISTORY_KEY,
        this.CURRENT_INSPECTION_KEY,
        this.SETTINGS_KEY,
      ]);
      console.log('All data cleared');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Export inspection history as JSON
   */
  async exportHistory(): Promise<string> {
    try {
      const history = await this.getInspectionHistory();
      return JSON.stringify(history, null, 2);
    } catch (error) {
      console.error('Error exporting history:', error);
      throw new Error('Failed to export history');
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `inspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new StorageService();
