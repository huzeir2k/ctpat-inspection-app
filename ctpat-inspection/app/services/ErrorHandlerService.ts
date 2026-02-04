/**
 * Error Handler Service
 * Centralizes error handling and formatting for consistent UX across all devices
 */

export interface ErrorInfo {
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
}

class ErrorHandlerService {
  /**
   * Format any error into a user-friendly message
   */
  formatError(error: any): ErrorInfo {
    console.error('Error caught:', error);

    // Handle null/undefined
    if (!error) {
      return {
        message: 'Unknown error',
        userMessage: 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR',
      };
    }

    // Handle Error objects
    if (error instanceof Error) {
      return this.formatErrorObject(error);
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        message: error,
        userMessage: error,
        code: 'STRING_ERROR',
      };
    }

    // Handle objects with message property
    if (typeof error === 'object' && error.message) {
      return this.formatErrorObject(error);
    }

    // Fallback
    return {
      message: JSON.stringify(error),
      userMessage: 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      details: error,
    };
  }

  /**
   * Format Error object with specific handling for common errors
   */
  private formatErrorObject(error: Error): ErrorInfo {
    const message = error.message || '';

    // Network errors
    if (message.includes('Network request failed') || 
        message.includes('network') ||
        message.includes('timeout')) {
      return {
        message,
        userMessage: 'Network connection failed. Please check your internet connection and try again.',
        code: 'NETWORK_ERROR',
        details: error,
      };
    }

    // AsyncStorage errors
    if (message.includes('AsyncStorage')) {
      return {
        message,
        userMessage: 'Failed to save data. Please try again.',
        code: 'STORAGE_ERROR',
        details: error,
      };
    }

    // File system errors
    if (message.includes('File') || message.includes('file')) {
      return {
        message,
        userMessage: 'Failed to access file. Please ensure app has necessary permissions.',
        code: 'FILE_ERROR',
        details: error,
      };
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('token') || message.includes('401')) {
      return {
        message,
        userMessage: 'Authentication failed. Please log in again.',
        code: 'AUTH_ERROR',
        details: error,
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        message,
        userMessage: 'Please check your input and try again.',
        code: 'VALIDATION_ERROR',
        details: error,
      };
    }

    // Permission errors
    if (message.includes('permission') || message.includes('denied')) {
      return {
        message,
        userMessage: 'App does not have permission. Please enable it in settings.',
        code: 'PERMISSION_ERROR',
        details: error,
      };
    }

    // Email errors
    if (message.includes('email') || message.includes('mail')) {
      return {
        message,
        userMessage: 'Failed to send email. Please try again.',
        code: 'EMAIL_ERROR',
        details: error,
      };
    }

    // PDF errors
    if (message.includes('pdf') || message.includes('PDF')) {
      return {
        message,
        userMessage: 'Failed to generate PDF. Please try again.',
        code: 'PDF_ERROR',
        details: error,
      };
    }

    // Default
    return {
      message,
      userMessage: message || 'An unexpected error occurred. Please try again.',
      code: 'GENERIC_ERROR',
      details: error,
    };
  }

  /**
   * Log error safely for debugging (doesn't crash on circular references)
   */
  logError(context: string, error: any): void {
    try {
      console.error(`[${context}]`, error);
    } catch (e) {
      console.error(`[${context}] Failed to log error`);
    }
  }

  /**
   * Check if error is critical (app-breaking)
   */
  isCriticalError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return message.includes('invariant') ||
           message.includes('fatal') ||
           message.includes('crash') ||
           message.includes('cannot read property');
  }

  /**
   * Get retry-able status
   */
  isRetryAble(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    
    return message.includes('network') ||
           message.includes('timeout') ||
           message.includes('temporarily unavailable');
  }
}

export default new ErrorHandlerService();
