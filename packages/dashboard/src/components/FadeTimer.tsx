"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FADE_DURATION_MS = 3000;

interface FadeTimerProps {
  restartKey: string;
  onFadeComplete?: () => void;
  className?: string;
}

export const FadeTimer: React.FC<FadeTimerProps> = ({ restartKey, onFadeComplete, className }) => {
  const [progress, setProgress] = useState(100);
  const onCompleteRef = useRef(onFadeComplete);

  useEffect(() => {
    onCompleteRef.current = onFadeComplete;
  }, [onFadeComplete]);

  useEffect(() => {
    setProgress(100);
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (100 * 50) / FADE_DURATION_MS;
        if (next <= 0) {
          clearInterval(interval);
          onCompleteRef.current?.();
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [restartKey]);

  const secondsLeft = ((progress / 100) * (FADE_DURATION_MS / 1000)).toFixed(1);

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between text-sm font-semibold">
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-primary animate-pulse" />
          <span>MEMORIZE</span>
        </div>
        <span className="text-lg tabular-nums font-bold text-primary">{secondsLeft}s</span>
      </div>
      <Progress value={progress} className="h-2 [&>div]:bg-primary" />
    </div>
  );
};
