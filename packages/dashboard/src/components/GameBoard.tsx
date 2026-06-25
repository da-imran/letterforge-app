"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Game } from '@/types';
import { api } from '@/lib/api';
import { useUser } from '@/context/UserContext';
import { LetterTile } from './LetterTile';
import { Timer } from './Timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Award,
  History,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GameBoardProps {
  initialGame: Game;
}

export const GameBoard: React.FC<GameBoardProps> = ({ initialGame }) => {
  const { user } = useUser();
  const [game, setGame] = useState<Game>(initialGame);
  const [word, setWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefillingBatch, setIsRefillingBatch] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ type: 'success' | 'duplicate' | 'error', points?: number, reason?: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Scoped localStorage keys for this game
  const getScopedKey = (key: string) => `letterforge_${game._id}_${key}`;
  const getBatchKey = () => getScopedKey('batch');
  const getBatchIndexKey = () => getScopedKey('batch_index');
  const getChainLetterKey = () => getScopedKey('chain_letter');

  // Batch letter tracking: store batch in localStorage for continuity across renders
  useEffect(() => {
    if (initialGame.letterBatch && !localStorage.getItem(getBatchKey())) {
      localStorage.setItem(getBatchKey(), JSON.stringify(initialGame.letterBatch));
    }
    if (initialGame.batchIndex !== undefined) {
      localStorage.setItem(getBatchIndexKey(), String(initialGame.batchIndex));
    }
  }, [initialGame, game._id]);

  const getLocalBatchIndex = () => {
    const stored = localStorage.getItem(getBatchIndexKey());
    return stored ? parseInt(stored, 10) : (game.batchIndex ?? 0);
  };

  const clearLocalBatch = () => {
    localStorage.removeItem(getBatchKey());
    localStorage.removeItem(getBatchIndexKey());
    localStorage.removeItem(getChainLetterKey());
  };

  // Get and clear chain letter from localStorage
  const getChainLetter = () => localStorage.getItem(getChainLetterKey()) || null;

  const clearChainLetter = () => localStorage.removeItem(getChainLetterKey());

  // Get the letters to display - in chain mode, prepend the chain letter
  const getDisplayLetters = () => {
    if (game.mode === 'chain_mode') {
      const chainLetter = getChainLetter();
      if (chainLetter) {
        return [chainLetter, ...game.letters];
      }
    }
    return game.letters;
  };

  // Refill the batch when nearing exhaustion (index reaches 8)
  const handleRefillIfNeeded = async () => {
    if (game.mode !== 'normal_mode' && game.mode !== 'time_attack') return;

    const batchIndex = getLocalBatchIndex();
    if (batchIndex < 8) return; // Only refill when near end (index 8 = 9th set out of 10)

    setIsRefillingBatch(true);
    try {
      const result = await api.refillBatch(game._id);
      if (result && result.letterBatch.length > 0) {
        localStorage.setItem(getBatchKey(), JSON.stringify(result.letterBatch));
        localStorage.setItem(getBatchIndexKey(), String(result.batchIndex));
      }
    } catch (error) {
      console.error('Error refilling batch:', error);
    } finally {
      setIsRefillingBatch(false);
    }
  };

  // Helper function to check milestones after game completion
  const checkUserMilestones = async () => {
    if (!user?._id) return;

    try {
      // Get user stats from leaderboard to check milestones
      const stats = await getUserStats();

      // Call backend to check and unlock milestones
      await api.checkMilestones(user._id, stats);
    } catch (error) {
      console.error('Error checking milestones:', error);
    }
  };

  // Get user stats from API
  const getUserStats = async () => {
    if (!user) {
      return {
        normalGames: 0,
        timedGames: 0,
        totalGames: 0,
        normalPoints: 0,
        timedPoints: 0,
        totalPoints: 0,
        totalWords: 0,
        avgPointsPerWord: 0,
        maxWordStreak: 0,
      };
    }

    try {
      const allData = await api.getAllLeaderboard();

      if (allData && allData.normal_mode && allData.time_attack) {
        const normalAllTime = allData.normal_mode.all_time || [];
        const timeAttackAllTime = allData.time_attack.all_time || [];

        const currentUserNormal = normalAllTime.find((entry: any) => entry.userId === user._id);
        const currentUserTimed = timeAttackAllTime.find((entry: any) => entry.userId === user._id);

        const normalGames = currentUserNormal?.gameCount || 0;
        const timedGames = currentUserTimed?.gameCount || 0;
        const normalPoints = currentUserNormal?.totalScore || 0;
        const timedPoints = currentUserTimed?.totalScore || 0;

        return {
          normalGames,
          timedGames,
          totalGames: normalGames + timedGames,
          normalPoints,
          timedPoints,
          totalPoints: normalPoints + timedPoints,
          totalWords: (normalGames + timedGames) * 5, // Estimated
          avgPointsPerWord: (normalGames + timedGames) > 0 ? (normalPoints + timedPoints) / ((normalGames + timedGames) * 5) : 0,
          maxWordStreak: game.submissions.length, // Use current game words
        };
      }
    } catch (err) {
      console.error('Error getting user stats:', err);
    }

    // Return default stats if API fails
    return {
      normalGames: 0,
      timedGames: 0,
      totalGames: 0,
      normalPoints: 0,
      timedPoints: 0,
      totalPoints: 0,
      totalWords: game.submissions.length, // Use current game words
      avgPointsPerWord: 0,
      maxWordStreak: game.submissions.length,
    };
  };

  const handleLetterClick = (letter: string) => {
    setWord(prev => prev + letter);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!word.trim() || isSubmitting || game.isCompleted) return;

    setIsSubmitting(true);
    try {
      // In chain mode, word must contain the chain letter (can be anywhere in the word)
      if (game.mode === 'chain_mode') {
        const chainLetter = getChainLetter();
        if (chainLetter && !word.trim().toLowerCase().includes(chainLetter)) {
          setLastFeedback({ type: 'error', reason: `Word must contain "${chainLetter.toUpperCase()}"` });
          setIsSubmitting(false);
          setTimeout(() => setLastFeedback(null), 2000);
          return;
        }
      }

      const response = await api.submitWord(game._id, word.trim().toLowerCase());

      if (response.valid) {
        if (response.duplicate) {
          setLastFeedback({ type: 'duplicate', points: response.points });
        } else {
          setLastFeedback({ type: 'success', points: response.points });
        }

        // Check if game is now completed (auto-complete when round reaches max)
        const maxRounds = response.maxRounds ?? null;
        const currentRound = response.round ?? 0;
        const isGameCompleted = response.isCompleted === true || (maxRounds !== null && currentRound >= maxRounds);

        // Update game with new letters and add submission to list
        setGame(prev => {
          const newRound = response.round ?? (prev.round ?? 0) + 1;
          const newMaxRounds: number | null = response.maxRounds ?? prev.maxRounds ?? null;
          const newBatchIndex = getLocalBatchIndex() + 1;
          localStorage.setItem(getBatchIndexKey(), String(newBatchIndex));

          // In chain mode, store last letter of the word to seed the next round's letters
          if (prev.mode === 'chain_mode') {
            const lastLetter = word.trim().toLowerCase().slice(-1);
            localStorage.setItem(getChainLetterKey(), lastLetter);
          }

          const updatedGame: Game = {
            _id: prev._id,
            trace_id: prev.trace_id,
            mode: prev.mode,
            letterCount: prev.letterCount,
            letters: response.letters || prev.letters,
            letterBatch: prev.letterBatch,
            batchIndex: newBatchIndex,
            userId: prev.userId,
            createdAt: prev.createdAt,
            expiresAt: prev.expiresAt,
            score: response.totalScore,
            isCompleted: isGameCompleted,
            usedWords: [...prev.usedWords, word.trim().toLowerCase()],
            submissions: [...prev.submissions, { word: word.trim().toLowerCase(), points: response.points }],
            round: newRound,
            maxRounds: newMaxRounds
          };
          return updatedGame;
        });

        // Check if batch needs refill (skip if game is already completed)
        if (!isGameCompleted) {
          handleRefillIfNeeded();
        }

        // If game is now completed (auto-complete at max rounds)
        if (isGameCompleted) {
          setShowConfetti(true);
          // Mark game as completed first, then submit to leaderboard
          await api.completeGame(game._id);
          await api.submitToLeaderboard(game._id, 'daily');
          // Check for any new milestones
          checkUserMilestones();
          // Clear localStorage batch data on completion
          clearLocalBatch();
          toast({ title: "Game Over!", description: `Final Score: ${response.totalScore}` });
        }

        setWord('');
      } else {
        setLastFeedback({ type: 'error', reason: response.reason });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setLastFeedback(null), 2000);
    }
  };

  const handleReset = async () => {
    if (isResetting || game.isCompleted) return;
    setIsResetting(true);
    try {
      await api.resetLetters(game._id);
      const updatedGame = await api.loadGame(game._id);
      if (updatedGame) {
        setGame(updatedGame);
        // Reinitialize batch state from reloaded game
        if (updatedGame.letterBatch) {
          localStorage.setItem(getBatchKey(), JSON.stringify(updatedGame.letterBatch));
        }
        localStorage.setItem(getBatchIndexKey(), String(updatedGame.batchIndex ?? 0));
        // Note: do NOT clear chain letter here - it must persist across resets in chain mode
      }
      setWord('');
      toast({ title: "Letters Forged!", description: "New letters available." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  const handleComplete = async () => {
    if (game.isCompleted) return;

    // Check if any words were submitted
    const hasSubmissions = game.submissions.length > 0;

    if (!hasSubmissions) {
      // If no words submitted, delete the game instead of completing it
      try {
        await api.deleteGame(game._id);
        clearLocalBatch();
        // Redirect to home page with a toast
        window.location.href = '/';
        return;
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
        return;
      }
    }

    try {
      // First mark game as completed
      await api.completeGame(game._id);
      const updatedGame = await api.loadGame(game._id);
      if (updatedGame) {
        setGame(updatedGame);
        setShowConfetti(true);

        // Submit to daily leaderboard
        await api.submitToLeaderboard(game._id, 'daily');

        // Check for any new milestones
        checkUserMilestones();

        // Clear localStorage batch data on completion
        clearLocalBatch();

        toast({ title: "Game Over!", description: `Final Score: ${updatedGame.score}` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Completion Error", description: error.message });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto px-4 py-8">
      {/* Main Board */}
      <Card className="lg:col-span-2 bg-card/40 backdrop-blur-md border-border/50 shadow-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/20 py-4">
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-secondary uppercase">
              {game.mode.replace('_', ' ')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-4">
            {game.maxRounds && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Round</span>
                <span className="text-2xl font-black text-primary tabular-nums">{game.round}/{game.maxRounds}</span>
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Current Score</span>
              <span className="text-3xl font-black text-amber-500 tabular-nums">{game.score}</span>
            </div>
            <Award className="w-10 h-10 text-amber-500" />

            {/* Batch refill indicator */}
            {(game.mode === 'normal_mode' || game.mode === 'time_attack') && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">Batch</span>
                <span className="text-sm font-bold tabular-nums">{getLocalBatchIndex() + 1}/10</span>
                {isRefillingBatch && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </div>
            )}

            {/* Chain mode indicator */}
            {game.mode === 'chain_mode' && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-muted-foreground">Chain</span>
                <span className="text-sm font-bold text-green-500 tabular-nums uppercase">
                  {getChainLetter() || game.letters[0] || '?'}
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8 flex flex-col items-center gap-10">
          {game.mode === 'time_attack' && !game.isCompleted && (
            <Timer expiresAt={game.expiresAt} onExpire={handleComplete} className="max-w-md" />
          )}

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 py-6">
            {getDisplayLetters().map((letter, idx) => (
              <LetterTile
                key={`${letter}-${idx}-${game.round ?? 0}`}
                letter={letter}
                onClick={() => !game.isCompleted && handleLetterClick(letter)}
                className={game.isCompleted ? "opacity-50 grayscale pointer-events-none" : ""}
              />
            ))}
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 relative">
            <div className="relative group">
              <Input
                ref={inputRef}
                value={word}
                onChange={(e) => setWord(e.target.value.toLowerCase())}
                placeholder={game.isCompleted ? "GAME OVER" : "Forge a word..."}
                disabled={game.isCompleted || isSubmitting}
                className={`text-center text-2xl font-bold h-14 bg-background/50 border-2 transition-all duration-300 uppercase tracking-widest ${
                  lastFeedback?.type === 'error' ? 'border-destructive animate-shake' :
                  lastFeedback?.type === 'success' ? 'border-emerald-500' : 'border-border'
                }`}
              />
              {!game.isCompleted && (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!word.trim() || isSubmitting}
                  className="absolute right-2 top-2 h-10 w-10 bg-primary hover:bg-primary/80"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              )}
            </div>

            {/* Floating Point Indicator */}
            {lastFeedback && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 animate-float-up pointer-events-none">
                {lastFeedback.type === 'success' && (
                  <div className="flex items-center gap-1.5 text-emerald-500 font-black text-xl">
                    <CheckCircle2 className="w-5 h-5" />
                    +{lastFeedback.points}
                  </div>
                )}
                {lastFeedback.type === 'duplicate' && (
                  <div className="flex items-center gap-1.5 text-amber-500 font-black text-xl">
                    <TrendingUp className="w-5 h-5" />
                    +{lastFeedback.points} (DUPE)
                  </div>
                )}
                {lastFeedback.type === 'error' && (
                  <div className="flex items-center gap-1.5 text-destructive font-black text-xl">
                    <XCircle className="w-5 h-5" />
                    INVALID
                  </div>
                )}
              </div>
            )}
          </form>

          {game.isCompleted && (
            <div className="text-center space-y-4 py-4">
              <h2 className="text-3xl font-black text-primary">Forge Finished!</h2>
              <div className="flex justify-center gap-4">
                <Button asChild variant="secondary">
                  <a href="/leaderboard">View Leaderboard</a>
                </Button>
                <Button asChild>
                  <a href={`/play?mode=${game.mode}`}>Forge Again</a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/10 p-4 border-t border-border/20 flex justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <SparkleIcon className="w-4 h-4 text-primary" />
            Letters: {game.letters.join(', ').toUpperCase()}
          </div>
          {!game.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isResetting}
              className="gap-2 border-primary/20 hover:bg-primary/10 text-primary"
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              Reset Letters
            </Button>
          )}
          {!game.isCompleted && (
            <Button variant="ghost" size="sm" onClick={handleComplete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              End Game
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Sidebar: Stats & History */}
      <div className="space-y-6">
        <Card className="bg-card/40 backdrop-blur-md border-border/50">
          <CardHeader className="py-4 flex flex-row items-center gap-2 border-b border-border/20">
            <History className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Used Words</CardTitle>
            <Badge variant="secondary" className="ml-auto">{game.usedWords.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-2">
                {game.submissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10 italic">No words forged yet...</p>
                ) : (
                  [...game.submissions].reverse().map((sub, i) => (
                    <div key={`${sub.word}-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/10">
                      <span className="font-bold uppercase tracking-wider">{sub.word}</span>
                      <span className="font-bold text-amber-500">+{sub.points}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-border/50">
          <CardHeader className="py-4 flex flex-row items-center gap-2 border-b border-border/20">
            <Award className="w-5 h-5 text-secondary" />
            <CardTitle className="text-lg">Session Goals</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-bold uppercase">Game Efficiency</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avg Points / Word</span>
                <span className="text-xl font-black text-secondary">
                  {game.submissions.length > 0 ? (game.score / game.submissions.length).toFixed(1) : '0.0'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
