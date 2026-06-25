"use client"

import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isValidEmail } from '@/lib/utils';

export const UserAuth: React.FC = () => {
  const { login } = useUser();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    // Validate email format
    if (!isValidEmail(trimmedEmail)) {
      toast({ variant: "destructive", title: "Invalid Email", description: "Please enter a valid email address." });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail);
      toast({ title: "Welcome to LetterForge!", description: `Ready to play!` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary" />
          Join the Forge
        </CardTitle>
        <CardDescription>
          Enter your email to start tracking your scores and compete on the leaderboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enter Game
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
