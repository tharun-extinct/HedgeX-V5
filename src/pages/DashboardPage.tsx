import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface MarketData {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

const DashboardPage: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real implementation, these would be actual Tauri commands
        const marketStatus = await invoke<boolean>('get_market_status');
        setIsMarketOpen(marketStatus);

        const marketDataResponse = await invoke<MarketData[]>('get_market_data', {
          symbols: ['NIFTY 50', 'RELIANCE', 'TCS', 'HDFC', 'INFY']
        });
        setMarketData(marketDataResponse);

        const positionsResponse = await invoke<Position[]>('get_positions');
        setPositions(positionsResponse);

        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load market data. Please check your connection.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up a refresh interval
    const intervalId = setInterval(fetchData, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  const handleQuickTrade = async (symbol: string, action: 'BUY' | 'SELL') => {
    try {
      await invoke('place_quick_order', {
        symbol,
        action,
        quantity: 1, // Default quantity
        orderType: 'MARKET'
      });
      
      // Refresh positions after order
      const positionsResponse = await invoke<Position[]>('get_positions');
      setPositions(positionsResponse);
    } catch (err) {
      console.error(`Failed to place ${action} order for ${symbol}:`, err);
      setError(`Failed to place ${action} order. Please try again.`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isMarketOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>{isMarketOpen ? 'Market Open' : 'Market Closed'}</span>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹1,25,000.00</div>
            <div className="text-sm text-muted-foreground mt-1">Available for trading</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Today's P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">₹2,340.50</div>
            <div className="text-sm text-muted-foreground mt-1">+1.87%</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{positions.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Active trades</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Market Watch</CardTitle>
            <CardDescription>NIFTY 50 top stocks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Change</th>
                    <th className="text-right py-2">Volume</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {marketData.length > 0 ? (
                    marketData.map((stock) => (
                      <tr key={stock.symbol} className="border-b">
                        <td className="py-2 font-medium">{stock.symbol}</td>
                        <td className="text-right py-2">₹{stock.lastPrice.toFixed(2)}</td>
                        <td className={`text-right py-2 ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                        </td>
                        <td className="text-right py-2">{(stock.volume / 1000).toFixed(1)}K</td>
                        <td className="text-right py-2">
                          <div className="flex justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 px-2 text-green-600 hover:text-green-700"
                              onClick={() => handleQuickTrade(stock.symbol, 'BUY')}
                              disabled={!isMarketOpen}
                            >
                              Buy
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                              onClick={() => handleQuickTrade(stock.symbol, 'SELL')}
                              disabled={!isMarketOpen}
                            >
                              Sell
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted-foreground">
                        No market data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>Currently active trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Avg. Price</th>
                    <th className="text-right py-2">Current</th>
                    <th className="text-right py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length > 0 ? (
                    positions.map((position) => (
                      <tr key={position.symbol} className="border-b">
                        <td className="py-2 font-medium">{position.symbol}</td>
                        <td className="text-right py-2">{position.quantity}</td>
                        <td className="text-right py-2">₹{position.entryPrice.toFixed(2)}</td>
                        <td className="text-right py-2">₹{position.currentPrice.toFixed(2)}</td>
                        <td className={`text-right py-2 ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{position.pnl.toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted-foreground">
                        No open positions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Strategies</CardTitle>
          <CardDescription>Automated trading strategies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">NIFTY Momentum</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Today's P&L:</span>
                  <span className="font-medium text-green-600">+₹1,250.00</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium">2</span>
                </div>
                <Button variant="outline" className="w-full">View Details</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Mean Reversion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-yellow-600">Standby</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Today's P&L:</span>
                  <span className="font-medium text-red-600">-₹320.00</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium">1</span>
                </div>
                <Button variant="outline" className="w-full">View Details</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Gap & Go</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium text-gray-600">Inactive</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Today's P&L:</span>
                  <span className="font-medium">₹0.00</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span className="text-muted-foreground">Positions:</span>
                  <span className="font-medium">0</span>
                </div>
                <Button variant="outline" className="w-full">Activate</Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
