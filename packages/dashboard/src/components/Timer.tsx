"use client"

import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerProps {
  expiresAt: number | null;
  onExpire: () => void;
  className?: string;
}

const toEpochMs = (value: number | null): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
};

export const Timer: React.FC<TimerProps> = ({ expiresAt, onExpire, className }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const deadline = toEpochMs(expiresAt);
  const totalTime = 60000; // 60 seconds

  useEffect(() => {
    if (!deadline) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (!deadline) return null;

  const percentage = (timeLeft / totalTime) * 100;
  const isRunningOut = timeLeft < 5000;

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between text-sm font-semibold">
        <div className="flex items-center gap-1.5">
          <Clock className={cn("w-4 h-4", isRunningOut ? "text-destructive animate-pulse" : "text-primary")} />
          <span className={isRunningOut ? "text-destructive" : ""}>TIME REMAINING</span>
        </div>
        <span className={cn("text-lg tabular-nums font-bold", isRunningOut ? "text-destructive scale-110" : "")}>
          {(timeLeft / 1000).toFixed(1)}s
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn("h-2", isRunningOut ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")}
      />
    </div>
  );
};
