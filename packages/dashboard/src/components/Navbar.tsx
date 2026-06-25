"use client"

import React from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Gamepad2, 
  User as UserIcon, 
  LogOut,
  Book,
  HelpCircle
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useUser();

  // Display name: use nickname if available, otherwise show email
  const displayName = user?.nickname || user?.email || 'Player';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight">
          <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
            <Book className="w-6 h-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            LetterForge
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/leaderboard">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </Button>
          </Link>
          
          <Link href="/">
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2">
              <Gamepad2 className="w-4 h-4" />
              Play
            </Button>
          </Link>

          <Link href="/support">
            <Button variant="ghost" size="sm" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden md:inline">Support</span>
            </Button>
          </Link>

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[100px] truncate hidden xs:inline">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 w-full">
                    <UserIcon className="w-4 h-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/leaderboard" className="flex items-center gap-2 sm:hidden">
                    <Trophy className="w-4 h-4" /> Leaderboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};