import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import BacktestProgress from '../BacktestProgress';

const mockOnCancel = vi.fn();

describe('BacktestProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders progress indicator with correct information', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing market data...',
      canCancel: true
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    expect(screen.getByText('Backtest in Progress')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Current Step:')).toBeInTheDocument();
    expect(screen.getByText('Processing market data...')).toBeInTheDocument();
  });

  it('shows correct progress text based on progress value', () => {
    const testCases = [
      { progress: 0, expectedText: 'Initializing...' },
      { progress: 15, expectedText: 'Loading historical data...' },
      { progress: 35, expectedText: 'Processing market data...' },
      { progress: 55, expectedText: 'Executing strategy...' },
      { progress: 75, expectedText: 'Calculating metrics...' },
      { progress: 95, expectedText: 'Finalizing results...' },
      { progress: 100, expectedText: 'Completed!' }
    ];

    testCases.forEach(({ progress, expectedText }) => {
      const progressData = {
        isRunning: true,
        progress,
        currentStep: 'Test step',
        canCancel: true
      };

      const { rerender } = render(<BacktestProgress progress={progressData} onCancel={mockOnCancel} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      rerender(<div />); // Clear for next test
    });
  });

  it('shows correct progress bar color based on progress', () => {
    const testCases = [
      { progress: 25, expectedClass: 'bg-blue-500' },
      { progress: 50, expectedClass: 'bg-yellow-500' },
      { progress: 85, expectedClass: 'bg-green-500' }
    ];

    testCases.forEach(({ progress, expectedClass }) => {
      const progressData = {
        isRunning: true,
        progress,
        currentStep: 'Test step',
        canCancel: true
      };

      const { container, rerender } = render(<BacktestProgress progress={progressData} onCancel={mockOnCancel} />);
      const progressBar = container.querySelector(`.${expectedClass}`);
      expect(progressBar).toBeInTheDocument();
      rerender(<div />); // Clear for next test
    });
  });

  it('displays process steps with correct status', () => {
    const progress = {
      isRunning: true,
      progress: 65,
      currentStep: 'Executing strategy...',
      canCancel: true
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    expect(screen.getByText('Data Loading')).toBeInTheDocument();
    expect(screen.getByText('Strategy Execution')).toBeInTheDocument();
    expect(screen.getByText('Results Calculation')).toBeInTheDocument();
    expect(screen.getByText('Report Generation')).toBeInTheDocument();
  });

  it('shows estimated time remaining based on progress', () => {
    const testCases = [
      { progress: 15, expectedTime: '3-5 minutes' },
      { progress: 35, expectedTime: '2-3 minutes' },
      { progress: 65, expectedTime: '1-2 minutes' },
      { progress: 85, expectedTime: 'Less than 1 minute' }
    ];

    testCases.forEach(({ progress, expectedTime }) => {
      const progressData = {
        isRunning: true,
        progress,
        currentStep: 'Test step',
        canCancel: true
      };

      const { rerender } = render(<BacktestProgress progress={progressData} onCancel={mockOnCancel} />);
      expect(screen.getByText(expectedTime)).toBeInTheDocument();
      rerender(<div />); // Clear for next test
    });
  });

  it('shows cancel button when cancellation is allowed', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: true
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByText('Cancel Backtest');
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).not.toBeDisabled();
  });

  it('hides cancel button when cancellation is not allowed', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: false
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    expect(screen.queryByText('Cancel Backtest')).not.toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: true
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByText('Cancel Backtest');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('displays warning message about not closing the application', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: true
    };

    render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    expect(screen.getByText("Please don't close the application")).toBeInTheDocument();
    expect(screen.getByText("Closing the app will cancel the backtest and you'll lose progress.")).toBeInTheDocument();
  });

  it('shows progress bar animation', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: true
    };

    const { container } = render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    const progressBar = container.querySelector('[style*="width: 45%"]');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveClass('transition-all', 'duration-500', 'ease-out');
  });

  it('shows pulsing animation for current step indicator', () => {
    const progress = {
      isRunning: true,
      progress: 45,
      currentStep: 'Processing...',
      canCancel: true
    };

    const { container } = render(<BacktestProgress progress={progress} onCancel={mockOnCancel} />);

    const pulsingDot = container.querySelector('.animate-pulse');
    expect(pulsingDot).toBeInTheDocument();
  });
});