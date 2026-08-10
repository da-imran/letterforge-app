"use client"

import React from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Trophy,
  Gamepad2,
  User as UserIcon,
  LogOut,
  Book,
  HelpCircle,
  Menu,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Play', icon: <Gamepad2 className="w-4 h-4" /> },
  { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> },
  { href: '/support', label: 'Support', icon: <HelpCircle className="w-4 h-4" /> },
];

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useUser();

  const displayName = user?.nickname || user?.email || 'Player';

  const renderMobileItem = (item: NavItem, onClick?: () => void) => (
    <SheetClose key={item.href} asChild>
      <Link
        href={item.href}
        onClick={onClick}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      >
        {item.icon}
        {item.label}
      </Link>
    </SheetClose>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold tracking-tight">
          <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
            <Book className="w-6 h-6 text-white" />
          </div>
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            LetterForge
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Desktop navigation */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button variant="ghost" size="sm" className="gap-2">
                  {item.icon}
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Mobile navigation toggle */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open navigation menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[250px]">
                <div className="flex h-full flex-col gap-1 pt-14">
                  {navItems.map((item) => renderMobileItem(item))}
                  {isAuthenticated ? (
                    <>
                      <SheetClose asChild>
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <UserIcon className="w-4 h-4" />
                          Profile
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <button
                          type="button"
                          onClick={logout}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </SheetClose>
                </>
                  ) : (
                    <SheetClose asChild>
                      <Link
                        href="/"
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        <UserIcon className="w-4 h-4" />
                        Sign In / Register
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop user menu */}
          {isAuthenticated && (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <UserIcon className="w-4 h-4" />
                    <span className="max-w-[100px] truncate">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 w-full">
                      <UserIcon className="w-4 h-4" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
