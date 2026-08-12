"use client"

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { UserAuth } from '@/components/UserAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { DailyChallenge, UserStats } from '@/types';
import {
  Clock,
  Gamepad2,
  Trophy,
  Star,
  BookCheck,
  Shield,
  Link as LinkIcon,
  Swords,
  ArrowRight,
  Flame,
  Target
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user } = useUser();
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    api.getDailyChallenge()
      .then(setDailyChallenge)
      .catch(() => setDailyChallenge(null));
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?._id) {
      api.getUserStats(user._id)
        .then(setStats)
        .catch(() => setStats(null));
    } else {
      setStats(null);
    }
  }, [isAuthenticated, user?._id]);

  // Display name: use nickname if available, otherwise show email
  const displayName = user?.nickname || user?.email || 'Player';

  const totalScore = stats
    ? (stats.normal_mode?.totalScore ?? 0) + (stats.time_attack?.totalScore ?? 0) + (stats.survival_mode?.totalScore ?? 0) + (stats.chain_mode?.totalScore ?? 0)
    : 0;
  const totalGames = stats
    ? (stats.normal_mode?.gameCount ?? 0) + (stats.time_attack?.gameCount ?? 0) + (stats.survival_mode?.gameCount ?? 0) + (stats.chain_mode?.gameCount ?? 0)
    : 0;
  const activeModes = stats
    ? [stats.normal_mode, stats.time_attack, stats.survival_mode, stats.chain_mode].filter(s => s && s.gameCount > 0).length
    : 0;

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full py-12 md:py-24 lg:py-32 xl:py-48 flex flex-col items-center overflow-hidden">
        <div className="container px-4 md:px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 animate-in fade-in slide-in-from-bottom-3 duration-1000">
            <Star className="w-4 h-4 fill-primary" />
            <span>Test your word forging skill</span>
          </div>
          
          <h1 className="font-headline text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl mb-6">
            Forge Your Words in <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
              The LetterForge
            </span>
          </h1>
          
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl mb-12">
            Combine random letters into powerful words. Play at your own pace or race against the clock.
          </p>

          {!isAuthenticated ? (
            <div className="max-w-md mx-auto w-full animate-in fade-in zoom-in-95 duration-700">
              <UserAuth />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-10 w-full">
              <p className="text-muted-foreground italic">Welcome back, <span className="text-foreground font-bold">{displayName}</span>!</p>
              {/* Player context strip */}
              <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatPill
                  icon={<Flame className="w-5 h-5 text-orange-400" />}
                  label="Total Score"
                  value={totalScore.toLocaleString()}
                />
                <StatPill
                  icon={<Gamepad2 className="w-5 h-5 text-violet-400" />}
                  label="Games Played"
                  value={totalGames.toString()}
                />
                <StatPill
                  icon={<Target className="w-5 h-5 text-emerald-400" />}
                  label="Modes Conquered"
                  value={`${activeModes}/4`}
                />
              </div>
              {dailyChallenge && (
                <div className="w-full max-w-6xl">
                  <DailyChallengeHero dailyChallenge={dailyChallenge} />
                </div>
              )}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl">
                <ModeCard
                  title="Normal Mode"
                  desc="10x rounds. Forge your best words at your own pace."
                  mode="normal_mode"
                  icon={<Gamepad2 className="w-7 h-7" />}
                  accent={{
                    text: "text-violet-400",
                    bg: "bg-violet-500/10",
                    border: "border-violet-500/25",
                    hoverBorder: "hover:border-violet-400/60",
                    shadow: "hover:shadow-violet-500/20",
                    glow: "from-violet-500/20",
                    tag: "bg-violet-500 text-white"
                  }}
                />
                <ModeCard
                  title="Time Attack"
                  desc="60 seconds. For those who forge under pressure."
                  mode="time_attack"
                  icon={<Clock className="w-7 h-7" />}
                  accent={{
                    text: "text-orange-400",
                    bg: "bg-orange-500/10",
                    border: "border-orange-500/25",
                    hoverBorder: "hover:border-orange-400/60",
                    shadow: "hover:shadow-orange-500/20",
                    glow: "from-orange-500/20",
                    tag: "bg-orange-500 text-white"
                  }}
                />
                <ModeCard
                  title="Survival Mode"
                  desc="Endless rounds. Keep forging until you can't find words."
                  mode="survival_mode"
                  icon={<Shield className="w-7 h-7" />}
                  accent={{
                    text: "text-sky-400",
                    bg: "bg-sky-500/10",
                    border: "border-sky-500/25",
                    hoverBorder: "hover:border-sky-400/60",
                    shadow: "hover:shadow-sky-500/20",
                    glow: "from-sky-500/20",
                    tag: "bg-sky-500 text-white"
                  }}
                />
                <ModeCard
                  title="Chain Mode"
                  desc="Link letters together. Each word starts with your last letter."
                  mode="chain_mode"
                  icon={<LinkIcon className="w-7 h-7" />}
                  accent={{
                    text: "text-emerald-400",
                    bg: "bg-emerald-500/10",
                    border: "border-emerald-500/25",
                    hoverBorder: "hover:border-emerald-400/60",
                    shadow: "hover:shadow-emerald-500/20",
                    glow: "from-emerald-500/20",
                    tag: "bg-emerald-500 text-white"
                  }}
                />
                <ModeCard
                  title="Duels"
                  desc="1v1. Challenge a friend and compare your scores."
                  mode="duel"
                  icon={<Swords className="w-7 h-7" />}
                  accent={{
                    text: "text-fuchsia-400",
                    bg: "bg-fuchsia-500/10",
                    border: "border-fuchsia-500/25",
                    hoverBorder: "hover:border-fuchsia-400/60",
                    shadow: "hover:shadow-fuchsia-500/20",
                    glow: "from-fuchsia-500/20",
                    tag: "bg-fuchsia-500 text-white"
                  }}
                  href="/duels"
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Background Decor */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary rounded-full blur-[120px] animate-pulse"></div>
        </div>
      </section>

      {/* Stats/Feature Grid */}
      <section className="container px-4 py-16 md:py-24 border-t border-border/40">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
          <Feature 
            icon={<BookCheck className="w-10 h-10 text-primary" />}
            title="Dictionary Verified"
            desc="Real-time validation against our master word database for every forged entry."
          />
          <Feature 
            icon={<Trophy className="w-10 h-10 text-secondary" />}
            title="Global Leaderboard"
            desc="Compete with players worldwide. Daily, weekly, and all-time rankings."
          />
          <Feature 
            icon={<Star className="w-10 h-10 text-amber-500" />}
            title="Level Up"
            desc="The more you forge, the higher you climb. Master the dictionary."
          />
        </div>
      </section>
    </div>
  );
}

