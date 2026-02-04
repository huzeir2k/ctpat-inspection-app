/**
 * SecureCredentialsService
 * Manages sensitive credentials using Expo.SecureStore
 * Stores: JWT secret, SMTP credentials, API keys
 */

// @ts-ignore - expo-secure-store types
import * as SecureStore from 'expo-secure-store';

// Simple UUID generator (no external dependency needed)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SmtpConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  recipientEmail?: string;
}

export interface AppSecrets {
  jwtSecret: string;
  smtpConfig: SmtpConfig;
}

class SecureCredentialsService {
  private static instance: SecureCredentialsService;

  // SecureStore keys
  private readonly JWT_SECRET_KEY = 'ctpat_jwt_secret';
  private readonly SMTP_HOST_KEY = 'ctpat_smtp_host';
  private readonly SMTP_PORT_KEY = 'ctpat_smtp_port';
  private readonly SMTP_USER_KEY = 'ctpat_smtp_user';
  private readonly SMTP_PASSWORD_KEY = 'ctpat_smtp_password';
  private readonly SMTP_RECIPIENT_KEY = 'ctpat_smtp_recipient';
  private readonly SMTP_ENABLED_KEY = 'ctpat_smtp_enabled';

  // Cache in memory during app lifetime
  private jwtSecret: string | null = null;
  private smtpConfig: SmtpConfig | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): SecureCredentialsService {
    if (!SecureCredentialsService.instance) {
      SecureCredentialsService.instance = new SecureCredentialsService();
    }
    return SecureCredentialsService.instance;
  }

  /**
   * Initialize: Generate JWT secret on first launch, load existing credentials
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✓ SecureCredentialsService already initialized');
      return;
    }

    try {
      console.log('🔐 Initializing SecureCredentialsService...');

      // Load or generate JWT secret
      let secret = await this.getJwtSecret();
      if (!secret) {
        console.log('🔑 Generating new JWT secret (first launch)...');
        secret = generateUUID();
        await this.setJwtSecret(secret);
        console.log('✓ JWT secret generated and stored securely');
      } else {
        console.log('✓ JWT secret loaded from secure storage');
      }

      this.jwtSecret = secret;

      // Load SMTP configuration
      this.smtpConfig = await this.loadSmtpConfig();
      console.log('✓ SMTP configuration loaded');

      this.initialized = true;
      console.log('✓ SecureCredentialsService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize SecureCredentialsService:', error);
      throw new Error(
        `Credential initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get JWT secret (for backend token signing)
   */
  async getJwtSecret(): Promise<string | null> {
    if (this.jwtSecret) {
      return this.jwtSecret;
    }

    try {
      const secret = await SecureStore.getItemAsync(this.JWT_SECRET_KEY);
      if (secret) {
        this.jwtSecret = secret;
      }
      return secret;
    } catch (error) {
      console.error('❌ Error retrieving JWT secret:', error);
      return null;
    }
  }

  /**
   * Set JWT secret (internal use only)
   */
  private async setJwtSecret(secret: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.JWT_SECRET_KEY, secret);
      this.jwtSecret = secret;
    } catch (error) {
      console.error('❌ Error storing JWT secret:', error);
      throw error;
    }
  }

  /**
   * Load SMTP configuration from secure storage
   */
  private async loadSmtpConfig(): Promise<SmtpConfig> {
    try {
      const enabled = await SecureStore.getItemAsync(this.SMTP_ENABLED_KEY);
      const host = await SecureStore.getItemAsync(this.SMTP_HOST_KEY);
      const port = await SecureStore.getItemAsync(this.SMTP_PORT_KEY);
      const user = await SecureStore.getItemAsync(this.SMTP_USER_KEY);
      const password = await SecureStore.getItemAsync(this.SMTP_PASSWORD_KEY);
      const recipientEmail = await SecureStore.getItemAsync(this.SMTP_RECIPIENT_KEY);

      return {
        enabled: enabled === 'true',
        host: host || undefined,
        port: port ? parseInt(port, 10) : undefined,
        user: user || undefined,
        password: password || undefined,
        recipientEmail: recipientEmail || undefined,
      };
    } catch (error) {
      console.error('⚠️  Error loading SMTP config:', error);
      return { enabled: false };
    }
  }

  /**
   * Get current SMTP configuration
   */
  getSmtpConfig(): SmtpConfig {
    return (
      this.smtpConfig || {
        enabled: false,
      }
    );
  }

  /**
   * Update SMTP configuration
   */
  async updateSmtpConfig(config: SmtpConfig): Promise<void> {
    try {
      console.log('💾 Updating SMTP configuration...');

      // Store each field separately for security
      await SecureStore.setItemAsync(this.SMTP_ENABLED_KEY, config.enabled ? 'true' : 'false');

      if (config.host) {
        await SecureStore.setItemAsync(this.SMTP_HOST_KEY, config.host);
      } else {
        await SecureStore.deleteItemAsync(this.SMTP_HOST_KEY).catch(() => {});
      }

      if (config.port) {
        await SecureStore.setItemAsync(this.SMTP_PORT_KEY, config.port.toString());
      } else {
        await SecureStore.deleteItemAsync(this.SMTP_PORT_KEY).catch(() => {});
      }

      if (config.user) {
        await SecureStore.setItemAsync(this.SMTP_USER_KEY, config.user);
      } else {
        await SecureStore.deleteItemAsync(this.SMTP_USER_KEY).catch(() => {});
      }

      if (config.password) {
        await SecureStore.setItemAsync(this.SMTP_PASSWORD_KEY, config.password);
      } else {
        await SecureStore.deleteItemAsync(this.SMTP_PASSWORD_KEY).catch(() => {});
      }

      if (config.recipientEmail) {
        await SecureStore.setItemAsync(this.SMTP_RECIPIENT_KEY, config.recipientEmail);
      } else {
        await SecureStore.deleteItemAsync(this.SMTP_RECIPIENT_KEY).catch(() => {});
      }

      this.smtpConfig = config;
      console.log('✓ SMTP configuration updated');
    } catch (error) {
      console.error('❌ Error updating SMTP config:', error);
      throw new Error(
        `Failed to update SMTP config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if SMTP is configured and enabled
   */
  isSmtpConfigured(): boolean {
    const config = this.getSmtpConfig();
    return !!(
      config.enabled &&
      config.host &&
      config.port &&
      config.user &&
      config.password &&
      config.recipientEmail
    );
  }

  /**
   * Get SMTP as environment variables for backend
   */
  getSmtpEnvVars(): Record<string, string> {
    const config = this.getSmtpConfig();

    if (!this.isSmtpConfigured()) {
      console.warn('⚠️  SMTP not fully configured, email disabled');
      return {
        SMTP_ENABLED: 'false',
      };
    }

    return {
      SMTP_ENABLED: 'true',
      SMTP_HOST: config.host || '',
      SMTP_PORT: config.port?.toString() || '',
      SMTP_USER: config.user || '',
      SMTP_PASSWORD: config.password || '',
      EMAIL_RECIPIENT: config.recipientEmail || '',
    };
  }

  /**
   * Clear all credentials (for testing/debugging)
   */
  async clearAllCredentials(): Promise<void> {
    try {
      console.log('🗑️  Clearing all credentials...');

      await Promise.all([
        SecureStore.deleteItemAsync(this.JWT_SECRET_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_ENABLED_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_HOST_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_PORT_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_USER_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_PASSWORD_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(this.SMTP_RECIPIENT_KEY).catch(() => {}),
      ]);

      this.jwtSecret = null;
      this.smtpConfig = { enabled: false };
      this.initialized = false;

      console.log('✓ All credentials cleared');
    } catch (error) {
      console.error('❌ Error clearing credentials:', error);
      throw error;
    }
  }

  /**
   * Get app secrets (for backend initialization)
   */
  async getAppSecrets(): Promise<AppSecrets> {
    const jwtSecret = await this.getJwtSecret();

    if (!jwtSecret) {
      throw new Error('JWT secret not available');
    }

    return {
      jwtSecret,
      smtpConfig: this.getSmtpConfig(),
    };
  }
}

export default SecureCredentialsService;
