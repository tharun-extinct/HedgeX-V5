import React, { useState } from 'react';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { AlertTriangle, Square, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmergencyStopButtonProps {
  onEmergencyStop: () => Promise<void>;
  isTrading: boolean;
  isLoading?: boolean;
  className?: string;
}

export const EmergencyStopButton: React.FC<EmergencyStopButtonProps> = ({
  onEmergencyStop,
  isTrading,
  isLoading = false,
  className
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEmergencyStop = async () => {
    try {
      setIsExecuting(true);
      await onEmergencyStop();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Emergency stop failed:', error);
      // Error handling should be done by the parent component
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isTrading) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn("border-gray-300 text-gray-500", className)}
      >
        <Square className="w-4 h-4 mr-2" />
        Trading Stopped
      </Button>
    );
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isLoading || isExecuting}
          className={cn(
            "bg-red-600 hover:bg-red-700 border-red-600 text-white font-semibold",
            "animate-pulse shadow-lg",
            className
          )}
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <AlertTriangle className="w-4 h-4 mr-2" />
          )}
          EMERGENCY STOP
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Emergency Stop Confirmation
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p className="font-medium text-foreground">
              This will immediately halt all trading operations:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Cancel all pending orders</li>
              <li>Stop all active strategies</li>
              <li>Disable automatic trading</li>
              <li>Close WebSocket connections</li>
            </ul>
            <p className="text-sm font-medium text-red-600">
              ⚠️ This action cannot be undone. You will need to manually restart trading.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isExecuting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleEmergencyStop}
            disabled={isExecuting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                EMERGENCY STOP
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EmergencyStopButton;