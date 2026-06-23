/**
 * Authentication Service
 * Handles token generation and storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = '@ctpat_inspection:api_token';
const USER_STORAGE_KEY = '@ctpat_inspection:user_info';

/**
 * Generate a simple UUID v4-like token
 */
const generateToken = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: 'inspector' | 'manager' | 'admin';
  createdAt: string;
}

class AuthService {
  /**
   * Generate a new development token (UUID v4-like)
   * In production, this would come from a real auth server
   */
  async generateDevToken(): Promise<string> {
    const token = generateToken();
    console.log('✓ Generated development token');
    return token;
  }

  /**
   * Get or create token for development
   */
  async getOrCreateToken(): Promise<string> {
    let token = await this.getStoredToken();

    if (!token) {
      token = await this.generateDevToken();
      await this.storeToken(token);
    }

    return token;
  }

  /**
   * Store token in secure storage
   */
  async storeToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      console.log('✓ Token stored securely');
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  }

  /**
   * Get stored token
   */
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  /**
   * Clear token (logout)
   */
  async clearToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      console.log('✓ Token cleared (logged out)');
    } catch (error) {
      console.error('Error clearing token:', error);
      throw error;
    }
  }

  /**
   * Store user info
   */
  async storeUserInfo(user: UserInfo): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      console.log('✓ User info stored');
    } catch (error) {
      console.error('Error storing user info:', error);
    }
  }

  /**
   * Get stored user info
   */
  async getUserInfo(): Promise<UserInfo | null> {
    try {
      const data = await AsyncStorage.getItem(USER_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving user info:', error);
      return null;
    }
  }

  /**
   * Initialize authentication on app startup
   */
  async initialize(): Promise<string> {
    console.log('🔐 Initializing authentication...');

    const token = await this.getOrCreateToken();

    // Create default user if doesn't exist
    const user = await this.getUserInfo();
    if (!user) {
      const newUser: UserInfo = {
        id: generateToken(),
        name: 'Inspector',
        email: 'inspector@ctpat.local',
        role: 'inspector',
        createdAt: new Date().toISOString(),
      };
      await this.storeUserInfo(newUser);
      console.log('✓ Default user created');
    }

    return token;
  }

  /**
   * Get masked token for display (show first 8 chars + last 4)
   */
  maskToken(token: string): string {
    if (token.length <= 12) return token;
    return token.substring(0, 8) + '...' + token.substring(token.length - 4);
  }
}

// Export singleton instance
export default new AuthService();
