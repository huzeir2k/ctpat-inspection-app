/**
 * API Service for Backend Integration
 * Handles all communication with the CTPAT inspection backend
 */

import * as FileSystem from 'expo-file-system';

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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiService {
  private token: string | null = null;
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

    const url = `${API_BASE_URL}${endpoint}`;
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
   * Create inspection with PDF upload
   */
  async createInspection(
    inspectionData: any,
    pdfPath?: string
  ): Promise<ApiResponse<any>> {
    const payload: any = {
      ...inspectionData,
    };

    // Read and attach PDF if path provided
    if (pdfPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(pdfPath);
        if (!fileInfo.exists) {
          console.warn('PDF file not found:', pdfPath);
        } else {
          const base64Pdf = await FileSystem.readAsStringAsync(pdfPath, {
            encoding: 'base64',
          });
          payload.pdfData = base64Pdf;
          payload.pdfFileName = `CTPAT_${Date.now()}.pdf`;
          console.log('✓ PDF attached to request');
        }
      } catch (error) {
        console.warn('Could not read PDF file:', error);
        // Continue without PDF
      }
    }

    return this.request('POST', '/api/inspections', payload, {
      idempotencyKey: inspectionData.idempotencyKey,
    });
  }

  /**
   * Get all inspections with filters
   */
  async getInspections(filters?: {
    page?: number;
    limit?: number;
    status?: 'draft' | 'submitted' | 'archived';
    sortBy?: 'createdAt' | 'completedAt' | 'truckNumber';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();

    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request('GET', `/api/inspections${query}`);
  }

  /**
   * Get inspection by ID
   */
  async getInspection(id: string): Promise<ApiResponse<any>> {
    return this.request('GET', `/api/inspections/${id}`);
  }

  /**
   * Update inspection
   */
  async updateInspection(
    id: string,
    updates: {
      status?: 'draft' | 'submitted' | 'archived';
      notes?: string;
      inspectionPoints?: any[];
    }
  ): Promise<ApiResponse<any>> {
    return this.request('PUT', `/api/inspections/${id}`, updates);
  }

  /**
   * Delete inspection
   */
  async deleteInspection(id: string): Promise<ApiResponse<any>> {
    return this.request('DELETE', `/api/inspections/${id}`);
  }

  /**
   * Send inspection report via backend email with PDF
   */
  async sendInspectionEmail(
    inspectionId: string,
    recipientEmail: string,
    inspectionData?: any,
    inspectionPoints?: any
  ): Promise<ApiResponse<any>> {
    return this.request('POST', `/api/inspections/${inspectionId}/send-email`, {
      recipientEmail,
      inspectionData,
      inspectionPoints,
    });
  }

  /**
   * Get inspection statistics
   */
  async getStatistics(): Promise<ApiResponse<any>> {
    return this.request('GET', '/api/inspections/stats/summary');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
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
