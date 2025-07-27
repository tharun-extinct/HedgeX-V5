import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ErrorProvider, useError, useApiError, useFormError, useAsyncOperation } from '../ErrorContext';

// Test component that uses the error context
const TestErrorComponent: React.FC = () => {
  const { 
    errors, 
    addError, 
    removeError, 
    clearErrors, 
    addErrorMessage, 
    addWarning, 
    addInfo, 
    addSuccess,
    hasErrors,
    hasErrorsOfType,
    getErrorsByType
  } = useError();
  
  return (
    <div>
      <div data-testid="error-count">{errors.length}</div>
      <div data-testid="has-errors">{hasErrors().toString()}</div>
      <div data-testid="has-error-type">{hasErrorsOfType('error').toString()}</div>
      <div data-testid="error-type-count">{getErrorsByType('error').length}</div>
      
      <button 
        onClick={() => addErrorMessage('Test error message')}
        data-testid="add-error"
      >
        Add Error
      </button>
      
      <button 
        onClick={() => addWarning('Test warning message')}
        data-testid="add-warning"
      >
        Add Warning
      </button>
      
      <button 
        onClick={() => addInfo('Test info message')}
        data-testid="add-info"
      >
        Add Info
      </button>
      
      <button 
        onClick={() => addSuccess('Test success message')}
        data-testid="add-success"
      >
        Add Success
      </button>
      
      <button 
        onClick={() => clearErrors()}
        data-testid="clear-errors"
      >
        Clear Errors
      </button>
      
      {errors.map(error => (
        <div key={error.id} data-testid={`error-${error.type}`}>
          <span>{error.message}</span>
          <button 
            onClick={() => removeError(error.id)}
            data-testid={`remove-${error.id}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

// Test component for API error handling
const TestApiErrorComponent: React.FC = () => {
  const { handleApiError } = useApiError();
  
  const simulateApiError = () => {
    const mockError = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: { message: 'Server error occurred' }
      },
      config: {
        url: '/api/test',
        method: 'GET'
      }
    };
    
    handleApiError(mockError, { userId: 'test-user' });
  };
  
  return (
    <button onClick={simulateApiError} data-testid="simulate-api-error">
      Simulate API Error
    </button>
  );
};

// Test component for form error handling
const TestFormErrorComponent: React.FC = () => {
  const { addFieldError, clearFieldErrors } = useFormError();
  
  return (
    <div>
      <button 
        onClick={() => addFieldError('email', 'Invalid email format')}
        data-testid="add-field-error"
      >
        Add Field Error
      </button>
      
      <button 
        onClick={() => clearFieldErrors()}
        data-testid="clear-field-errors"
      >
        Clear Field Errors
      </button>
    </div>
  );
};

// Test component for async operations
const TestAsyncOperationComponent: React.FC = () => {
  const { execute, loading } = useAsyncOperation();
  const [result, setResult] = React.useState<string | null>(null);
  
  const runSuccessfulOperation = async () => {
    const result = await execute(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'Success!';
      },
      {
        loadingMessage: 'Processing...',
        successMessage: 'Operation completed successfully',
        errorContext: { operation: 'test-success' }
      }
    );
    setResult(result);
  };
  
  const runFailingOperation = async () => {
    const result = await execute(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Operation failed');
      },
      {
        loadingMessage: 'Processing...',
        errorContext: { operation: 'test-failure' }
      }
    );
    setResult(result);
  };
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="result">{result || 'No result'}</div>
      
      <button 
        onClick={runSuccessfulOperation}
        data-testid="run-success"
      >
        Run Successful Operation
      </button>
      
      <button 
        onClick={runFailingOperation}
        data-testid="run-failure"
      >
        Run Failing Operation
      </button>
    </div>
  );
};

describe('ErrorContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides error context to children', () => {
    render(
      <ErrorProvider>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('0');
    expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
  });

  it('adds and removes errors correctly', () => {
    render(
      <ErrorProvider>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add an error
    fireEvent.click(screen.getByTestId('add-error'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    expect(screen.getByTestId('has-errors')).toHaveTextContent('true');
    expect(screen.getByTestId('has-error-type')).toHaveTextContent('true');
    expect(screen.getByTestId('error-type-count')).toHaveTextContent('1');
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    
    // Remove the error
    const removeButton = screen.getByTestId(/remove-/);
    fireEvent.click(removeButton);
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('0');
    expect(screen.getByTestId('has-errors')).toHaveTextContent('false');
  });

  it('adds different types of messages', () => {
    render(
      <ErrorProvider>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add different types of messages
    fireEvent.click(screen.getByTestId('add-error'));
    fireEvent.click(screen.getByTestId('add-warning'));
    fireEvent.click(screen.getByTestId('add-info'));
    fireEvent.click(screen.getByTestId('add-success'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('4');
    expect(screen.getByTestId('error-error')).toBeInTheDocument();
    expect(screen.getByTestId('error-warning')).toBeInTheDocument();
    expect(screen.getByTestId('error-info')).toBeInTheDocument();
    expect(screen.getByTestId('error-success')).toBeInTheDocument();
  });

  it('clears all errors', () => {
    render(
      <ErrorProvider>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add multiple errors
    fireEvent.click(screen.getByTestId('add-error'));
    fireEvent.click(screen.getByTestId('add-warning'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('2');
    
    // Clear all errors
    fireEvent.click(screen.getByTestId('clear-errors'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('0');
  });

  it('respects maxErrors limit', () => {
    render(
      <ErrorProvider maxErrors={2}>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add more errors than the limit
    fireEvent.click(screen.getByTestId('add-error'));
    fireEvent.click(screen.getByTestId('add-warning'));
    fireEvent.click(screen.getByTestId('add-info'));
    
    // Should only keep the most recent 2 errors
    expect(screen.getByTestId('error-count')).toHaveTextContent('2');
  });

  it('auto-removes non-error messages after delay', async () => {
    render(
      <ErrorProvider autoRemoveDelay={100}>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add a warning (should auto-remove)
    fireEvent.click(screen.getByTestId('add-warning'));
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    
    // Wait for auto-removal
    await waitFor(() => {
      expect(screen.getByTestId('error-count')).toHaveTextContent('0');
    }, { timeout: 200 });
  });

  it('does not auto-remove error messages', async () => {
    render(
      <ErrorProvider autoRemoveDelay={100}>
        <TestErrorComponent />
      </ErrorProvider>
    );
    
    // Add an error (should not auto-remove)
    fireEvent.click(screen.getByTestId('add-error'));
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    
    // Wait and check it's still there
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
  });
});

describe('useApiError', () => {
  it('handles API errors correctly', () => {
    const TestComponent = () => {
      const { errors } = useError();
      return (
        <div>
          <div data-testid="error-count">{errors.length}</div>
          <TestApiErrorComponent />
          {errors.map(error => (
            <div key={error.id} data-testid="api-error">
              {error.message}
            </div>
          ))}
        </div>
      );
    };
    
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    fireEvent.click(screen.getByTestId('simulate-api-error'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    expect(screen.getByTestId('api-error')).toHaveTextContent('Server error occurred');
  });
});

describe('useFormError', () => {
  it('handles form field errors', () => {
    const TestComponent = () => {
      const { errors } = useError();
      return (
        <div>
          <div data-testid="error-count">{errors.length}</div>
          <TestFormErrorComponent />
          {errors.map(error => (
            <div key={error.id} data-testid="form-error">
              {error.message}
            </div>
          ))}
        </div>
      );
    };
    
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    fireEvent.click(screen.getByTestId('add-field-error'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    expect(screen.getByTestId('form-error')).toHaveTextContent('Invalid email format');
    
    fireEvent.click(screen.getByTestId('clear-field-errors'));
    
    expect(screen.getByTestId('error-count')).toHaveTextContent('0');
  });
});

describe('useAsyncOperation', () => {
  it('handles successful async operations', async () => {
    const TestComponent = () => {
      const { errors } = useError();
      return (
        <div>
          <div data-testid="error-count">{errors.length}</div>
          <TestAsyncOperationComponent />
          {errors.map(error => (
            <div key={error.id} data-testid={`async-${error.type}`}>
              {error.message}
            </div>
          ))}
        </div>
      );
    };
    
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    fireEvent.click(screen.getByTestId('run-success'));
    
    // Should show loading
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('result')).toHaveTextContent('Success!');
    });
    
    // Should have info and success messages
    expect(screen.getByTestId('async-info')).toHaveTextContent('Processing...');
    expect(screen.getByTestId('async-success')).toHaveTextContent('Operation completed successfully');
  });

  it('handles failing async operations', async () => {
    const TestComponent = () => {
      const { errors } = useError();
      return (
        <div>
          <div data-testid="error-count">{errors.length}</div>
          <TestAsyncOperationComponent />
          {errors.map(error => (
            <div key={error.id} data-testid={`async-${error.type}`}>
              {error.message}
            </div>
          ))}
        </div>
      );
    };
    
    render(
      <ErrorProvider>
        <TestComponent />
      </ErrorProvider>
    );
    
    fireEvent.click(screen.getByTestId('run-failure'));
    
    // Should show loading
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('result')).toHaveTextContent('No result');
    });
    
    // Should have info and error messages
    expect(screen.getByTestId('async-info')).toHaveTextContent('Processing...');
    expect(screen.getByTestId('async-error')).toHaveTextContent('Operation failed');
  });
});