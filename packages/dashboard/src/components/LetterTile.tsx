"use client"

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LetterTileProps {
  letter: string;
  isFlipped?: boolean;
  onClick?: () => void;
  className?: string;
}

export const LetterTile: React.FC<LetterTileProps> = ({ letter, isFlipped = false, onClick, className }) => {
  const [internalFlip, setInternalFlip] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setInternalFlip(true);
    const timer = setTimeout(() => setInternalFlip(false), 600);
    return () => clearTimeout(timer);
  }, [letter]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-16 h-16 sm:w-20 sm:h-20 text-3xl sm:text-4xl font-black uppercase rounded-2xl transition-all duration-500 transform",
        "bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/30",
        "hover:scale-110 hover:-translate-y-1 active:scale-95",
        "flex items-center justify-center border-b-4 border-black/20",
        internalFlip && "scale-y-0 opacity-0",
        className
      )}
    >
      {letter}
      <div className="absolute inset-0 bg-white/10 rounded-2xl pointer-events-none"></div>
    </button>
  );
};
