import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  status: 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
  strategyId?: string;
  strategyName?: string;
  pnl?: number;
  pnlPercent?: number;
}

interface Order {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  quantity: number;
  price?: number;
  triggerPrice?: number;
  timestamp: string;
  status: 'OPEN' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  strategyId?: string;
  strategyName?: string;
}

const TradesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'trades'>('orders');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, these would be actual Tauri commands
        if (activeTab === 'orders') {
          const ordersResponse = await invoke<Order[]>('get_orders', { period: dateFilter });
          setOrders(ordersResponse);
        } else {
          const tradesResponse = await invoke<Trade[]>('get_trades', { period: dateFilter });
          setTrades(tradesResponse);
        }
        
        setError(null);
      } catch (err) {
        console.error(`Failed to fetch ${activeTab}:`, err);
        setError(`Failed to load ${activeTab}. Please try again.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab, dateFilter]);

  // Mock data for development
  const mockOrders: Order[] = [
    {
      id: 'ORD123456',
      symbol: 'RELIANCE',
      type: 'BUY',
      orderType: 'MARKET',
      quantity: 10,
      timestamp: '2025-07-03T09:30:15',
      status: 'COMPLETE',
      strategyId: '1',
      strategyName: 'NIFTY Momentum'
    },
    {
      id: 'ORD123457',
      symbol: 'TCS',
      type: 'SELL',
      orderType: 'LIMIT',
      quantity: 5,
      price: 3820.25,
      timestamp: '2025-07-03T10:15:22',
      status: 'OPEN',
      strategyId: '1',
      strategyName: 'NIFTY Momentum'
    },
    {
      id: 'ORD123458',
      symbol: 'HDFC',
      type: 'BUY',
      orderType: 'SL',
      quantity: 8,
      price: 2245.75,
      triggerPrice: 2240.00,
      timestamp: '2025-07-03T11:05:45',
      status: 'OPEN'
    },
    {
      id: 'ORD123459',
      symbol: 'INFY',
      type: 'SELL',
      orderType: 'MARKET',
      quantity: 12,
      timestamp: '2025-07-03T12:30:10',
      status: 'COMPLETE',
      strategyId: '2',
      strategyName: 'Mean Reversion'
    },
    {
      id: 'ORD123460',
      symbol: 'BHARTIARTL',
      type: 'BUY',
      orderType: 'SL-M',
      quantity: 15,
      triggerPrice: 850.50,
      timestamp: '2025-07-03T13:45:30',
      status: 'CANCELLED'
    }
  ];

  const mockTrades: Trade[] = [
    {
      id: 'TRD987654',
      symbol: 'RELIANCE',
      type: 'BUY',
      quantity: 10,
      price: 2540.50,
      timestamp: '2025-07-03T09:30:18',
      status: 'EXECUTED',
      strategyId: '1',
      strategyName: 'NIFTY Momentum',
      pnl: 325.00,
      pnlPercent: 1.28
    },
    {
      id: 'TRD987655',
      symbol: 'INFY',
      type: 'SELL',
      quantity: 12,
      price: 1615.25,
      timestamp: '2025-07-03T12:30:15',
      status: 'EXECUTED',
      strategyId: '2',
      strategyName: 'Mean Reversion',
      pnl: -175.00,
      pnlPercent: -0.90
    },
    {
      id: 'TRD987656',
      symbol: 'TCS',
      type: 'SELL',
      quantity: 5,
      price: 3805.50,
      timestamp: '2025-07-02T11:30:22',
      status: 'EXECUTED',
      strategyId: '1',
      strategyName: 'NIFTY Momentum',
      pnl: 295.00,
      pnlPercent: 1.55
    },
    {
      id: 'TRD987657',
      symbol: 'HDFC',
      type: 'BUY',
      quantity: 8,
      price: 2245.75,
      timestamp: '2025-07-02T09:30:45',
      status: 'EXECUTED',
      pnl: 595.00,
      pnlPercent: 3.30
    },
    {
      id: 'TRD987658',
      symbol: 'RELIANCE',
      type: 'SELL',
      quantity: 10,
      price: 2560.50,
      timestamp: '2025-07-03T14:15:10',
      status: 'EXECUTED',
      strategyId: '1',
      strategyName: 'NIFTY Momentum',
      pnl: 200.00,
      pnlPercent: 0.78
    }
  ];

  // Use mock data if no data is returned from backend
  useEffect(() => {
    if (!isLoading && activeTab === 'orders' && orders.length === 0) {
      setOrders(mockOrders);
    }
    if (!isLoading && activeTab === 'trades' && trades.length === 0) {
      setTrades(mockTrades);
    }
  }, [isLoading, activeTab, orders, trades]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      await invoke('cancel_order', { orderId });
      
      // Update local state
      setOrders(orders.map(order => 
        order.id === orderId 
          ? { ...order, status: 'CANCELLED' }
          : order
      ));
    } catch (err) {
      console.error(`Failed to cancel order:`, err);
      setError('Failed to cancel order. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4">Loading {activeTab}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Orders & Trades</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={dateFilter === 'today' ? 'default' : 'outline'}
            onClick={() => setDateFilter('today')}
          >
            Today
          </Button>
          <Button
            variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
            onClick={() => setDateFilter('yesterday')}
          >
            Yesterday
          </Button>
          <Button
            variant={dateFilter === 'week' ? 'default' : 'outline'}
            onClick={() => setDateFilter('week')}
          >
            Week
          </Button>
          <Button
            variant={dateFilter === 'month' ? 'default' : 'outline'}
            onClick={() => setDateFilter('month')}
          >
            Month
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'orders' ? 'default' : 'outline'}
          onClick={() => setActiveTab('orders')}
          className="min-w-[100px]"
        >
          Orders
        </Button>
        <Button
          variant={activeTab === 'trades' ? 'default' : 'outline'}
          onClick={() => setActiveTab('trades')}
          className="min-w-[100px]"
        >
          Trades
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{activeTab === 'orders' ? 'Orders' : 'Trades'}</CardTitle>
          <CardDescription>
            {activeTab === 'orders' 
              ? 'View and manage your open and historical orders' 
              : 'Track all executed trades and their performance'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === 'orders' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Order ID</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Trigger</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Strategy</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <tr key={order.id} className="border-b">
                        <td className="py-2 font-medium">{order.id}</td>
                        <td className="py-2">{new Date(order.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2">{order.symbol}</td>
                        <td className={`py-2 ${order.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                          {order.type} ({order.orderType})
                        </td>
                        <td className="text-right py-2">{order.quantity}</td>
                        <td className="text-right py-2">{order.price ? `₹${order.price.toFixed(2)}` : '-'}</td>
                        <td className="text-right py-2">{order.triggerPrice ? `₹${order.triggerPrice.toFixed(2)}` : '-'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.status === 'COMPLETE' ? 'bg-green-100 text-green-800' : 
                            order.status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2">{order.strategyName || 'Manual'}</td>
                        <td className="text-right py-2">
                          {order.status === 'OPEN' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                              onClick={() => handleCancelOrder(order.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-4 text-muted-foreground">
                        No orders found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Trade ID</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Type</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">P&L</th>
                    <th className="text-right py-2">P&L %</th>
                    <th className="text-left py-2">Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.length > 0 ? (
                    trades.map((trade) => (
                      <tr key={trade.id} className="border-b">
                        <td className="py-2 font-medium">{trade.id}</td>
                        <td className="py-2">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2">{trade.symbol}</td>
                        <td className={`py-2 ${trade.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.type}
                        </td>
                        <td className="text-right py-2">{trade.quantity}</td>
                        <td className="text-right py-2">₹{trade.price.toFixed(2)}</td>
                        <td className={`text-right py-2 ${trade.pnl && trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(2)}` : '-'}
                        </td>
                        <td className={`text-right py-2 ${trade.pnlPercent && trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.pnlPercent ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-2">{trade.strategyName || 'Manual'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-muted-foreground">
                        No trades found for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TradesPage;
