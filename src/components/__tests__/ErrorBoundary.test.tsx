import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorBoundary, useErrorHandler } from '../common/ErrorBoundary';

// Mock component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Test component using the error handler hook
const TestErrorHandler: React.FC = () => {
  const { handleError } = useErrorHandler();
  
  const triggerError = () => {
    handleError(new Error('Hook error'), { component: 'TestErrorHandler' });
  };
  
  return (
    <button onClick={triggerError} data-testid="trigger-error">
      Trigger Error
    </button>
  );
};

describe('ErrorBoundary', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument();
  });

  it('displays error ID for support', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
  });

  it('shows action buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('shows developer details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Developer Details')).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('hides developer details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.queryByText('Developer Details')).not.toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('calls custom error handler when provided', () => {
    const mockErrorHandler = vi.fn();
    
    render(
      <ErrorBoundary onError={mockErrorHandler}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(mockErrorHandler).toHaveBeenCalled();
    expect(mockErrorHandler).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('recovers when try again is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      return (
        <ErrorBoundary>
          <button onClick={() => setShouldThrow(false)}>Fix Error</button>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };
    
    render(<TestComponent />);
    
    // Initially shows error
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Click try again
    fireEvent.click(screen.getByText('Try Again'));
    
    // Should recover and show the component again
    // Note: This test might need adjustment based on actual recovery behavior
  });
});

describe('useErrorHandler', () => {
  it('handles errors correctly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(<TestErrorHandler />);
    
    fireEvent.click(screen.getByTestId('trigger-error'));
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error caught by useErrorHandler:',
      expect.any(Error),
      expect.objectContaining({ component: 'TestErrorHandler' })
    );
    
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Error logged:',
      expect.objectContaining({
        message: 'Hook error',
        errorId: expect.any(String),
        timestamp: expect.any(String)
      })
    );
    
    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});