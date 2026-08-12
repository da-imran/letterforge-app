"use client"

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { GameMode, Period, LeaderboardEntry } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Star, Clock, Gamepad2, Shield, Link as LinkIcon, Sun, Eye, Layers, Loader2, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function LeaderboardPage() {
  const [mode, setMode] = useState<GameMode | 'all'>('normal_mode');
  const [period, setPeriod] = useState<Period>('all_time');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to get display name from entry
  const getDisplayName = (entry: LeaderboardEntry) => entry.nickname || 'Anonymous';

  useEffect(() => {
    const fetchBoard = async () => {
      setIsLoading(true);
      try {
        const data = await api.getLeaderboard(mode, period);
        setEntries(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBoard();
  }, [mode, period]);

  return (
    <div className="container max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-secondary font-bold tracking-widest uppercase text-sm">
            <Trophy className="w-4 h-4" />
            Rankings
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight">Hall of Forge</h1>
          <p className="text-muted-foreground text-lg">See who forged the most powerful words in LetterForge history.</p>
        </div>

        <Tabs defaultValue="normal_mode" onValueChange={(v) => setMode(v as GameMode | 'all')} className="w-full md:w-auto">
          <TabsList className="bg-card grid grid-cols-3 md:grid-cols-7 w-full md:min-w-[640px]">
            <TabsTrigger value="all" className="gap-2 text-xs md:text-sm">
              <Layers className="w-4 h-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="normal_mode" className="gap-2 text-xs md:text-sm">
              <Gamepad2 className="w-4 h-4" />
              Normal
            </TabsTrigger>
            <TabsTrigger value="time_attack" className="gap-2 text-xs md:text-sm">
              <Clock className="w-4 h-4" />
              Timed
            </TabsTrigger>
            <TabsTrigger value="survival_mode" className="gap-2 text-xs md:text-sm">
              <Shield className="w-4 h-4" />
              Endless
            </TabsTrigger>
            <TabsTrigger value="chain_mode" className="gap-2 text-xs md:text-sm">
              <LinkIcon className="w-4 h-4" />
              Chain
            </TabsTrigger>
            <TabsTrigger value="fade_mode" className="gap-2 text-xs md:text-sm">
              <Eye className="w-4 h-4" />
              Fade
            </TabsTrigger>
            <TabsTrigger value="daily_challenge" className="gap-2 text-xs md:text-sm">
              <Sun className="w-4 h-4" />
              Daily
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-border/20 p-6">
          <Tabs defaultValue="all_time" onValueChange={(v) => setPeriod(v as Period)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="all_time">All Time</TabsTrigger>
              </TabsList>
              <div className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Updated in real-time
              </div>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground font-bold uppercase tracking-widest">Gathering rankings...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-4">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Medal className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold font-headline mb-2">No Forgers Yet</h3>
              <p className="text-muted-foreground max-w-xs">Be the first to forge words in this category and claim the #1 spot!</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[100px] text-center">Rank</TableHead>
                  <TableHead>Nickname</TableHead>
                  <TableHead className="text-right">Total Score</TableHead>
                  {mode !== 'all' && <TableHead className="text-right hidden sm:table-cell">All Modes</TableHead>}
                  <TableHead className="text-right hidden sm:table-cell">Games</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => (
                  <TableRow key={entry.userId} className="group hover:bg-primary/5 transition-colors">
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {idx === 0 ? <RankBadge color="text-amber-500" rank={1} /> :
                         idx === 1 ? <RankBadge color="text-slate-300" rank={2} /> :
                         idx === 2 ? <RankBadge color="text-amber-700" rank={3} /> :
                         <span className="font-bold text-muted-foreground text-lg">#{idx + 1}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      <div className="flex items-center gap-2">
                        {getDisplayName(entry)}
                        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-black text-xl text-primary tabular-nums">
                        {entry.totalScore.toLocaleString()}
                      </span>
                    </TableCell>
                    {mode !== 'all' && (
                      <TableCell className="text-right hidden sm:table-cell">
                        <span className="font-bold text-muted-foreground tabular-nums">
                          {entry.allScore.toLocaleString()}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right hidden sm:table-cell">
                      <Badge variant="secondary" className="font-bold">
                        {entry.gameCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(entry.lastPlayedAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankBadge({ color, rank }: { color: string, rank: number }) {
  return (
    <div className={`relative flex items-center justify-center ${color}`}>
      <Medal className="w-8 h-8 fill-current" />
      <span className="absolute text-[10px] font-black text-background mb-0.5">{rank}</span>
    </div>
  );
}
