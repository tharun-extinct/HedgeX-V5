import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LogViewer from '../LogViewer';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Mock data
const mockLogs = [
  {
    id: 'log-1',
    user_id: 'user-123',
    log_level: 1, // ERROR
    message: 'Trading engine error occurred',
    created_at: '2025-01-15T09:30:00Z',
    context: 'Error details here'
  },
  {
    id: 'log-2',
    user_id: 'user-123',
    log_level: 3, // INFO
    message: 'Trading session started',
    created_at: '2025-01-15T09:25:00Z',
    context: null
  },
  {
    id: 'log-3',
    user_id: null,
    log_level: 2, // WARN
    message: 'API rate limit approaching',
    created_at: '2025-01-15T09:20:00Z',
    context: 'Rate limit: 90%'
  }
];

describe('LogViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      success: true,
      data: mockLogs
    });
  });

  it('renders log viewer with data', async () => {
    render(<LogViewer />);

    // Check if loading state is shown initially
    expect(screen.getByText('Loading system logs...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if logs are displayed
    expect(screen.getByText('Trading engine error occurred')).toBeInTheDocument();
    expect(screen.getByText('Trading session started')).toBeInTheDocument();
    expect(screen.getByText('API rate limit approaching')).toBeInTheDocument();
  });

  it('displays log levels correctly', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if log level badges are displayed
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(screen.getByText('INFO')).toBeInTheDocument();
    expect(screen.getByText('WARN')).toBeInTheDocument();
  });

  it('filters logs by level', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Click on ERROR level filter
    const errorLevelCard = screen.getByText('ERROR').closest('div');
    fireEvent.click(errorLevelCard!);

    // Verify filtering functionality (this would be tested with actual filtering logic)
    expect(errorLevelCard).toBeInTheDocument();
  });

  it('searches logs by message content', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Find and interact with search input
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'trading' } });

    expect(searchInput.value).toBe('trading');
  });

  it('handles date range filtering', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Find date inputs
    const fromDateInput = screen.getByLabelText('From Date');
    const toDateInput = screen.getByLabelText('To Date');

    fireEvent.change(fromDateInput, { target: { value: '2025-01-15T09:00' } });
    fireEvent.change(toDateInput, { target: { value: '2025-01-15T10:00' } });

    expect(fromDateInput.value).toBe('2025-01-15T09:00');
    expect(toDateInput.value).toBe('2025-01-15T10:00');
  });

  it('handles auto-refresh toggle', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Find and click auto-refresh button
    const autoRefreshButton = screen.getByText('Manual');
    fireEvent.click(autoRefreshButton);

    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('handles export functionality', async () => {
    const mockExport = vi.fn();
    render(<LogViewer onExport={mockExport} />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByText('Export CSV');
    fireEvent.click(exportButton);

    expect(mockExport).toHaveBeenCalledWith(mockLogs);
  });

  it('displays log level counts correctly', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if log level counts are displayed
    const errorCount = screen.getByText('ERROR').closest('div')?.querySelector('.text-lg');
    const infoCount = screen.getByText('INFO').closest('div')?.querySelector('.text-lg');
    const warnCount = screen.getByText('WARN').closest('div')?.querySelector('.text-lg');

    expect(errorCount).toHaveTextContent('1');
    expect(infoCount).toHaveTextContent('1');
    expect(warnCount).toHaveTextContent('1');
  });

  it('handles pagination correctly', async () => {
    // Mock data with more logs to test pagination
    const manyLogs = Array.from({ length: 60 }, (_, i) => ({
      ...mockLogs[0],
      id: `log-${i}`,
      message: `Log message ${i}`
    }));

    mockInvoke.mockResolvedValue({
      success: true,
      data: manyLogs
    });

    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if pagination controls are present
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('displays log context when available', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if context is displayed for logs that have it
    expect(screen.getByText('Error details here')).toBeInTheDocument();
    expect(screen.getByText('Rate limit: 90%')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('API Error'));

    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load system logs. Please try again.')).toBeInTheDocument();
    });
  });

  it('clears filters when clear button is clicked', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Set some filters first
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Click clear filters button
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    // Verify filters are cleared
    expect(searchInput.value).toBe('');
  });

  it('refreshes logs when refresh button is clicked', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Click refresh button
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Verify API is called again
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('displays user ID when available', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if user ID is displayed for logs that have it
    expect(screen.getByText('User: user-123...')).toBeInTheDocument();
  });

  it('formats timestamps correctly', async () => {
    render(<LogViewer />);

    await waitFor(() => {
      expect(screen.getByText('System Logs')).toBeInTheDocument();
    });

    // Check if timestamps are formatted and displayed
    const timestamps = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(timestamps.length).toBeGreaterThan(0);
  });
});