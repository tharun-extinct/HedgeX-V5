import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
  component?: string;
  action?: string;
  retryable?: boolean;
  onRetry?: () => void | Promise<void>;
}

interface ErrorContextType {
  errors: ErrorInfo[];
  addError: (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => string;
  removeError: (id: string) => void;
  clearErrors: () => void;
  clearErrorsByType: (type: ErrorInfo['type']) => void;
  getErrorsByType: (type: ErrorInfo['type']) => ErrorInfo[];
  hasErrors: () => boolean;
  hasErrorsOfType: (type: ErrorInfo['type']) => boolean;
  
  // Convenience methods
  addErrorMessage: (message: string, context?: Record<string, any>) => string;
  addWarning: (message: string, context?: Record<string, any>) => string;
  addInfo: (message: string, context?: Record<string, any>) => string;
  addSuccess: (message: string, context?: Record<string, any>) => string;
  
  // Global error handler
  handleError: (error: Error | string, context?: Record<string, any>) => string;
  handleAsyncError: (promise: Promise<any>, context?: Record<string, any>) => Promise<any>;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

interface ErrorProviderProps {
  children: ReactNode;
  maxErrors?: number;
  autoRemoveDelay?: number;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({
  children,
  maxErrors = 10,
  autoRemoveDelay = 5000,
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  const generateId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addError = useCallback((errorData: Omit<ErrorInfo, 'id' | 'timestamp'>) => {
    const id = generateId();
    const newError: ErrorInfo = {
      ...errorData,
      id,
      timestamp: new Date(),
    };

    setErrors(prev => {
      const updated = [newError, ...prev];
      
      // Limit the number of errors
      if (updated.length > maxErrors) {
        return updated.slice(0, maxErrors);
      }
      
      return updated;
    });

    // Auto-remove error after delay (except for errors that require user action)
    if (autoRemoveDelay > 0 && errorData.type !== 'error') {
      setTimeout(() => {
        removeError(id);
      }, autoRemoveDelay);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error added to context:', newError);
    }

    // Log to backend (if available)
    logErrorToBackend(newError);

    return id;
  }, [generateId, maxErrors, autoRemoveDelay]);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearErrorsByType = useCallback((type: ErrorInfo['type']) => {
    setErrors(prev => prev.filter(error => error.type !== type));
  }, []);

  const getErrorsByType = useCallback((type: ErrorInfo['type']) => {
    return errors.filter(error => error.type === type);
  }, [errors]);

  const hasErrors = useCallback(() => {
    return errors.length > 0;
  }, [errors]);

  const hasErrorsOfType = useCallback((type: ErrorInfo['type']) => {
    return errors.some(error => error.type === type);
  }, [errors]);

  // Convenience methods
  const addErrorMessage = useCallback((message: string, context?: Record<string, any>) => {
    return addError({
      message,
      type: 'error',
      context,
    });
  }, [addError]);

  const addWarning = useCallback((message: string, context?: Record<string, any>) => {
    return addError({
      message,
      type: 'warning',
      context,
    });
  }, [addError]);

  const addInfo = useCallback((message: string, context?: Record<string, any>) => {
    return addError({
      message,
      type: 'info',
      context,
    });
  }, [addError]);

  const addSuccess = useCallback((message: string, context?: Record<string, any>) => {
    return addError({
      message,
      type: 'success',
      context,
    });
  }, [addError]);

  // Global error handler
  const handleError = useCallback((error: Error | string, context?: Record<string, any>) => {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;
    
    return addError({
      message,
      type: 'error',
      context,
      stack,
    });
  }, [addError]);

  // Async error handler
  const handleAsyncError = useCallback(async (promise: Promise<any>, context?: Record<string, any>) => {
    try {
      return await promise;
    } catch (error) {
      handleError(error as Error, context);
      throw error; // Re-throw so calling code can handle it
    }
  }, [handleError]);

  // Log error to backend
  const logErrorToBackend = useCallback(async (error: ErrorInfo) => {
    try {
      // In a real implementation, you would send this to your backend
      const errorData = {
        id: error.id,
        message: error.message,
        type: error.type,
        timestamp: error.timestamp.toISOString(),
        context: error.context,
        stack: error.stack,
        component: error.component,
        action: error.action,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      console.log('Error logged to backend:', errorData);
      
      // If using Tauri, you could invoke a backend command here
      // await invoke('log_frontend_error', { errorData });
    } catch (logError) {
      console.error('Failed to log error to backend:', logError);
    }
  }, []);

  const value: ErrorContextType = {
    errors,
    addError,
    removeError,
    clearErrors,
    clearErrorsByType,
    getErrorsByType,
    hasErrors,
    hasErrorsOfType,
    addErrorMessage,
    addWarning,
    addInfo,
    addSuccess,
    handleError,
    handleAsyncError,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

// Hook for handling API errors
export const useApiError = () => {
  const { handleError, addError } = useError();

  const handleApiError = useCallback((error: any, context?: Record<string, any>) => {
    let message = 'An unexpected error occurred';
    let errorContext = { ...context };

    if (error?.response) {
      // HTTP error response
      message = error.response.data?.message || error.response.statusText || message;
      errorContext = {
        ...errorContext,
        status: error.response.status,
        statusText: error.response.statusText,
        url: error.config?.url,
        method: error.config?.method,
      };
    } else if (error?.message) {
      // JavaScript error
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    return addError({
      message,
      type: 'error',
      context: errorContext,
      stack: error?.stack,
      retryable: error?.response?.status >= 500 || error?.code === 'NETWORK_ERROR',
    });
  }, [handleError, addError]);

  return { handleApiError };
};

// Hook for form validation errors
export const useFormError = () => {
  const { addError, removeError, clearErrorsByType } = useError();

  const addFieldError = useCallback((field: string, message: string) => {
    return addError({
      message,
      type: 'error',
      context: { field, type: 'validation' },
      component: 'form',
    });
  }, [addError]);

  const clearFieldErrors = useCallback(() => {
    clearErrorsByType('error');
  }, [clearErrorsByType]);

  return { addFieldError, clearFieldErrors, removeError };
};

// Hook for async operations with error handling
export const useAsyncOperation = () => {
  const { handleAsyncError, addError } = useError();
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async <T>(
    operation: () => Promise<T>,
    options?: {
      loadingMessage?: string;
      successMessage?: string;
      errorContext?: Record<string, any>;
    }
  ) => {
    setLoading(true);
    
    if (options?.loadingMessage) {
      addError({
        message: options.loadingMessage,
        type: 'info',
      });
    }

    try {
      const result = await handleAsyncError(operation(), options?.errorContext);
      
      if (options?.successMessage) {
        addError({
          message: options.successMessage,
          type: 'success',
        });
      }
      
      return result;
    } catch (error) {
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleAsyncError, addError]);

  return { execute, loading };
};