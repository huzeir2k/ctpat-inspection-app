/**
 * API Service for Backend Integration
 * Handles all communication with the CTPAT inspection backend
 */

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
  };
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Build-time default; can be overridden at runtime via setBaseUrl() (e.g. a user-configurable setting)
const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

class ApiService {
  private token: string | null = null;
  private baseUrl: string = DEFAULT_API_URL;
  private requestCount = 0;
  private requestLog: Array<{
    timestamp: string;
    method: string;
    endpoint: string;
    status: number;
    duration: number;
  }> = [];

  /**
   * Initialize API service with authentication token
   */
  initialize(token: string): void {
    this.token = token;
    console.log('✓ API Service initialized with token:', token.substring(0, 8) + '...');
  }

  /**
   * Set or update authentication token
   */
  setToken(token: string): void {
    this.token = token;
    console.log('✓ API token updated');
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  /**
   * Override the backend base URL at runtime (e.g. from the Settings screen)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.trim().replace(/\/+$/, '');
    console.log('✓ API base URL set to:', this.baseUrl);
  }

  /**
   * Get the currently active backend base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the build-time default backend URL (used for "reset to default")
   */
  getDefaultBaseUrl(): string {
    return DEFAULT_API_URL;
  }

  /**
   * Make authenticated API request
   */
  private async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    options?: {
      idempotencyKey?: string;
      timeout?: number;
    }
  ): Promise<ApiResponse<T>> {
    if (!this.token) {
      return {
        success: false,
        error: {
          message: 'Not authenticated. Call ApiService.initialize() first.',
          statusCode: 401,
        },
      };
    }

    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'User-Agent': 'CTPAT-Inspection-App/1.0',
      };

      if (options?.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || 30000
      );

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      this.requestCount++;

      const data = await response.json();

      // Log request
      this.requestLog.push({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        status: response.status,
        duration,
      });

      if (!response.ok) {
        console.error(`❌ API ${method} ${endpoint} [${response.status}]:`, data.error?.message);
        return {
          success: false,
          error: data.error || {
            message: `HTTP ${response.status}: ${response.statusText}`,
            statusCode: response.status,
          },
        };
      }

      console.log(`✓ API ${method} ${endpoint} [${response.status}] (${duration}ms)`);
      return data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ API ${method} ${endpoint} error:`, error.message);

      this.requestLog.push({
        timestamp: new Date().toISOString(),
        method,
        endpoint,
        status: 0,
        duration,
      });

      return {
        success: false,
        error: {
          message: error.message || 'Network error',
          statusCode: 0,
        },
      };
    }
  }

  /**
   * Submit a completed inspection. The server validates it, builds the PDF and stores both.
   * Reusing the same idempotency key makes retries safe (no duplicate records).
   */
  async createInspection(submission: object, idempotencyKey: string): Promise<ApiResponse<any>> {
    return this.request('POST', '/api/inspections', submission, { idempotencyKey });
  }

  /**
   * List the signed-in user's inspections, newest first
   */
  async getInspections(filters?: {
    page?: number;
    limit?: number;
    formId?: string;
  }): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.formId) params.append('formId', filters.formId);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/api/inspections${query}`);
  }

  /**
   * Get inspection by ID
   */
  async getInspection(id: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/api/inspections/${encodeURIComponent(id)}`);
  }

  /**
   * Delete inspection
   */
  async deleteInspection(id: string): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/api/inspections/${encodeURIComponent(id)}`);
  }

  /**
   * Email the stored PDF of an inspection. The server chooses the mail settings.
   */
  async sendInspectionEmail(
    inspectionId: string,
    recipientEmail: string
  ): Promise<ApiResponse<any>> {
    return this.request('POST', `/api/inspections/${encodeURIComponent(inspectionId)}/send-email`, {
      recipientEmail,
    });
  }

  /**
   * Get inspection statistics
   */
  async getStatistics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/inspections/stats/summary');
  }

  /**
   * Render a PDF from the data entered so far (nothing is saved).
   */
  async previewPdf(submission: object): Promise<ArrayBuffer> {
    return this.requestPdf('POST', '/api/inspections/preview', submission);
  }

  /**
   * Download the stored PDF of a submitted inspection.
   */
  async getInspectionPdf(id: string): Promise<ArrayBuffer> {
    return this.requestPdf('GET', `/api/inspections/${encodeURIComponent(id)}/pdf`);
  }

  /**
   * Request a PDF as raw bytes. PDFs are binary, so they must never be read as text.
   */
  private async requestPdf(method: 'GET' | 'POST', endpoint: string, body?: object): Promise<ArrayBuffer> {
    if (!this.token) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error?.message || `Request failed (HTTP ${response.status})`);
    }
    return response.arrayBuffer();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as any);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get request statistics
   */
  getRequestStats() {
    return {
      totalRequests: this.requestCount,
      totalLogs: this.requestLog.length,
      avgDuration: this.requestLog.length > 0
        ? Math.round(
            this.requestLog.reduce((sum, log) => sum + log.duration, 0) /
              this.requestLog.length
          )
        : 0,
      recentLogs: this.requestLog.slice(-10),
    };
  }

  /**
   * Clear request logs
   */
  clearLogs(): void {
    this.requestLog = [];
    console.log('✓ Request logs cleared');
  }

  /**
   * Export request logs
   */
  exportLogs(): string {
    return JSON.stringify(this.requestLog, null, 2);
  }
}

// Export singleton instance
export default new ApiService();
