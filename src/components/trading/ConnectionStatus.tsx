import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type ConnectionState = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'failed';

interface ConnectionStatusProps {
  status: ConnectionState;
  lastConnected?: string;
  onReconnect?: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
  isMarketOpen?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  lastConnected,
  onReconnect,
  onDisconnect,
  isMarketOpen = true,
  className
}) => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleReconnect = async () => {
    if (!onReconnect || isReconnecting) return;
    
    try {
      setIsReconnecting(true);
      await onReconnect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect || isDisconnecting) return;
    
    try {
      setIsDisconnecting(true);
      await onDisconnect();
    } catch (error) {
      console.error('Disconnection failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="w-4 h-4" />,
          label: 'Connected',
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          badgeVariant: 'default' as const,
          pulse: true
        };
      case 'connecting':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          label: 'Connecting',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          badgeVariant: 'secondary' as const,
          pulse: false
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          label: 'Reconnecting',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          badgeVariant: 'secondary' as const,
          pulse: false
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Connection Failed',
          color: 'text-red-600',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          badgeVariant: 'destructive' as const,
          pulse: false
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="w-4 h-4" />,
          label: 'Disconnected',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          badgeVariant: 'outline' as const,
          pulse: false
        };
    }
  };

  const config = getStatusConfig();

  const formatLastConnected = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className={cn("border", config.borderColor, config.bgColor, className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Status Icon with Pulse */}
            <div className="relative">
              <div className={cn("flex items-center justify-center", config.color)}>
                {config.icon}
              </div>
              {config.pulse && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
              )}
            </div>

            {/* Status Info */}
            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <span className={cn("font-medium text-sm", config.color)}>
                  {config.label}
                </span>
                <Badge variant={config.badgeVariant} className="text-xs">
                  WebSocket
                </Badge>
              </div>
              
              {/* Market Status */}
              <div className="flex items-center space-x-2 mt-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
                <span className="text-xs text-muted-foreground">
                  Market {isMarketOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              {/* Last Connected */}
              {lastConnected && status !== 'connected' && (
                <div className="flex items-center space-x-1 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Last: {formatLastConnected(lastConnected)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {status === 'connected' && onDisconnect && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-xs"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Disconnect'
                )}
              </Button>
            )}
            
            {(status === 'disconnected' || status === 'failed') && onReconnect && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="text-xs"
              >
                {isReconnecting ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reconnect
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Connection Details */}
        {status === 'failed' && (
          <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700 dark:text-red-400">
                <p className="font-medium">Connection failed</p>
                <p className="mt-1">
                  Unable to establish WebSocket connection to market data feed. 
                  Check your internet connection and API credentials.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'connected' && (
          <div className="mt-3 p-2 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                Real-time market data active
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionStatus;