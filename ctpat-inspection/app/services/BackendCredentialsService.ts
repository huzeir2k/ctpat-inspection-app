/**
 * Backend Credentials Service
 * Pushes credentials from frontend to backend API
 * Used to set JWT secret and SMTP config in backend after startup
 */

import ErrorHandlerService from './ErrorHandlerService';

interface BackendCredentials {
  jwtSecret: string;
  smtpConfig?: {
    host: string;
    port: string;
    user: string;
    password: string;
    recipientEmail: string;
  } | null;
}

// Store backend URL (will be set during initialization)
let BACKEND_URL = 'http://localhost:3000';

class BackendCredentialsService {
  private static instance: BackendCredentialsService;

  private constructor() {}

  static getInstance(): BackendCredentialsService {
    if (!BackendCredentialsService.instance) {
      BackendCredentialsService.instance = new BackendCredentialsService();
    }
    return BackendCredentialsService.instance;
  }

  /**
   * Set the backend URL (called from _layout.tsx)
   */
  static setBackendUrl(url: string): void {
    BACKEND_URL = url;
    console.log('[backend-credentials] Backend URL set to:', url);
  }

  /**
   * Make request to credentials endpoint
   */
  private async requestCredentialsEndpoint<T = any>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any
  ): Promise<T | null> {
    try {
      const url = `${BACKEND_URL}/api/credentials${endpoint}`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CTPAT-Inspection-App/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        console.warn(`[backend-credentials] HTTP ${response.status} from ${endpoint}`);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      console.warn('[backend-credentials] Request error:', errorInfo.message);
      return null;
    }
  }

  /**
   * Push credentials to backend
   * Called after backend starts and credentials are initialized
   */
  async pushCredentialsToBackend(credentials: BackendCredentials): Promise<boolean> {
    try {
      console.log('[backend-credentials] Pushing credentials to backend...');

      const response = await this.requestCredentialsEndpoint<any>(
        'POST',
        '/store',
        credentials
      );

      if (response?.success) {
        console.log('[backend-credentials] ✓ Credentials pushed successfully');
        return true;
      } else {
        console.warn('[backend-credentials] ⚠️  Failed to push credentials:', response?.error?.message);
        return false;
      }
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      ErrorHandlerService.logError('BackendCredentialsService.pushCredentialsToBackend', error);
      console.warn('[backend-credentials] Error pushing credentials:', errorInfo.message);
      // Don't throw - this is non-critical
      return false;
    }
  }

  /**
   * Retrieve JWT secret from backend
   */
  async getBackendJwtSecret(): Promise<string | null> {
    try {
      console.log('[backend-credentials] Retrieving JWT secret from backend...');

      const response = await this.requestCredentialsEndpoint<any>(
        'GET',
        '/jwt-secret'
      );

      if (response?.success && response?.secret) {
        console.log('[backend-credentials] ✓ JWT secret retrieved');
        return response.secret;
      }

      console.warn('[backend-credentials] No JWT secret found in backend');
      return null;
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      ErrorHandlerService.logError('BackendCredentialsService.getBackendJwtSecret', error);
      return null;
    }
  }

  /**
   * Retrieve SMTP config from backend
   */
  async getBackendSmtpConfig() {
    try {
      console.log('[backend-credentials] Retrieving SMTP config from backend...');

      const response = await this.requestCredentialsEndpoint<any>(
        'GET',
        '/smtp-config'
      );

      if (response?.success) {
        if (response?.configured) {
          console.log('[backend-credentials] ✓ SMTP config retrieved');
        } else {
          console.log('[backend-credentials] SMTP not configured on backend');
        }
        return response?.config || null;
      }

      return null;
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      ErrorHandlerService.logError('BackendCredentialsService.getBackendSmtpConfig', error);
      return null;
    }
  }

  /**
   * Check if backend has credentials configured
   */
  async checkBackendCredentials(): Promise<{
    jwtSecretSet: boolean;
    smtpConfigured: boolean;
  }> {
    try {
      const [jwtSecret, smtpConfig] = await Promise.all([
        this.getBackendJwtSecret(),
        this.getBackendSmtpConfig(),
      ]);

      return {
        jwtSecretSet: !!jwtSecret,
        smtpConfigured: !!smtpConfig,
      };
    } catch (error) {
      ErrorHandlerService.logError('BackendCredentialsService.checkBackendCredentials', error);
      return {
        jwtSecretSet: false,
        smtpConfigured: false,
      };
    }
  }
}

export default BackendCredentialsService;
