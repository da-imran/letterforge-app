"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { subscribeToDuel, ConnectionState } from '@/lib/realtime';
import { Duel, DuelMode } from '@/types';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Swords, Loader2, Copy, Check, Play, Users, Trophy, Shuffle, Flag } from 'lucide-react';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const DUEL_MODES: { value: DuelMode; label: string; description: string }[] = [
  { value: 'normal_mode', label: 'Normal', description: 'Classic forging, 10 rounds' },
  { value: 'time_attack', label: 'Time Attack', description: 'Race a 60-second clock' },
  { value: 'survival_mode', label: 'Survival', description: 'Every miss costs a life' },
  { value: 'chain_mode', label: 'Chain', description: 'Chain letters into words' },
];

const MODE_LABELS: Record<string, string> = {
  normal_mode: 'Normal Mode',
  time_attack: 'Time Attack',
  survival_mode: 'Survival Mode',
  chain_mode: 'Chain Mode',
};

function participantLabel(duel: Duel, key: 'challenger' | 'opponent'): string {
  const p = duel[key];
  if (!p.userId) return 'Waiting for opponent...';
  return p.nickname || 'Anonymous';
}

export default function DuelsPage() {
  const { isAuthenticated, isLoading: userLoading, user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [code, setCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DuelMode>('normal_mode');
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState<ConnectionState>('closed');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Live opponent updates while playing a duel.
  useEffect(() => {
    if (!duel?._id) return;
    unsubscribeRef.current = subscribeToDuel(duel._id, (updated) => setDuel(updated), {
      onConnectionChange: setLive,
    });

    // Polling fallback: keeps state fresh even if the WS is unavailable.
    const poll = setInterval(() => {
      api.getDuel(duel._id).then(setDuel).catch(() => setLive('reconnecting'));
    }, 5000);

    return () => {
      clearInterval(poll);
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [duel?._id]);

  // When the host starts the game, BOTH players are dealt simultaneously —
  // take everyone to the game page in realtime so play begins together.
  useEffect(() => {
    if (duel?.status === 'playing' && duel.myGameId) {
      router.push(`/play?duelId=${duel._id}`);
    }
  }, [duel?.status, duel?.myGameId, duel?._id, router]);

  // Both players type the same code: the first to enter creates the duel,
  // the second joins it.
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4 || trimmed.length > 8) return;
    setIsConnecting(true);
    try {
      const result = await api.joinDuelByCode(trimmed);
      setDuel(result);
      setCode('');
      const amChallenger = result.challenger.userId === (user?._id ?? null) && !result.opponent.userId;
      toast({
        title: amChallenger ? 'Duel Created!' : 'Duel Connected!',
        description: amChallenger
          ? `Code ${result.code} is live. Your opponent just needs to enter the same code.`
          : `You and your opponent are connected. Good luck!`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Connection Failed", description: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  const generateCode = () => {
    const arr = new Uint32Array(6);
    crypto.getRandomValues(arr);
    let generated = '';
    for (let i = 0; i < 6; i++) {
      generated += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
    }
    setCode(generated);
  };

  const handleCopy = useCallback(async () => {
    if (!duel) return;
    try {
      await navigator.clipboard.writeText(duel.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; ignore.
    }
  }, [duel]);

  const startPlaying = () => {
    if (!duel?.myGameId) return;
    router.push(`/play?duelId=${duel._id}`);
  };

  const amChallenger = duel?.challenger.userId === (user?._id ?? null);

  const handleStart = async () => {
    if (!duel || isStarting) return;
    setIsStarting(true);
    try {
      const updated = await api.startDuel(duel._id, selectedMode);
      setDuel(updated);
      toast({ title: "Duel Started!", description: "Both players are in the game now. Good luck!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Start Failed", description: err.message });
    } finally {
      setIsStarting(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container max-w-lg mx-auto py-20 px-4 text-center space-y-4">
        <h1 className="text-3xl font-black font-headline">Duels</h1>
        <p className="text-muted-foreground">Sign in to challenge friends in 1v1 duels.</p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const myUserId = user?._id ?? null;
  const isParticipant = duel && (duel.challenger.userId === myUserId || duel.opponent.userId === myUserId);

  return (
    <div className="container max-w-3xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-purple-500 font-bold tracking-widest uppercase text-sm">
            <Swords className="w-4 h-4" />
            Multiplayer
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight">Duels</h1>
          <p className="text-muted-foreground text-lg">Agree on a code with your friend, enter the same code, and play together in real time.</p>
        </div>
      </div>

      {/* Connect with a shared code */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Connect with a Code
          </CardTitle>
          <CardDescription>
            Both players type the same 4-8 character code. The first to enter creates the duel, the second joins it — you&apos;re then connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FORGE"
              maxLength={8}
              minLength={4}
              className="uppercase tracking-widest text-center font-bold"
              disabled={isConnecting}
              autoFocus
            />
            <Button type="submit" variant="secondary" disabled={isConnecting || code.trim().length < 4}>
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
            </Button>
          </form>
          <Button variant="ghost" size="sm" onClick={generateCode} className="mt-2 gap-2 text-muted-foreground">
            <Shuffle className="w-4 h-4" />
            Generate a Code
          </Button>
        </CardContent>
      </Card>

      {duel && (
        <Card className="bg-card/40 backdrop-blur-md border-border/50 overflow-hidden">
          <CardHeader className="border-b border-border/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-3">
                  <Badge
                    variant={
                      duel.status === 'completed' ? 'secondary'
                        : (duel.status === 'active' || duel.status === 'playing') ? 'default'
                          : 'outline'
                    }
                    className="gap-2"
                  >
                    {(duel.status === 'active' || duel.status === 'playing') && (
                      <span
                        className={`h-2 w-2 rounded-full ${live === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
                      />
                    )}
                    {duel.status.toUpperCase()}
                    {(duel.status === 'active' || duel.status === 'playing') && live === 'reconnecting' && <> · RECONNECTING</>}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-lg">{duel.code}</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  {duel.letterCount} letters
                  {duel.mode ? ` · ${MODE_LABELS[duel.mode] ?? duel.mode}` : ' · mode not chosen yet'}
                  {duel.maxRounds ? ` · ${duel.maxRounds} rounds` : ''}
                </CardDescription>
              </div>
              {isParticipant && duel.status === 'playing' && duel.myGameId && (
                <Button onClick={startPlaying} className="gap-2">
                  <Play className="w-4 h-4" />
                  Play Now
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center space-y-1">
                <p className="text-sm font-bold">{participantLabel(duel, 'challenger')}</p>
                <p className="text-4xl font-black text-primary tabular-nums">
                  {duel.challenger.score ?? '–'}
                </p>
                {duel.challenger.submittedAt && <Badge variant="secondary">Submitted</Badge>}
                {duel.challenger.disconnectedAt && !duel.challenger.submittedAt && (
                  <Badge variant="destructive" className="ml-2">Disconnected — forfeits if AFK</Badge>
                )}
              </div>

              <div className="flex flex-col items-center gap-1 px-4">
                <Trophy className={`w-8 h-8 ${duel.status === 'completed' ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">vs</span>
              </div>

              <div className="flex-1 text-center space-y-1">
                <p className="text-sm font-bold">{participantLabel(duel, 'opponent')}</p>
                <p className="text-4xl font-black text-secondary tabular-nums">
                  {duel.opponent.score ?? '–'}
                </p>
                {duel.opponent.submittedAt && <Badge variant="secondary">Submitted</Badge>}
                {duel.opponent.disconnectedAt && !duel.opponent.submittedAt && (
                  <Badge variant="destructive" className="ml-2">Disconnected — forfeits if AFK</Badge>
                )}
              </div>
            </div>

            {duel.status === 'active' && isParticipant && (
              <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-4">
                {amChallenger ? (
                  <>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        You&apos;re the host — pick the mode
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Choosing a mode and starting deals both players the same
                        rack and begins the game together.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {DUEL_MODES.map((m) => (
                        <Button
                          key={m.value}
                          type="button"
                          size="sm"
                          variant={selectedMode === m.value ? 'default' : 'outline'}
                          onClick={() => setSelectedMode(m.value)}
                        >
                          {m.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      {DUEL_MODES.find((m) => m.value === selectedMode)?.description}
                    </p>
                    <Button onClick={handleStart} disabled={isStarting} className="w-full gap-2">
                      {isStarting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <Flag className="w-4 h-4" />
                      Select Mode
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Waiting for {duel.challenger.nickname || 'the host'} to pick a mode and start...
                  </div>
                )}
              </div>
            )}

            {duel.status === 'completed' && (
              <div className="text-center">
                {duel.result === 'draw' ? (
                  <p className="text-lg font-black text-amber-500">It&apos;s a draw!</p>
                ) : duel.result === 'challenger' ? (
                  <p className="text-lg font-black text-primary">{participantLabel(duel, 'challenger')} wins!</p>
                ) : (
                  <p className="text-lg font-black text-secondary">{participantLabel(duel, 'opponent')} wins!</p>
                )}
                {duel.result !== 'draw' && (() => {
                  const loserSlot = duel.result === 'challenger' ? 'opponent' : 'challenger';
                  const loser = duel[loserSlot];
                  return loser?.forfeited ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      {loser.userId === myUserId
                        ? 'You were disconnected for too long.'
                        : 'Your opponent was disconnected for too long.'}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      {duel.result === 'challenger'
                        ? (duel.challenger.userId === myUserId ? 'You ended the game first.' : 'Your opponent ended the game first.')
                        : (duel.opponent.userId === myUserId ? 'You ended the game first.' : 'Your opponent ended the game first.')}
                    </p>
                  );
                })()}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">Invite code:</span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 font-mono text-lg font-bold tracking-widest hover:bg-muted/50 transition-colors"
              >
                {duel.code}
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
              </button>
              {!isParticipant && duel.status === 'open' && (
                <Button onClick={() => api.joinDuelByCode(duel.code).then(setDuel)} variant="secondary">
                  Join This Duel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
