"use client"

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Game, GameMode } from '@/types';
import { api } from '@/lib/api';
import { useUser } from '@/context/UserContext';
import { GameBoard } from '@/components/GameBoard';
import { DuelBoard } from '@/components/DuelBoard';
import { WawasanBoard } from '@/components/WawasanBoard';
import { Loader2, AlertCircle, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

function PlayPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: userLoading, refreshUser } = useUser();
  const [game, setGame] = useState<Game | null>(null);
  const [duelId, setDuelId] = useState<string | null>(null);
  // Wawasan 2020 duels share one paper sheet — no per-player game is dealt.
  const [wawasanDuelId, setWawasanDuelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSettingNickname, setIsSettingNickname] = useState(false);
  const { toast } = useToast();

  const mode = (searchParams.get('mode') as GameMode) || 'normal_mode';
  const duelIdParam = searchParams.get('duelId');

  useEffect(() => {
    if (userLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    // Check if user needs to set nickname
    if (!user?.nickname) {
      setShowNicknameDialog(true);
      setIsLoading(false);
      return;
    }

    const initGame = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (duelIdParam) {
          const duel = await api.getDuel(duelIdParam);
          // Both players only get their games once the host starts the duel.
          if (duel.status !== 'playing') {
            setError('This duel has not started yet. The host needs to pick a mode and start it.');
            return;
          }
          if (duel.mode === 'wawasan_mode') {
            setWawasanDuelId(duelIdParam);
            return;
          }
          const myGameId = duel.myGameId;
          if (!myGameId) {
            setError('No game is available for this duel yet.');
            return;
          }
          const duelGame = await api.loadGame(myGameId);
          setDuelId(duelIdParam);
          setGame(duelGame);
        } else {
          const newGame = await api.createGame({ mode });
          setGame(newGame);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initGame();
  }, [userLoading, isAuthenticated, mode, duelIdParam, user?._id, user?.nickname, router]);

  const handleSetNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname || trimmedNickname.length < 2) {
      toast({ variant: "destructive", title: "Invalid Nickname", description: "Nickname must be at least 2 characters." });
      return;
    }

    setIsSettingNickname(true);
    try {
      const updatedUser = await api.updateUser(user!._id, trimmedNickname);
      if (updatedUser) {
        await refreshUser();
        setShowNicknameDialog(false);
        toast({ title: "Nickname Set!", description: `Welcome to the forge, ${trimmedNickname}!` });

        // Initialize game after setting nickname
        if (duelIdParam) {
          const duel = await api.getDuel(duelIdParam);
          if (duel.status === 'playing' && duel.mode === 'wawasan_mode') {
            setWawasanDuelId(duelIdParam);
          } else if (duel.status === 'playing' && duel.myGameId) {
            const duelGame = await api.loadGame(duel.myGameId);
            setDuelId(duelIdParam);
            setGame(duelGame);
          }
        } else {
          const newGame = await api.createGame({ mode });
          setGame(newGame);
        }
        setIsLoading(false);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSettingNickname(false);
    }
  };

  const handleDialogClose = () => {
    // If user closed dialog without setting nickname, redirect to home
    if (!user?.nickname) {
      router.push('/');
    }
  };

  if (userLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase animate-pulse">Forging new game session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-lg mx-auto py-20 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {wawasanDuelId ? (
        <WawasanBoard duelId={wawasanDuelId} />
      ) : (
        game && (duelId ? <DuelBoard initialGame={game} duelId={duelId} /> : <GameBoard initialGame={game} />)
      )}

      {/* Nickname Dialog for first-time players */}
      <Dialog open={showNicknameDialog} onOpenChange={(open) => {
        if (!open) handleDialogClose();
        setShowNicknameDialog(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-primary" />
              Choose Your Forge Name
            </DialogTitle>
            <DialogDescription>
              Before you start playing, choose a nickname to display on the leaderboard!
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetNickname} className="space-y-4">
            <Input
              placeholder="Enter your nickname..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isSettingNickname}
              autoFocus
              maxLength={20}
            />
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
              disabled={isSettingNickname || nickname.trim().length < 2}
            >
              {isSettingNickname ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Start Playing
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayPageContent />
    </Suspense>
  );
}
