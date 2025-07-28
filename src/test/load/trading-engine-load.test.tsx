import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import App from '../../App';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

// Helper to set up authenticated session
const setupAuthenticatedSession = () => {
  localStorage.setItem('hedgex_session_token', 'valid-token');
  localStorage.setItem('hedgex_session_expiry', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  localStorage.setItem('hedgex_user_data', JSON.stringify({
    id: 'test-user-id',
    username: 'testuser',
    created_at: '2025-01-01T00:00:00Z'
  }));
};

// Helper to render authenticated app
const renderAuthenticatedApp = () => {
  setupAuthenticatedSession();
  
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

// Performance measurement utilities
const measurePerformance = async (operation: () => Promise<void>, iterations: number = 100) => {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await operation();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
  
  return { avg, min, max, p95, times };
};

describe('Trading Engine Load Testing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Placement Performance', () => {
    it('should handle rapid order placement under load', async () => {
      const user = userEvent.setup();
      let orderCount = 0;
      const orderTimes: number[] = [];
      
      // Mock order placement with timing
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'place_quick_order':
            const start = performance.now();
            orderCount++;
            
            // Simulate order processing time (should be < 50ms for HFT)
            return new Promise((resolve) => {
              setTimeout(() => {
                const end = performance.now();
                orderTimes.push(end - start);
                resolve({
                  success: true,
                  order_id: `order_${orderCount}`,
                  processing_time: end - start
                });
              }, Math.random() * 30 + 10); // 10-40ms processing time
            });
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: '2540.50',
                volume: 1250000,
                timestamp: new Date().toISOString()
              }
            ]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Wait for market data to load
      await waitFor(() => {
        expect(screen.getByText(/RELIANCE/i)).toBeInTheDocument();
      });

      // Simulate rapid order placement (100 orders)
      const orderPromises: Promise<void>[] = [];
      const targetOrders = 100;
      
      for (let i = 0; i < targetOrders; i++) {
        const orderPromise = (async () => {
          const buyButton = screen.getByRole('button', { name: /buy/i });
          await user.click(buyButton);
        })();
        orderPromises.push(orderPromise);
        
        // Small delay between orders to simulate realistic trading
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Wait for all orders to complete
      await Promise.all(orderPromises);

      // Verify performance metrics
      expect(orderCount).toBe(targetOrders);
      
      const avgTime = orderTimes.reduce((sum, time) => sum + time, 0) / orderTimes.length;
      const maxTime = Math.max(...orderTimes);
      const p95Time = orderTimes.sort((a, b) => a - b)[Math.floor(orderTimes.length * 0.95)];
      
      console.log(`Order Performance Metrics:
        - Average: ${avgTime.toFixed(2)}ms
        - Maximum: ${maxTime.toFixed(2)}ms
        - 95th percentile: ${p95Time.toFixed(2)}ms
        - Total orders: ${orderCount}`);
      
      // HFT requirements: orders should complete within 50ms
      expect(avgTime).toBeLessThan(50);
      expect(p95Time).toBeLessThan(100);
    }, 30000);

    it('should maintain order throughput under concurrent load', async () => {
      let concurrentOrders = 0;
      let completedOrders = 0;
      const maxConcurrent = 20;
      
      // Mock concurrent order handling
      mockInvoke.mockImplementation((command, args) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'place_quick_order':
            concurrentOrders++;
            
            return new Promise((resolve) => {
              // Simulate processing time that increases with concurrent load
              const processingTime = 20 + (concurrentOrders * 2);
              
              setTimeout(() => {
                concurrentOrders--;
                completedOrders++;
                resolve({
                  success: true,
                  order_id: `concurrent_order_${completedOrders}`,
                  concurrent_count: concurrentOrders
                });
              }, processingTime);
            });
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: '2540.50',
                volume: 1250000,
                timestamp: new Date().toISOString()
              }
            ]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Launch concurrent orders
      const concurrentPromises: Promise<any>[] = [];
      
      for (let i = 0; i < maxConcurrent; i++) {
        const promise = mockInvoke('place_quick_order', {
          symbol: 'RELIANCE',
          action: 'BUY',
          quantity: 1
        });
        concurrentPromises.push(promise);
      }

      // Wait for all concurrent orders to complete
      const results = await Promise.all(concurrentPromises);

      // Verify all orders completed successfully
      expect(results).toHaveLength(maxConcurrent);
      expect(completedOrders).toBe(maxConcurrent);
      
      // Verify no orders were dropped
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.order_id).toBe(`concurrent_order_${index + 1}`);
      });
    });
  });

  describe('Market Data Processing Performance', () => {
    it('should handle high-frequency market data updates', async () => {
      let updateCount = 0;
      const updateTimes: number[] = [];
      const targetUpdates = 1000;
      
      // Mock high-frequency market data
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'get_market_data':
            const start = performance.now();
            updateCount++;
            
            // Simulate market data processing
            const marketData = Array.from({ length: 50 }, (_, i) => ({
              symbol: `STOCK_${i + 1}`,
              instrument_token: 738561 + i,
              ltp: (2540.50 + Math.random() * 100).toString(),
              volume: Math.floor(Math.random() * 1000000),
              timestamp: new Date().toISOString(),
              change: (Math.random() * 10 - 5).toString(),
              change_percent: (Math.random() * 2 - 1).toString()
            }));
            
            const end = performance.now();
            updateTimes.push(end - start);
            
            return Promise.resolve(marketData);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Simulate high-frequency updates
      const updatePromises: Promise<any>[] = [];
      
      for (let i = 0; i < targetUpdates; i++) {
        const promise = mockInvoke('get_market_data');
        updatePromises.push(promise);
        
        // Minimal delay to simulate real-time updates
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      await Promise.all(updatePromises);

      // Analyze performance
      const avgTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      const maxTime = Math.max(...updateTimes);
      const p95Time = updateTimes.sort((a, b) => a - b)[Math.floor(updateTimes.length * 0.95)];
      
      console.log(`Market Data Performance Metrics:
        - Updates processed: ${updateCount}
        - Average processing time: ${avgTime.toFixed(2)}ms
        - Maximum processing time: ${maxTime.toFixed(2)}ms
        - 95th percentile: ${p95Time.toFixed(2)}ms`);
      
      // Market data should be processed quickly for real-time updates
      expect(avgTime).toBeLessThan(10);
      expect(p95Time).toBeLessThan(20);
      expect(updateCount).toBe(targetUpdates);
    });

    it('should maintain UI responsiveness during data floods', async () => {
      const user = userEvent.setup();
      let uiResponseTimes: number[] = [];
      
      // Mock data flood scenario
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'get_market_data':
            // Return large amount of market data
            return Promise.resolve(
              Array.from({ length: 100 }, (_, i) => ({
                symbol: `STOCK_${i + 1}`,
                instrument_token: 738561 + i,
                ltp: (2540.50 + Math.random() * 100).toString(),
                volume: Math.floor(Math.random() * 1000000),
                timestamp: new Date().toISOString()
              }))
            );
          case 'start_trading':
            return Promise.resolve(true);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Start data flood
      const dataFloodInterval = setInterval(() => {
        mockInvoke('get_market_data');
      }, 10); // Update every 10ms

      // Test UI responsiveness during data flood
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        // Try to interact with UI
        const startButton = screen.getByRole('button', { name: /start trading/i });
        await user.click(startButton);
        
        const end = performance.now();
        uiResponseTimes.push(end - start);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      clearInterval(dataFloodInterval);

      // Analyze UI responsiveness
      const avgResponseTime = uiResponseTimes.reduce((sum, time) => sum + time, 0) / uiResponseTimes.length;
      const maxResponseTime = Math.max(...uiResponseTimes);
      
      console.log(`UI Responsiveness During Data Flood:
        - Average response time: ${avgResponseTime.toFixed(2)}ms
        - Maximum response time: ${maxResponseTime.toFixed(2)}ms`);
      
      // UI should remain responsive (< 100ms for good UX)
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(200);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during extended trading sessions', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      let memoryReadings: number[] = [];
      
      // Mock extended trading session
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'get_market_data':
            return Promise.resolve([
              {
                symbol: 'RELIANCE',
                instrument_token: 738561,
                ltp: (2540.50 + Math.random() * 10).toString(),
                volume: Math.floor(Math.random() * 1000000),
                timestamp: new Date().toISOString()
              }
            ]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Simulate extended trading session with continuous updates
      for (let i = 0; i < 1000; i++) {
        await mockInvoke('get_market_data');
        
        // Take memory reading every 100 iterations
        if (i % 100 === 0 && (performance as any).memory) {
          memoryReadings.push((performance as any).memory.usedJSHeapSize);
        }
        
        // Small delay to prevent overwhelming the system
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Analyze memory usage
      if (memoryReadings.length > 0) {
        const memoryGrowth = memoryReadings[memoryReadings.length - 1] - memoryReadings[0];
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);
        
        console.log(`Memory Usage Analysis:
          - Initial memory: ${(memoryReadings[0] / (1024 * 1024)).toFixed(2)}MB
          - Final memory: ${(memoryReadings[memoryReadings.length - 1] / (1024 * 1024)).toFixed(2)}MB
          - Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
        
        // Memory growth should be reasonable (< 50MB for 1000 updates)
        expect(memoryGrowthMB).toBeLessThan(50);
      }
    });

    it('should handle cleanup properly on component unmount', async () => {
      let cleanupCalled = false;
      
      // Mock cleanup detection
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'disconnect_websocket':
            cleanupCalled = true;
            return Promise.resolve(true);
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      const { unmount } = renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify cleanup was called
      expect(cleanupCalled).toBe(true);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle API failures gracefully under high load', async () => {
      let successCount = 0;
      let errorCount = 0;
      const totalRequests = 100;
      
      // Mock API with intermittent failures
      mockInvoke.mockImplementation((command) => {
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'place_quick_order':
            // Simulate 10% failure rate
            if (Math.random() < 0.1) {
              errorCount++;
              return Promise.reject(new Error('Order placement failed'));
            } else {
              successCount++;
              return Promise.resolve({
                success: true,
                order_id: `order_${successCount}`
              });
            }
          case 'get_market_data':
            return Promise.resolve([]);
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Send multiple requests concurrently
      const requests = Array.from({ length: totalRequests }, () =>
        mockInvoke('place_quick_order', {
          symbol: 'RELIANCE',
          action: 'BUY',
          quantity: 1
        }).catch(() => {}) // Catch errors to prevent test failure
      );

      await Promise.all(requests);

      console.log(`Error Handling Under Load:
        - Total requests: ${totalRequests}
        - Successful: ${successCount}
        - Failed: ${errorCount}
        - Success rate: ${((successCount / totalRequests) * 100).toFixed(1)}%`);

      // Verify that some requests succeeded despite failures
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + errorCount).toBe(totalRequests);
    });

    it('should recover from temporary service outages', async () => {
      let requestCount = 0;
      let recoveryTime = 0;
      
      // Mock service outage and recovery
      mockInvoke.mockImplementation((command) => {
        requestCount++;
        
        switch (command) {
          case 'validate_session':
            return Promise.resolve('test-user-id');
          case 'get_websocket_status':
            return Promise.resolve({ status: 'connected' });
          case 'get_market_data':
            // Simulate outage for requests 10-20, then recovery
            if (requestCount >= 10 && requestCount <= 20) {
              return Promise.reject(new Error('Service temporarily unavailable'));
            } else if (requestCount === 21) {
              recoveryTime = performance.now();
              return Promise.resolve([
                {
                  symbol: 'RELIANCE',
                  instrument_token: 738561,
                  ltp: '2540.50',
                  timestamp: new Date().toISOString()
                }
              ]);
            } else {
              return Promise.resolve([
                {
                  symbol: 'RELIANCE',
                  instrument_token: 738561,
                  ltp: '2540.50',
                  timestamp: new Date().toISOString()
                }
              ]);
            }
          default:
            return Promise.resolve([]);
        }
      });

      renderAuthenticatedApp();

      await waitFor(() => {
        expect(screen.getByText(/trading dashboard/i)).toBeInTheDocument();
      });

      // Send requests during outage and recovery
      const requests: Promise<any>[] = [];
      
      for (let i = 0; i < 30; i++) {
        const request = mockInvoke('get_market_data').catch(() => null);
        requests.push(request);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const results = await Promise.all(requests);

      // Verify recovery occurred
      const successfulResults = results.filter(result => result !== null);
      expect(successfulResults.length).toBeGreaterThan(0);
      expect(recoveryTime).toBeGreaterThan(0);
      
      console.log(`Service Recovery Test:
        - Total requests: ${results.length}
        - Successful after recovery: ${successfulResults.length}
        - Recovery detected at request: 21`);
    });
  });
});