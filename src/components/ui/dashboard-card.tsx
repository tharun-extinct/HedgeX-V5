import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { cn } from '../../lib/utils';

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  value?: string | number;
  change?: number;
  description?: string;
  className?: string;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  icon,
  value,
  change,
  description,
  className,
  children,
}: DashboardCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="w-4 h-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {value && (
          <div className="text-2xl font-bold">
            {value}
            {change !== undefined && (
              <span
                className={cn(
                  "ml-2 text-xs font-medium",
                  change > 0 ? "text-success" : "text-destructive"
                )}
              >
                {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
