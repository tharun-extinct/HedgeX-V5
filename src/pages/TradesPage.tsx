import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar, Filter, Download, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setOrders(mockOrders);
        setTrades(mockTrades);
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

  const handleCancelOrder = async (orderId: string) => {
    try {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETE':
      case 'EXECUTED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'OPEN':
      case 'PENDING':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-gray-600" />;
      case 'REJECTED':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
      case 'EXECUTED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'OPEN':
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading {activeTab}...</p>
        </div>
      </div>
    );
  }

  const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const winningTrades = trades.filter(trade => (trade.pnl || 0) > 0).length;
  const totalTrades = trades.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Orders & Trades
            </h1>
            <p className="text-slate-600 mt-2">Monitor your trading activity and order status</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </Button>
            <Button variant="outline" className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">{orders.length}</div>
              <div className="text-sm text-blue-600 mt-1">
                {orders.filter(o => o.status === 'OPEN').length} open
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-700">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">{totalTrades}</div>
              <div className="text-sm text-purple-600 mt-1">
                {winningTrades} winning
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${totalPnL >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-red-50 to-red-100 border-red-200'} shadow-lg`}>
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-medium ${totalPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>Total P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${totalPnL >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
              </div>
              <div className={`text-sm mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                From executed trades
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-orange-700">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-900">
                {totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-orange-600 mt-1">
                Success ratio
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'orders' ? 'default' : 'outline'}
              onClick={() => setActiveTab('orders')}
              className={`flex items-center space-x-2 ${activeTab === 'orders' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
            >
              <Clock className="w-4 h-4" />
              <span>Orders</span>
            </Button>
            <Button
              variant={activeTab === 'trades' ? 'default' : 'outline'}
              onClick={() => setActiveTab('trades')}
              className={`flex items-center space-x-2 ${activeTab === 'trades' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Trades</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {(['today', 'yesterday', 'week', 'month'] as const).map((period) => (
              <Button
                key={period}
                variant={dateFilter === period ? 'default' : 'outline'}
                onClick={() => setDateFilter(period)}
                size="sm"
                className={`capitalize ${dateFilter === period ? 'bg-slate-900 text-white' : ''}`}
              >
                <Calendar className="w-3 h-3 mr-1" />
                {period}
              </Button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {activeTab === 'orders' ? 'Orders' : 'Trades'}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {activeTab === 'orders' 
                    ? 'View and manage your open and historical orders' 
                    : 'Track all executed trades and their performance'
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activeTab === 'orders' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Order ID</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Time</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Symbol</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Type</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Qty</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Price</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Trigger</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Status</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Strategy</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length > 0 ? (
                      orders.map((order, index) => (
                        <tr key={order.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''}`}>
                          <td className="py-4 px-4 font-mono text-sm text-slate-700">{order.id}</td>
                          <td className="py-4 px-4 text-slate-700">{new Date(order.timestamp).toLocaleTimeString()}</td>
                          <td className="py-4 px-4 font-bold text-slate-900">{order.symbol}</td>
                          <td className={`py-4 px-4 font-medium ${order.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {order.type} ({order.orderType})
                          </td>
                          <td className="text-right py-4 px-4 text-slate-700">{order.quantity}</td>
                          <td className="text-right py-4 px-4 text-slate-700">{order.price ? `₹${order.price.toFixed(2)}` : '-'}</td>
                          <td className="text-right py-4 px-4 text-slate-700">{order.triggerPrice ? `₹${order.triggerPrice.toFixed(2)}` : '-'}</td>
                          <td className="py-4 px-4">
                            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                              {getStatusIcon(order.status)}
                              <span>{order.status}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-700">{order.strategyName || 'Manual'}</td>
                          <td className="text-right py-4 px-4">
                            {order.status === 'OPEN' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-600 border-red-300 hover:bg-red-50"
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
                        <td colSpan={10} className="text-center py-8 text-slate-500">
                          <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                          <p>No orders found for the selected period</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Trade ID</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Time</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Symbol</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Type</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Qty</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">Price</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">P&L</th>
                      <th className="text-right py-4 px-4 font-semibold text-slate-700">P&L %</th>
                      <th className="text-left py-4 px-4 font-semibold text-slate-700">Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length > 0 ? (
                      trades.map((trade, index) => (
                        <tr key={trade.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-gradient-to-r from-green-50 to-transparent' : ''}`}>
                          <td className="py-4 px-4 font-mono text-sm text-slate-700">{trade.id}</td>
                          <td className="py-4 px-4 text-slate-700">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                          <td className="py-4 px-4 font-bold text-slate-900">{trade.symbol}</td>
                          <td className={`py-4 px-4 font-medium flex items-center space-x-1 ${trade.type === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>{trade.type}</span>
                          </td>
                          <td className="text-right py-4 px-4 text-slate-700">{trade.quantity}</td>
                          <td className="text-right py-4 px-4 text-slate-700">₹{trade.price.toFixed(2)}</td>
                          <td className={`text-right py-4 px-4 font-bold ${trade.pnl && trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.pnl ? `${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(2)}` : '-'}
                          </td>
                          <td className={`text-right py-4 px-4 font-bold ${trade.pnlPercent && trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trade.pnlPercent ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-4 px-4 text-slate-700">{trade.strategyName || 'Manual'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-slate-500">
                          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                          <p>No trades found for the selected period</p>
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
    </div>
  );
};

export default TradesPage;