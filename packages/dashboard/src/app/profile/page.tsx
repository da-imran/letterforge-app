"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, User as UserIcon, Calendar, Star, Trophy, Gamepad2, Clock, Shield, Link as LinkIcon, Eye, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface UserStats {
  totalScore: number;
  gameCount: number;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: userLoading, logout } = useUser();
  const [normalStats, setNormalStats] = useState<UserStats>({ totalScore: 0, gameCount: 0 });
  const [timedStats, setTimedStats] = useState<UserStats>({ totalScore: 0, gameCount: 0 });
  const [survivalStats, setSurvivalStats] = useState<UserStats>({ totalScore: 0, gameCount: 0 });
  const [chainStats, setChainStats] = useState<UserStats>({ totalScore: 0, gameCount: 0 });
  const [fadeStats, setFadeStats] = useState<UserStats>({ totalScore: 0, gameCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const fetchStats = useCallback(async (showLoading = true) => {
    if (!user) return;
    try {
      if (showLoading) setIsLoading(true);

      const stats = await api.getUserStats(user._id);

      setNormalStats(stats.normal_mode || { totalScore: 0, gameCount: 0 });
      setTimedStats(stats.time_attack || { totalScore: 0, gameCount: 0 });
      setSurvivalStats(stats.survival_mode || { totalScore: 0, gameCount: 0 });
      setChainStats(stats.chain_mode || { totalScore: 0, gameCount: 0 });
      setFadeStats(stats.fade_mode || { totalScore: 0, gameCount: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (userLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    fetchStats();
  }, [user, userLoading, isAuthenticated, router, fetchStats]);

  // Refresh stats when page becomes visible (e.g., after returning from game)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStats(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats(false);
    toast({ title: "Stats Refreshed", description: "Your scores have been updated." });
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm("Are you sure? This will delete all your scores permanently.")) return;

    try {
      await api.deleteUser(user._id);
      toast({ title: "Account Deleted", description: "Your data has been erased." });
      logout();
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  if (userLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase">Opening profile forge...</p>
      </div>
    );
  }

  const combinedScore = normalStats.totalScore + timedStats.totalScore + survivalStats.totalScore + chainStats.totalScore + fadeStats.totalScore;
  const combinedGames = normalStats.gameCount + timedStats.gameCount + survivalStats.gameCount + chainStats.gameCount + fadeStats.gameCount;

  // Display name: use nickname if available, otherwise show email
  const displayName = user?.nickname || user?.email || 'Player';

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 bg-card/40 backdrop-blur-md border border-border/50 p-8 rounded-3xl shadow-xl">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary p-1">
          <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
            <UserIcon className="w-10 h-10 text-primary" />
          </div>
        </div>
        <div className="flex-grow text-center md:text-left space-y-2">
          <h1 className="text-3xl font-black font-headline tracking-tight">{displayName}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Forged on {user ? format(new Date(user.createdAt), 'MMM yyyy') : ''}
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              Forgue Master
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
          <Button variant="ghost" size="sm" onClick={handleDeleteAccount} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Combined Total Score */}
      <Card className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-border/50 overflow-hidden">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">Combined Total Score</p>
              <p className="text-3xl font-black tabular-nums">{combinedScore.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{combinedGames} Total Games Played</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Normal Mode"
          icon={<Gamepad2 className="w-6 h-6 text-secondary" />}
          score={normalStats.totalScore}
          games={normalStats.gameCount}
          color="secondary"
        />
        <StatCard
          title="Time Attack"
          icon={<Clock className="w-6 h-6 text-primary" />}
          score={timedStats.totalScore}
          games={timedStats.gameCount}
          color="primary"
        />
        <StatCard
          title="Endless Mode"
          icon={<Shield className="w-6 h-6 text-blue-500" />}
          score={survivalStats.totalScore}
          games={survivalStats.gameCount}
          color="primary"
        />
        <StatCard
          title="Chain Mode"
          icon={<LinkIcon className="w-6 h-6 text-green-500" />}
          score={chainStats.totalScore}
          games={chainStats.gameCount}
          color="primary"
        />
        <StatCard
          title="Fade Mode"
          icon={<Eye className="w-6 h-6 text-rose-500" />}
          score={fadeStats.totalScore}
          games={fadeStats.gameCount}
          color="primary"
        />
      </div>

      {/* Recent Achievements / Milestones */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Forgue Milestones
          </CardTitle>
          <Link href="/profile/milestones">
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Milestone active={combinedGames >= 1} label="First Forge" desc="Complete your first game" />
            <Milestone active={combinedScore >= 1000} label="Word Smith" desc="Earn 1,000 total points" />
            <Milestone active={survivalStats.gameCount >= 5} label="Endless Player" desc="Complete 5 Endless games" />
            <Milestone active={chainStats.totalScore >= 500} label="Chain Breaker" desc="Earn 500 points in Chain mode" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, icon, score, games, color }: { title: string, icon: React.ReactNode, score: number, games: number, color: 'primary' | 'secondary' }) {
  const colorClass = color === 'primary' ? 'text-primary' : 'text-secondary';
  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/50 overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-headline flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">Total Forged Points</span>
          <span className={`text-4xl font-black ${colorClass} tabular-nums group-hover:scale-105 transition-transform origin-left`}>
            {score.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/20 pt-4">
          <span className="text-sm font-medium text-muted-foreground">Games Completed</span>
          <span className="text-xl font-bold">{games}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Milestone({ active, label, desc }: { active: boolean, label: string, desc: string }) {
  return (
    <div className={`p-4 rounded-2xl border ${active ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/30 grayscale opacity-40'} transition-all`}>
      <h4 className="font-bold text-sm mb-1">{label}</h4>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
