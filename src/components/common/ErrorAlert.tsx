import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw, Info, AlertCircle, CheckCircle } from 'lucide-react';

export interface ErrorAlertProps {
  error: string | null;
  type?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  dismissible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
  showRetry?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  type = 'error',
  title,
  dismissible = true,
  autoHide = false,
  autoHideDelay = 5000,
  onDismiss,
  onRetry,
  className = '',
  showRetry = false,
}) => {
  const [isVisible, setIsVisible] = useState(!!error);

  useEffect(() => {
    setIsVisible(!!error);
  }, [error]);

  useEffect(() => {
    if (autoHide && isVisible && error) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, isVisible, error]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  if (!isVisible || !error) {
    return null;
  }

  const getAlertStyles = () => {
    const baseStyles = 'rounded-lg border p-4 mb-4';
    
    switch (type) {
      case 'error':
        return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
      case 'success':
        return `${baseStyles} bg-green-50 border-green-200 text-green-800`;
      default:
        return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
    }
  };

  const getIcon = () => {
    const iconClass = 'w-5 h-5 flex-shrink-0';
    
    switch (type) {
      case 'error':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'warning':
        return <AlertCircle className={`${iconClass} text-yellow-500`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-500`} />;
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      default:
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    
    switch (type) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      case 'success':
        return 'Success';
      default:
        return 'Error';
    }
  };

  return (
    <div className={`${getAlertStyles()} ${className}`} role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {getTitle()}
          </h3>
          
          <div className="mt-1 text-sm">
            {typeof error === 'string' ? (
              <p>{error}</p>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs">
                {JSON.stringify(error, null, 2)}
              </pre>
            )}
          </div>
          
          {showRetry && onRetry && (
            <div className="mt-3">
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </button>
            </div>
          )}
        </div>
        
        {dismissible && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={handleDismiss}
                className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  type === 'error' 
                    ? 'text-red-500 hover:bg-red-100 focus:ring-red-500'
                    : type === 'warning'
                    ? 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-500'
                    : type === 'info'
                    ? 'text-blue-500 hover:bg-blue-100 focus:ring-blue-500'
                    : 'text-green-500 hover:bg-green-100 focus:ring-green-500'
                }`}
              >
                <span className="sr-only">Dismiss</span>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Toast-style error notification
export interface ErrorToastProps extends Omit<ErrorAlertProps, 'className'> {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  position = 'top-right',
  ...props
}) => {
  const getPositionStyles = () => {
    const baseStyles = 'fixed z-50 max-w-sm w-full';
    
    switch (position) {
      case 'top-right':
        return `${baseStyles} top-4 right-4`;
      case 'top-left':
        return `${baseStyles} top-4 left-4`;
      case 'bottom-right':
        return `${baseStyles} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseStyles} bottom-4 left-4`;
      case 'top-center':
        return `${baseStyles} top-4 left-1/2 transform -translate-x-1/2`;
      case 'bottom-center':
        return `${baseStyles} bottom-4 left-1/2 transform -translate-x-1/2`;
      default:
        return `${baseStyles} top-4 right-4`;
    }
  };

  return (
    <div className={getPositionStyles()}>
      <ErrorAlert
        {...props}
        className="shadow-lg"
        autoHide={props.autoHide ?? true}
      />
    </div>
  );
};

// Inline error message for form fields
export interface InlineErrorProps {
  error: string | null;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  error,
  className = '',
}) => {
  if (!error) return null;

  return (
    <div className={`flex items-center mt-1 text-sm text-red-600 ${className}`}>
      <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
};

// Error state component for empty states
export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};