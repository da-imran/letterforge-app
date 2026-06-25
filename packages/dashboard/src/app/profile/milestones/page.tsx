"use client"

import React, { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/context/UserContext';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trophy, Filter, Search, Lock, Star, Award, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Milestone } from '@/types';

type RarityFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary';
type CategoryFilter = 'all' | 'games' | 'points' | 'words' | 'time_attack' | 'special';

const RARITY_COLORS = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-cyan-500',
  epic: 'from-purple-400 to-pink-500',
  legendary: 'from-amber-400 to-orange-500',
};

const RARITY_BORDER = {
  common: 'border-gray-500/30',
  rare: 'border-cyan-500/30',
  epic: 'border-purple-500/30',
  legendary: 'border-amber-500/30',
};

export default function MilestonesPage() {
  const { user, isAuthenticated, isLoading: userLoading } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [userMilestoneIds, setUserMilestoneIds] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (userLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch all milestones from backend
        const milestones = await api.getAllMilestones();
        setAllMilestones(Array.isArray(milestones) ? milestones : []);

        // Fetch user's completed milestones from user object
        // Backend getUserMilestones API is broken; user.milestones already contains the data
        if (user?.milestones) {
          setUserMilestoneIds(user.milestones);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, userLoading, isAuthenticated, router]);

  // Calculate filtered milestones
  const { unlockedCount, totalCount, filteredMilestones } = useMemo(() => {
    const unlocked = allMilestones.filter(m => userMilestoneIds.includes(m._id));
    const filtered = allMilestones.filter(m => {
      const matchesRarity = rarityFilter === 'all' || m.rarity === rarityFilter;
      const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
      const matchesSearch = searchQuery === '' ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRarity && matchesCategory && matchesSearch;
    });
    return {
      unlockedCount: unlocked.length,
      totalCount: allMilestones.length,
      filteredMilestones: filtered
    };
  }, [allMilestones, userMilestoneIds, rarityFilter, categoryFilter, searchQuery]);

  if (userLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase">Loading milestones...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center gap-6">
        <Button variant="ghost" onClick={() => router.push('/profile')} className="self-start">
          ← Back to Profile
        </Button>
        <div className="flex-grow text-center">
          <h1 className="text-4xl font-black font-headline tracking-tight flex items-center gap-3 justify-center">
            <Trophy className="w-10 h-10 text-amber-500" />
            Forge Milestones
          </h1>
          <p className="text-muted-foreground mt-2">Track your achievements as a Word Forger</p>
        </div>
      </div>

      {/* Stats Summary */}
      <Card className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Award className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">Milestones Unlocked</p>
                <p className="text-4xl font-black">{unlockedCount} / {totalCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Rarity:</span>
          </div>
          {(['all', 'common', 'rare', 'epic', 'legendary'] as RarityFilter[]).map((rarity) => (
            <Button
              key={rarity}
              variant={rarityFilter === rarity ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRarityFilter(rarity)}
              className="capitalize"
            >
              {rarity}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Type:</span>
          </div>
          {(['all', 'games', 'points', 'words', 'time_attack', 'special'] as CategoryFilter[]).map((category) => (
            <Button
              key={category}
              variant={categoryFilter === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(category)}
              className="capitalize"
            >
              {category.replace('_', ' ')}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search milestones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Milestones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMilestones.map((milestone) => {
          const isUnlocked = userMilestoneIds.includes(milestone._id);
          return (
            <div
              key={milestone.id}
              className={`
                relative p-4 rounded-2xl border-2 transition-all
                ${isUnlocked ? RARITY_BORDER[milestone.rarity] : 'border-border/30 grayscale opacity-50'}
                ${isUnlocked ? 'bg-card/50' : 'bg-muted/20'}
                hover:scale-[1.02] hover:shadow-lg
              `}
            >
              {/* Icon & Rarity Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                  bg-gradient-to-br ${RARITY_COLORS[milestone.rarity]}
                  ${!isUnlocked && 'grayscale'}
                `}>
                  {milestone.icon}
                </div>
                <span className={`
                  text-xs font-bold uppercase px-2 py-1 rounded-full
                  ${milestone.rarity === 'common' && 'bg-gray-500/20 text-gray-400'}
                  ${milestone.rarity === 'rare' && 'bg-cyan-500/20 text-cyan-400'}
                  ${milestone.rarity === 'epic' && 'bg-purple-500/20 text-purple-400'}
                  ${milestone.rarity === 'legendary' && 'bg-amber-500/20 text-amber-400'}
                `}>
                  {milestone.rarity}
                </span>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <h3 className={`font-bold text-lg ${!isUnlocked && 'text-muted-foreground'}`}>
                  {milestone.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {milestone.description}
                </p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground uppercase">
                    {milestone.category?.replace('_', ' ') || 'special'}
                  </span>
                  {isUnlocked ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-500 font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      Unlocked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  )}
                </div>
              </div>

              {/* Glow effect for unlocked legendary */}
              {isUnlocked && milestone.rarity === 'legendary' && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      {filteredMilestones.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No milestones match your filters</p>
        </div>
      )}
    </div>
  );
}