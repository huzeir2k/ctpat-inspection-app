/**
 * Email Queue Service (Frontend)
 * Manages email sending via backend with offline queueing
 * 
 * Complements existing EmailService which uses native mail composer
 * This service handles backend-driven email with PDF attachment
 */

import ApiService from './ApiService';
import ErrorHandlerService from './ErrorHandlerService';
import PdfService from './PdfService';
import { InspectionForm, InspectionPoint } from '../models/InspectionChecklist';
import { StoredSignature } from './SignatureService';

interface SendInspectionEmailOptions {
  inspectionId: string;
  recipientEmail: string;
  inspectionData: InspectionForm;
  inspectionPoints: InspectionPoint[];
  inspectorSignature?: StoredSignature | null;
  verifiedBySignature?: StoredSignature | null;
  includeAttachment?: boolean;
}

interface EmailQueueStatus {
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

// Base URL retrieval - stored globally on app startup
let BACKEND_BASE_URL = 'http://localhost:3000';

/**
 * EmailQueueService - Frontend integration with backend email queue
 */
class EmailQueueService {
  private static instance: EmailQueueService;

  private constructor() {}

  static getInstance(): EmailQueueService {
    if (!EmailQueueService.instance) {
      EmailQueueService.instance = new EmailQueueService();
    }
    return EmailQueueService.instance;
  }

  /**
   * Set backend URL (called from _layout.tsx after backend starts)
   */
  static setBackendUrl(url: string): void {
    BACKEND_BASE_URL = url;
    console.log('[EmailQueue] Backend URL set to:', url);
  }

  /**
   * Send inspection report via backend email service
   * Email will be queued if offline or SMTP not configured
   * 
   * @param options - Email options
   * @returns Promise with send result
   */
  async sendInspectionEmail(options: SendInspectionEmailOptions) {
    try {
      console.log('[EmailQueue] Sending inspection email via backend...');
      console.log('  Inspection ID:', options.inspectionId);
      console.log('  Recipient:', options.recipientEmail);

      const payload = {
        inspectionId: options.inspectionId,
        recipientEmail: options.recipientEmail,
        inspectionData: {
          truckNumber: options.inspectionData.truckNumber,
          trailerNumber: options.inspectionData.trailerNumber,
          sealNumber: options.inspectionData.sealNumber,
          date: options.inspectionData.date,
          time: options.inspectionData.time,
          printName: options.inspectionData.printName,
          verifiedByName: options.inspectionData.verifiedByName,
          securityCheckboxChecked: options.inspectionData.securityCheckboxChecked,
          agriculturalPestCheckboxChecked: options.inspectionData.agriculturalPestCheckboxChecked,
          notes: options.inspectionData.notes || '',
        },
        inspectionPoints: options.inspectionPoints.map(point => ({
          id: point.id,
          title: point.title,
          description: point.description,
          checked: point.checked,
        })),
        includeAttachment: options.includeAttachment !== false,
      };

      // Call backend endpoint
      const response = await this.callBackendEndpoint(
        '/api/emails/send-inspection',
        'POST',
        payload
      );

      if (response?.success) {
        const queued = response.data?.queued || false;
        const status = queued ? 'queued' : 'sent';
        
        console.log(`✓ Email ${status} successfully`);
        console.log(`  Status: ${status}`);
        if (response.data?.messageId) {
          console.log(`  Message ID: ${response.data.messageId}`);
        }

        return {
          success: true,
          queued,
          status,
          ...response.data,
        };
      } else {
        throw new Error(response?.error?.message || 'Unknown error');
      }
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      ErrorHandlerService.logError('EmailQueueService.sendInspectionEmail', error);
      
      return {
        success: false,
        queued: false,
        error: errorInfo.message,
      };
    }
  }

  /**
   * Get email queue statistics
   * @returns Promise with queue stats
   */
  async getQueueStats(): Promise<EmailQueueStatus | null> {
    try {
      console.log('[EmailQueue] Fetching queue statistics...');

      const response = await this.callBackendEndpoint(
        '/api/emails/queue-stats',
        'GET'
      );

      if (response?.success) {
        console.log('[EmailQueue] Queue stats:', response.data?.queue);
        return response.data?.queue || null;
      }

      return null;
    } catch (error) {
      ErrorHandlerService.logError('EmailQueueService.getQueueStats', error);
      return null;
    }
  }

  /**
   * Process queued emails when online
   * Manually trigger email queue processing
   */
  async processQueue(limit: number = 5) {
    try {
      console.log('[EmailQueue] Processing queued emails...');

      const response = await this.callBackendEndpoint(
        '/api/emails/process-queue',
        'POST',
        { limit }
      );

      if (response?.success) {
        const { sent, failed, processed } = response.data || {};
        console.log(`✓ Queue processed: ${sent} sent, ${failed} failed`);
        
        return {
          success: true,
          sent,
          failed,
          processed,
        };
      }

      return { success: false, sent: 0, failed: 0, processed: 0 };
    } catch (error) {
      ErrorHandlerService.logError('EmailQueueService.processQueue', error);
      return { success: false, sent: 0, failed: 0, processed: 0 };
    }
  }

  /**
   * Get email history for a specific inspection
   * @param inspectionId - Inspection ID
   */
  async getInspectionEmailHistory(inspectionId: string) {
    try {
      console.log('[EmailQueue] Getting email history for inspection:', inspectionId);

      const response = await this.callBackendEndpoint(
        `/api/emails/inspection/${inspectionId}`,
        'GET'
      );

      if (response?.success) {
        console.log(`[EmailQueue] Found ${response.data?.count || 0} email(s)`);
        return response.data?.emails || [];
      }

      return [];
    } catch (error) {
      ErrorHandlerService.logError('EmailQueueService.getInspectionEmailHistory', error);
      return [];
    }
  }

  /**
   * Get all queued emails
   */
  async getQueue() {
    try {
      console.log('[EmailQueue] Fetching email queue...');

      const response = await this.callBackendEndpoint(
        '/api/emails/queue',
        'GET'
      );

      if (response?.success) {
        console.log(`[EmailQueue] Queue contains ${response.data?.count || 0} email(s)`);
        return response.data?.emails || [];
      }

      return [];
    } catch (error) {
      ErrorHandlerService.logError('EmailQueueService.getQueue', error);
      return [];
    }
  }

  /**
   * Test SMTP connection
   */
  async testConnection() {
    try {
      console.log('[EmailQueue] Testing SMTP connection...');

      const response = await this.callBackendEndpoint(
        '/api/emails/test-connection',
        'POST'
      );

      if (response?.success) {
        const connected = response.data?.connected || false;
        console.log(`[EmailQueue] SMTP ${connected ? '✓ connected' : '✗ not connected'}`);
        
        return {
          success: true,
          connected,
          message: response.data?.message,
        };
      }

      return { success: false, connected: false };
    } catch (error) {
      ErrorHandlerService.logError('EmailQueueService.testConnection', error);
      return { success: false, connected: false };
    }
  }

  /**
   * Internal: Call backend endpoint without auth
   * (These endpoints don't require authentication)
   */
  private async callBackendEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<any> {
    try {
      const baseUrl = BACKEND_BASE_URL;
      const url = `${baseUrl}${endpoint}`;

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CTPAT-Inspection-App/1.0',
        },
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const errorInfo = ErrorHandlerService.formatError(error);
      throw new Error(errorInfo.message);
    }
  }
}

export default EmailQueueService;
