import AsyncStorage from '@react-native-async-storage/async-storage';
import { InspectionDraft } from '../models/InspectionForm';

/**
 * One finished inspection in the local history list.
 * The server holds the full record and PDF; this is just enough to list it offline.
 */
export interface HistoryEntry {
  id: string;
  formId: string;
  summaryId: string;
  freightBillNumber?: string;
  printName?: string;
  date?: string;
  time?: string;
  completedAt: string;
}

class StorageService {
  private readonly INSPECTION_HISTORY_KEY = 'ctpat_inspection_history';
  private readonly DRAFT_KEY_PREFIX = 'ctpat_draft_';
  private readonly SETTINGS_KEY = 'ctpat_settings';

  private draftKey(formId: string): string {
    return `${this.DRAFT_KEY_PREFIX}${formId}`;
  }

  /**
   * Save the inspection in progress for one form type. Each form keeps its own
   * draft, so switching form types never mixes answers. Signatures are not saved.
   */
  async saveDraft(draft: InspectionDraft): Promise<void> {
    const withoutSignatures = {
      ...draft,
      values: Object.fromEntries(
        Object.entries(draft.values).filter(([, value]) => typeof value !== 'object')
      ),
    };
    await AsyncStorage.setItem(this.draftKey(draft.formId), JSON.stringify(withoutSignatures));
  }

  async loadDraft(formId: string): Promise<Partial<InspectionDraft> | null> {
    try {
      const data = await AsyncStorage.getItem(this.draftKey(formId));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }

  async clearDraft(formId: string): Promise<void> {
    await AsyncStorage.removeItem(this.draftKey(formId));
  }

  /**
   * Add a finished inspection to the local history
   */
  async addToHistory(entry: HistoryEntry): Promise<void> {
    const history = await this.getInspectionHistory();
    history.push(entry);
    await AsyncStorage.setItem(this.INSPECTION_HISTORY_KEY, JSON.stringify(history));
  }

  /**
   * Get finished inspections, newest first
   */
  async getInspectionHistory(): Promise<HistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(this.INSPECTION_HISTORY_KEY);
      const history: HistoryEntry[] = data ? JSON.parse(data) : [];
      return history.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    } catch (error) {
      console.error('Error loading inspection history:', error);
      return [];
    }
  }

  async deleteInspection(id: string): Promise<void> {
    const history = await this.getInspectionHistory();
    await AsyncStorage.setItem(
      this.INSPECTION_HISTORY_KEY,
      JSON.stringify(history.filter((entry) => entry.id !== id))
    );
  }

  /**
   * Save application settings
   */
  async saveSettings(settings: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
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
      return data ? JSON.parse(data) : null;
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
    const history = await this.getInspectionHistory();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalInspections: history.length,
      thisMonth: history.filter((entry) => {
        const date = new Date(entry.completedAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
      thisWeek: history.filter((entry) => new Date(entry.completedAt) >= weekAgo).length,
    };
  }

  /**
   * Clear all data (for debugging/reset)
   */
  async clearAllData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter((key) => key.startsWith(this.DRAFT_KEY_PREFIX));
    await AsyncStorage.multiRemove([this.INSPECTION_HISTORY_KEY, this.SETTINGS_KEY, ...draftKeys]);
  }
}

export default new StorageService();
