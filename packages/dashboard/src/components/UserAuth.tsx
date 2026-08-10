"use client"

import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isValidEmail } from '@/lib/utils';

export const UserAuth: React.FC = () => {
  const { login, register } = useUser();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      toast({ variant: "destructive", title: "Invalid Email", description: "Please enter a valid email address." });
      return;
    }

    if (password.length < 8) {
      toast({ variant: "destructive", title: "Weak Password", description: "Password must be at least 8 characters." });
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await register(trimmedEmail, password, nickname.trim() || undefined);
        toast({ title: "Welcome to LetterForge!", description: `Your forge has been crafted, ${nickname.trim() || trimmedEmail}!` });
      } else {
        await login(trimmedEmail, password);
        toast({ title: "Welcome back!", description: `Ready to forge some words!` });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: mode === 'login' ? "Login Failed" : "Registration Failed",
        description: error?.message || "Something went wrong. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center justify-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          {mode === 'login' ? 'Welcome Back' : 'Join the Forge'}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === 'login'
            ? 'Sign in with your email and password to continue forging words.'
            : 'Create an account to track your scores and compete on the leaderboard.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {mode === 'register' && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nickname (optional)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="bg-background/50 pl-9"
                  disabled={isSubmitting}
                  maxLength={30}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 pl-9"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 pl-9 pr-10"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
            disabled={isSubmitting || !email.trim() || !password}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
            disabled={isSubmitting}
          >
            {mode === 'login' ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
};