interface ModeAccent {
  text: string;
  bg: string;
  border: string;
  hoverBorder: string;
  shadow: string;
  glow: string;
  tag: string;
}

function ModeCard({ title, desc, mode, icon, href, clue, accent }: { title: string, desc: string, mode: string, icon: React.ReactNode, href?: string, clue?: string, accent: ModeAccent }) {
  return (
    <Link href={href || `/play?mode=${mode}`} className="block group relative">
      <Card className={`relative h-full min-h-[210px] overflow-hidden transition-all duration-300 bg-card/40 backdrop-blur-sm border-2 ${accent.border} ${accent.hoverBorder} hover:-translate-y-1.5 hover:shadow-2xl ${accent.shadow} cursor-pointer`}>
        {/* Hover glow background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${accent.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
        <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 relative">
          <div className={`p-4 rounded-2xl ${accent.bg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
            <span className={accent.text}>{icon}</span>
          </div>
          <h3 className="text-xl font-bold font-headline">{title}</h3>
          <p className="text-sm text-muted-foreground">{desc}</p>
          {clue && (
            <p className="text-xs text-muted-foreground italic line-clamp-2">{clue}</p>
          )}
          {/* Click affordance */}
          <div className="flex items-center gap-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <span className={`text-[11px] font-black uppercase tracking-widest ${accent.tag} px-3 py-1 rounded-full`}>
              Play
            </span>
            <ArrowRight className={`w-4 h-4 ${accent.text} transition-transform group-hover:translate-x-0.5`} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function DailyChallengeHero({ dailyChallenge }: { dailyChallenge: DailyChallenge }) {
  const [timeLeft, setTimeLeft] = useState('--:--:--');

  // Count down to local midnight — the challenge resets when the date key rolls over.
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const diff = Math.max(0, midnight.getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="relative overflow-hidden border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background/60 backdrop-blur-sm text-center transition-all duration-300 hover:border-amber-400/70 hover:shadow-2xl hover:shadow-amber-500/20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/15 to-transparent opacity-60" />
      <CardContent className="relative z-10 flex flex-col items-center justify-center h-full p-6 md:p-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Badge className="gap-1 bg-amber-500/15 text-amber-600 border-amber-500/30">
            <Flame className="w-3.5 h-3.5" />
            Limited time
          </Badge>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground tabular-nums">
            {new Date(`${dailyChallenge.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <h2 className="font-headline text-2xl md:text-3xl font-black tracking-tight">Today's Challenge</h2>
        <div className="max-w-xl border border-amber-500/30 bg-amber-500/5 rounded-lg p-4">
          <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Meaning of the day</p>
          <p className="text-base md:text-lg font-bold text-amber-500">{dailyChallenge.clue}</p>
        </div>
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          <HeroStat label="Time left" value={timeLeft} highlight />
          <HeroStat label="Attempt Allowed" value={String(dailyChallenge.attempts)} />
        </div>
        <div className="w-full pt-2">
          <Button asChild size="lg" className="group w-full bg-amber-500 text-black hover:bg-amber-400 h-12 font-black text-base">
            <Link href="/play?mode=daily_challenge">
              Play Daily Challenge
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HeroStat({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-base md:text-lg font-black tabular-nums ${highlight ? 'text-amber-500' : ''}`}>{value}</p>
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-5 py-4 transition-colors hover:border-primary/40">
      <div className="p-2.5 rounded-xl bg-muted/60">{icon}</div>
      <div className="text-left">
        <p className="text-[11px] text-muted-foreground font-black uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex flex-col items-center text-center space-y-4">
      <div className="mb-2">{icon}</div>
      <h3 className="text-2xl font-bold font-headline">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}
