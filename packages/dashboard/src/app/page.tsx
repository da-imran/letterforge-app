"use client"

import React from 'react';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { UserAuth } from '@/components/UserAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Zap,
  Clock,
  Gamepad2,
  Trophy,
  Star,
  BookCheck,
  Shield,
  Link as LinkIcon
} from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user } = useUser();

  // Display name: use nickname if available, otherwise show email
  const displayName = user?.nickname || user?.email || 'Player';

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
              The LetterForge Engine
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
            <div className="flex flex-col items-center gap-8">
              <div className="flex flex-wrap justify-center gap-6">
                <ModeCard
                  title="Normal Mode"
                  desc="10x rounds. Forge your best words at your own pace."
                  mode="normal_mode"
                  icon={<Gamepad2 className="w-8 h-8 text-secondary" />}
                  color="border-secondary/20 hover:border-secondary/50"
                />
                <ModeCard
                  title="Time Attack"
                  desc="60 seconds. For those who forge under pressure."
                  mode="time_attack"
                  icon={<Clock className="w-8 h-8 text-primary" />}
                  color="border-primary/20 hover:border-primary/50"
                />
                <ModeCard
                  title="Survival Mode"
                  desc="Endless rounds. Keep forging until you can't find words."
                  mode="survival_mode"
                  icon={<Shield className="w-8 h-8 text-blue-500" />}
                  color="border-blue-500/20 hover:border-blue-500/50"
                />
                <ModeCard
                  title="Chain Mode"
                  desc="Link letters together. Each word starts with your last letter."
                  mode="chain_mode"
                  icon={<LinkIcon className="w-8 h-8 text-green-500" />}
                  color="border-green-500/20 hover:border-green-500/50"
                />
              </div>
              <p className="text-muted-foreground italic">Welcome back, <span className="text-foreground font-bold">{displayName}</span>!</p>
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

function ModeCard({ title, desc, mode, icon, color }: { title: string, desc: string, mode: string, icon: React.ReactNode, color: string }) {
  return (
    <Link href={`/play?mode=${mode}`} className="block group">
      <Card className={`w-72 h-64 transition-all duration-300 bg-card/40 backdrop-blur-sm border-2 ${color} hover:scale-105 hover:shadow-xl`}>
        <CardContent className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
          <div className="p-4 rounded-2xl bg-muted group-hover:bg-muted/80 transition-colors">
            {icon}
          </div>
          <h3 className="text-xl font-bold font-headline">{title}</h3>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
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
