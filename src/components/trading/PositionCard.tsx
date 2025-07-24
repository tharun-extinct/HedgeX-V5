import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TrendingUp, TrendingDown, Target, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Position {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  trade_type: 'Buy' | 'Sell';
  entry_time: string;
  last_updated: string;
}

interface PositionCardProps {
  position: Position;
  onClose?: (symbol: string) => void;
  onModify?: (symbol: string) => void;
  className?: string;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onClose,
  onModify,
  className
}) => {
  const isProfit = position.pnl >= 0;
  const isLong = position.trade_type === 'Buy';
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-md",
      isProfit ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-lg font-semibold">{position.symbol}</CardTitle>
            <Badge variant={isLong ? "default" : "secondary"} className="text-xs">
              {isLong ? 'LONG' : 'SHORT'}
            </Badge>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onClose(position.symbol)}
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {position.exchange} • {Math.abs(position.quantity)} shares
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Price Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Entry Price</div>
            <div className="font-medium">{formatCurrency(position.average_price)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current Price</div>
            <div className="font-medium">{formatCurrency(position.current_price)}</div>
          </div>
        </div>

        {/* P&L Information */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center space-x-2">
            {isProfit ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
            <span className="text-sm font-medium">P&L</span>
          </div>
          <div className="text-right">
            <div className={cn(
              "font-semibold",
              isProfit ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(position.pnl)}
            </div>
            <div className={cn(
              "text-xs",
              isProfit ? "text-green-600" : "text-red-600"
            )}>
              {formatPercentage(position.pnl_percentage)}
            </div>
          </div>
        </div>

        {/* Entry Time */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Entry: {formatTime(position.entry_time)}</span>
          <span>Updated: {formatTime(position.last_updated)}</span>
        </div>

        {/* Action Buttons */}
        {(onModify || onClose) && (
          <div className="flex space-x-2 pt-2">
            {onModify && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onModify(position.symbol)}
                className="flex-1"
              >
                Modify
              </Button>
            )}
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onClose(position.symbol)}
                className="flex-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
              >
                Close Position
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PositionCard;