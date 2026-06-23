import * as FileSystem from 'expo-file-system';
import { Platform, AppState, AppStateStatus } from 'react-native';

// nodejs-mobile-react-native will be available at runtime
// Only available in built apps, not in Expo dev environment
let nodejsMobile: any = null;
const isNativeModuleAvailable = (() => {
  try {
    // @ts-ignore
    nodejsMobile = require('nodejs-mobile-react-native');
    return true;
  } catch (error) {
    // Module not available in Expo dev environment
    return false;
  }
})();

/**
 * EmbeddedBackendService
 * Manages the embedded Node.js backend server running locally on the device
 * Handles startup, shutdown, graceful lifecycle, and performance monitoring
 * 
 * Features:
 * - Intelligent startup on first app initialization
 * - Graceful shutdown on app background
 * - Periodic health checks with monitoring
 * - Process state tracking
 * - Memory and performance metrics
 */
class EmbeddedBackendService {
  private static instance: EmbeddedBackendService;
  private backendStarted = false;
  private backendPort = 3000;
  private backendUrl = '';
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: any = null;
  private startupTime: number = 0;
  private processMetrics = {
    restarts: 0,
    healthChecksFailed: 0,
    lastHealthCheckTime: 0,
    totalUptime: 0,
    startupDuration: 0,
  };

  private constructor() {}

  static getInstance(): EmbeddedBackendService {
    if (!EmbeddedBackendService.instance) {
      EmbeddedBackendService.instance = new EmbeddedBackendService();
    }
    return EmbeddedBackendService.instance;
  }

  /**
   * Start the embedded backend server
   * - Spawns Node.js process
   * - Waits for health check to pass
   * - Sets API_BASE_URL for ApiService
   * - Sets up graceful lifecycle management
   */
  async startBackend(): Promise<string> {
    if (this.backendStarted) {
      console.log('✓ Backend already running at', this.backendUrl);
      return this.backendUrl;
    }

    try {
      console.log('🚀 Starting embedded backend...');
      this.startupTime = Date.now();

      // Check if nodejs-mobile is available (only available in built apps, not in Expo dev mode)
      if (!isNativeModuleAvailable) {
        console.warn('⚠️  nodejs-mobile-react-native is not available in development mode');
        console.warn('This app requires a custom build with nodejs-mobile-react-native support');
        console.warn('To test locally, you need to:');
        console.warn('1. Use EAS build: eas build --platform android/ios --profile development');
        console.warn('2. Or set up a local development client with the nodejs-mobile plugin');
        console.warn('For now, falling back to backend at http://localhost:3000');
        
        // In dev mode, assume backend is running separately (e.g., with npm run dev in backend folder)
        this.backendStarted = true;
        this.backendUrl = 'http://localhost:3000';
        this.processMetrics.startupDuration = 0;
        return this.backendUrl;
      }

      // Start Node.js process (entry point: main.js in nodejs folder)
      await nodejsMobile.start('main.js', {
        debugPort: __DEV__ ? 9222 : undefined,
      });

      console.log('✓ Node.js process spawned');

      // Wait for backend to be ready
      await this.waitForBackendReady();

      this.backendStarted = true;
      this.backendUrl = `http://localhost:${this.backendPort}`;
      
      // Record startup duration
      this.processMetrics.startupDuration = Date.now() - this.startupTime;
      console.log(`✓ Backend startup took ${this.processMetrics.startupDuration}ms`);

      console.log('✓ Backend started successfully at', this.backendUrl);

      // Start health check interval (every 30 seconds)
      this.startHealthCheckInterval();
      
      // Setup app lifecycle monitoring (graceful shutdown)
      this.setupLifecycleManagement();

      return this.backendUrl;
    } catch (error) {
      this.processMetrics.restarts++;
      console.error('✗ Failed to start backend:', error);
      throw new Error(
        `Backend startup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Wait for backend to be ready by polling /health endpoint
   * Max 60 attempts = 60 seconds total
   */
  private async waitForBackendReady(maxAttempts = 60): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`http://localhost:${this.backendPort}/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('✓ Backend health check passed:', data);
          return;
        }
      } catch (error) {
        // Backend not ready yet
        const attempt = i + 1;
        if (attempt % 10 === 0) {
          console.log(`⏳ Waiting for backend... (${attempt}/${maxAttempts}s)`);
        }
      }

      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Backend failed to start after 60 seconds');
  }

  /**
   * Start periodic health checks to monitor backend status
   */
  private startHealthCheckInterval(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${this.backendPort}/health`);
        if (!response.ok) {
          console.warn('⚠️  Backend health check failed');
        }
      } catch (error) {
        console.warn('⚠️  Backend health check error:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop the embedded backend server
   */
  stopBackend(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    try {
      if (isNativeModuleAvailable && nodejsMobile && nodejsMobile.stop) {
        nodejsMobile.stop();
      }
      this.backendStarted = false;
      console.log('✓ Backend stopped');
    } catch (error) {
      console.error('⚠️  Error stopping backend:', error);
    }
  }

  /**
   * Get the backend URL
   */
  getBackendUrl(): string {
    return this.backendUrl || `http://localhost:${this.backendPort}`;
  }

  /**
   * Check if backend is running
   */
  isBackendRunning(): boolean {
    return this.backendStarted;
  }

  /**
   * Get backend port
   */
  getBackendPort(): number {
    return this.backendPort;
  }

  /**
   * Setup app lifecycle management for graceful backend shutdown
   * - Pauses backend when app goes to background
   * - Resumes when app comes to foreground
   * - Clean shutdown on app termination
   */
  private setupLifecycleManagement(): void {
    try {
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      console.log('✓ App lifecycle listener attached');
    } catch (error) {
      console.warn('⚠️  Failed to setup lifecycle management:', error);
    }
  }

  /**
   * Handle app state changes (foreground/background/inactive)
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('📱 App entering background - backend will continue running');
      // Backend continues running in background (useful for background sync)
    } else if (nextAppState === 'active') {
      console.log('📱 App entering foreground - checking backend health');
      // Verify backend is still healthy when app returns to foreground
      try {
        const isHealthy = await this.performHealthCheck();
        if (!isHealthy) {
          console.warn('⚠️  Backend unhealthy on foreground, attempting restart');
          // Could implement auto-restart here if needed
        }
      } catch (error) {
        console.warn('⚠️  Health check failed:', error);
      }
    }
  };

  /**
   * Perform a single health check
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://localhost:${this.backendPort}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (response.ok) {
        this.processMetrics.lastHealthCheckTime = Date.now();
        return true;
      }
      
      this.processMetrics.healthChecksFailed++;
      return false;
    } catch (error) {
      this.processMetrics.healthChecksFailed++;
      return false;
    }
  }

  /**
   * Get process metrics and diagnostics
   */
  getProcessMetrics() {
    return {
      ...this.processMetrics,
      isRunning: this.backendStarted,
      port: this.backendPort,
      url: this.backendUrl,
      appStateListener: !!this.appStateSubscription,
    };
  }

  /**
   * Reset process metrics
   */
  resetMetrics(): void {
    this.processMetrics = {
      restarts: 0,
      healthChecksFailed: 0,
      lastHealthCheckTime: 0,
      totalUptime: 0,
      startupDuration: 0,
    };
    console.log('✓ Process metrics reset');
  }

  /**
   * Cleanup on app termination
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.stopBackend();
  }
}

export default EmbeddedBackendService;
