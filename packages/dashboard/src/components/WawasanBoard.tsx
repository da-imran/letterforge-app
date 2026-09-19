"use client"

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { subscribeToDuel, ConnectionState } from '@/lib/realtime';
import { Duel, WawasanState } from '@/types';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Send, OctagonX, Trophy, Loader2, Hourglass } from 'lucide-react';

const WALKTHROUGH_KEY = 'wawasan-walkthrough-seen-v1';

const COLUMN_EMOJI: Array<[RegExp, string]> = [
  [/makan|food/i, '🍛'],
  [/minum|drink/i, '🥤'],
  [/negeri|state/i, '🏝️'],
  [/negar|countr/i, '🌏'],
  [/nama|orang|person|\bname\b/i, '😎'],
  [/haiwan|animal/i, '🐯'],
  [/buah|fruit/i, '🍉'],
  [/kerja|pekerjaan|job|occupation/i, '💼'],
  [/bandar|kota|city|town/i, '🏙️'],
  [/kereta|kenderaan|car|vehicle/i, '🚗'],
  [/bunga|flower/i, '🌺'],
  [/warna|colo[u]r/i, '🎨'],
  [/sukan|sport/i, '⚽'],
  [/filem|movie|film/i, '🎬'],
  [/lagu|song|music/i, '🎵'],
  [/sekolah|school/i, '🏫'],
];

function columnEmoji(name: string): string {
  for (const [pattern, emoji] of COLUMN_EMOJI) {
    if (pattern.test(name)) return emoji;
  }
  return '📝';
}

function norm(value: string | null | undefined): string {
  // Must mirror the server: collapse whitespace so "teh o ais" and
  // "teh  o  ais" count as the same answer in live totals and cell marks.
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Live running totals from completed rows (mirrors the server's independent scoring). */
function scoreSheet(w: WawasanState): { challenger: number; opponent: number } {
  const totals = { challenger: 0, opponent: 0 };
  for (const round of w.rounds) {
    if (round.status !== 'done') continue;
    for (let i = 0; i < w.columns.length; i++) {
      const a = norm(round.answers.challenger[i]);
      const b = norm(round.answers.opponent[i]);
      const aChallenged = Boolean((round.challenges?.opponent as any)?.[String(i)] || (round.challenges?.opponent as any)?.[i]);
      const bChallenged = Boolean((round.challenges?.challenger as any)?.[String(i)] || (round.challenges?.challenger as any)?.[i]);
      if (a && !aChallenged && (!b || a !== b)) totals.challenger += w.pointsPerColumn;
      if (b && !bChallenged && (!a || b !== a)) totals.opponent += w.pointsPerColumn;
    }
  }
  return totals;
}

const WALKTHROUGH_STEPS = [
  { emoji: '🤝', text: 'The owner (game creator) writes 3–10 column names on the sheet — e.g. Makanan, Minuman, Negara, Haiwan. Free text: English, Melayu, or anything you want!' },
  { emoji: '🔀', text: 'All 26 alphabets A–Z are shuffled. Rows follow that secret order, one letter per row.' },
  { emoji: '✏️', text: 'Each row shows one letter. Fill every column with a word that starts with that letter — multi-word answers like "ais kosong" or "teh o ais" are allowed.' },
  { emoji: '⏭️', text: 'Stuck on a column? Press Skip — skipped columns score 0, no penalty beyond that.' },
  { emoji: '📨', text: 'Both players press Hantar. No time limit — fikir masak-masak!' },
  { emoji: '👀', text: 'Review: after both submit, the sheet reveals BOTH answers. Semak jawapan lawan — if something looks invalid (weird word, wrong language, nonsense), press "Tandakan tidak sah" to omit that specific column for the opponent. Your own score is independent — omitting theirs does not delete your points.' },
  { emoji: '✓', text: 'Both players press Sahkan to lock the row. Once both confirm, the row is scored and the next letter opens. You can still argue in chat while reviewing — the row only locks when both sahkan.' },
  { emoji: '⚖️', text: 'Scoring (per player, independent): skipped = 0; same word = 0; different valid words = full points for that column. If your answer was omitted by the opponent, you get 0 for that column, but your opponent can still score theirs.' },
  { emoji: '🛑', text: 'Only the owner can stop the game, at any time. The open/review row is thrown away — only finished (sahkan) rows count.' },
  { emoji: '🏆', text: 'Highest total wins. Same total? Seri — it\'s a draw!' },
];

export function WawasanBoard({ duelId }: { duelId: string }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [live, setLive] = useState<ConnectionState>('closed');
  const [draft, setDraft] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<boolean[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [challengingCols, setChallengingCols] = useState<Set<number>>(new Set());
  const [confirmStop, setConfirmStop] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Live sheet updates + polling fallback.
  useEffect(() => {
    const unsubscribe = subscribeToDuel(duelId, (updated) => setDuel(updated), {
      onConnectionChange: setLive,
    });
    const poll = setInterval(() => {
      api.getDuel(duelId).then(setDuel).catch(() => setLive('reconnecting'));
    }, 5000);
    return () => {
      clearInterval(poll);
      unsubscribe();
    };
  }, [duelId]);

  // First visit: open the how-to-play walkthrough automatically.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(WALKTHROUGH_KEY)) {
        setShowWalkthrough(true);
      }
    } catch {
      setShowWalkthrough(true);
    }
  }, []);

  const closeWalkthrough = () => {
    setShowWalkthrough(false);
    try {
      window.localStorage.setItem(WALKTHROUGH_KEY, 'yes');
    } catch {
      // Private mode — the walkthrough will simply show again next time.
    }
  };

  const wawasan = duel?.wawasan ?? null;
  const myUserId = user?._id ?? null;
  const mySlot: 'challenger' | 'opponent' | null =
    duel && duel.challenger.userId === myUserId ? 'challenger'
      : duel && duel.opponent.userId === myUserId ? 'opponent'
        : null;
  const isOwner = mySlot === 'challenger';
  const myName = mySlot && duel ? duel[mySlot].nickname || 'You' : 'You';
  const otherSlot = mySlot === 'challenger' ? 'opponent' : 'challenger';
  const otherName = mySlot && duel ? duel[otherSlot].nickname || 'Opponent' : 'Opponent';

  const openRound = useMemo(() => {
    if (!wawasan || duel?.status !== 'playing') return null;
    const round = wawasan.rounds[wawasan.currentRound];
    return round && round.status === 'open' ? round : null;
  }, [wawasan, duel?.status]);

  const reviewRound = useMemo(() => {
    if (!wawasan || duel?.status !== 'playing') return null;
    const round = wawasan.rounds[wawasan.currentRound];
    return round && round.status === 'review' ? round : null;
  }, [wawasan, duel?.status]);

  // Fresh answer boxes whenever a new letter row opens.
  useEffect(() => {
    if (!wawasan) return;
    setDraft(Array.from({ length: wawasan.columns.length }, () => ''));
    setSkipped(Array.from({ length: wawasan.columns.length }, () => false));
    setConfirmStop(false);
  }, [wawasan?.currentRound, wawasan?.columns.length, duelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = useMemo(() => (wawasan ? scoreSheet(wawasan) : { challenger: 0, opponent: 0 }), [wawasan]);

  if (!duel || !wawasan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-bold tracking-widest uppercase animate-pulse">
          Membuka kertas permainan…
        </p>
      </div>
    );
  }

  const completed = duel.status === 'completed';
  const myTotal = completed ? (mySlot ? (duel[mySlot].score ?? 0) : 0) : mySlot ? running[mySlot] : 0;
  const otherTotal = completed
    ? (mySlot ? (duel[otherSlot].score ?? 0) : 0)
    : mySlot ? running[otherSlot] : 0;

  const iSubmitted = Boolean(mySlot && openRound?.submitted[mySlot]);
  const bothSubmitted = Boolean(openRound?.submitted.challenger && openRound?.submitted.opponent);

  const handleDraftChange = (index: number, value: string) => {
    setDraft((prev) => prev.map((v, i) => (i === index ? value.slice(0, 50) : v)));
  };

  const toggleSkip = (index: number) => {
    setSkipped((prev) => prev.map((v, i) => (i === index ? !v : v)));
    setDraft((prev) => prev.map((v, i) => (i === index ? '' : v)));
  };

  const handleSubmit = async () => {
    if (!openRound || !mySlot || isSubmitting) return;
    const answers = wawasan.columns.map((_, i) => (skipped[i] ? '' : draft[i].trim()));
    for (let i = 0; i < answers.length; i++) {
      if (answers[i] && answers[i][0].toLowerCase() !== openRound.letter.toLowerCase()) {
        toast({
          variant: 'destructive',
          title: 'Salah huruf!',
          description: `"${wawasan.columns[i]}" mesti bermula dengan huruf ${openRound.letter}.`,
        });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const updated = await api.submitWawasanAnswers(duelId, answers);
      setDuel(updated);
      toast({ title: 'Dihantar! ✏️', description: 'Jawapan anda sudah direkod dalam kertas.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hantar gagal', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChallenge = async (columnIndex: number) => {
    if (!reviewRound || !mySlot) return;
    setChallengingCols(prev => new Set(prev).add(columnIndex));
    try {
      const updated = await api.challengeWawasanAnswer(duelId, columnIndex);
      setDuel(updated);
      const isNowInvalid = Boolean(
        (updated.wawasan?.rounds[updated.wawasan.currentRound] as any)?.challenges?.[mySlot]?.[String(columnIndex)] ??
        (updated.wawasan?.rounds[updated.wawasan.currentRound] as any)?.challenges?.[mySlot]?.[columnIndex]
      );
      toast({
        title: isNowInvalid ? 'Jawapan lawan ditanda tidak sah ❌' : 'Tanda dibatalkan — dianggap sah ✓',
        description: `Lajur "${wawasan!.columns[columnIndex]}" ${isNowInvalid ? 'lawan tidak akan dapat markah.' : 'lawan akan dapat markah semula.'}`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Gagal menanda', description: err.message });
    } finally {
      setChallengingCols(prev => {
        const next = new Set(prev);
        next.delete(columnIndex);
        return next;
      });
    }
  };

  const handleConfirmReview = async () => {
    if (!reviewRound || !mySlot) return;
    setIsConfirming(true);
    try {
      const updated = await api.confirmWawasanReview(duelId);
      setDuel(updated);
      toast({ title: 'Semakan disahkan ✓', description: 'Menunggu lawan mengesahkan...' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Gagal mengesahkan', description: err.message });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 6000);
      return;
    }
    setIsStopping(true);
    try {
      const updated = await api.stopWawasan(duelId);
      setDuel(updated);
      toast({ title: 'Permainan ditamatkan 🛑', description: 'Markah dikira dari baris yang sudah siap.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Tidak dapat ditamatkan', description: err.message });
    } finally {
      setIsStopping(false);
      setConfirmStop(false);
    }
  };

  const winnerText = duel.result === 'draw'
    ? 'Seri! 🤝'
    : duel.result === mySlot
      ? 'Anda Menang! 🏆'
      : `${otherName} Menang! 🏆`;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Classic header */}
      <div className="text-center mb-6 space-y-1">
        <p className="text-sm font-bold tracking-[0.3em] uppercase text-muted-foreground">
          🇲🇾 Duel Mod Klasik 🇲🇾
        </p>
        <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight">
          Wawasan <span className="text-amber-500">2020</span> 📝
        </h1>
        <p className="text-muted-foreground">
          Kertas A4 · Huruf <span className="font-mono font-bold">{openRound?.letter ?? '—'}</span> · Pusingan{' '}
          {wawasan.rounds.filter((r) => r.status === 'done').length + (openRound ? 1 : 0)}/26
          {live === 'reconnecting' && <span className="text-amber-500 font-bold"> · RECONNECTING</span>}
        </p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button variant="outline" size="sm" onClick={() => setShowWalkthrough(true)} className="gap-2">
            <BookOpen className="w-4 h-4" />
            Cara Bermain 📖
          </Button>
          {isOwner && !completed && (
            <Button
              variant={confirmStop ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleStop}
              disabled={isStopping}
              className="gap-2"
            >
              <OctagonX className="w-4 h-4" />
              {isStopping ? 'Menamatkan…' : confirmStop ? 'Sahkan Tamat? 🛑' : 'Tamatkan Permainan 🛑'}
            </Button>
          )}
        </div>
      </div>

      {/* Scoreboard strip */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{myName} (Anda)</p>
          <p className="text-4xl font-black tabular-nums text-primary">{myTotal}</p>
        </div>
        <Trophy className={`w-8 h-8 ${completed ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{otherName}</p>
          <p className="text-4xl font-black tabular-nums text-secondary">{otherTotal}</p>
        </div>
      </div>

      {/* The A4 paper sheet */}
      <div className="relative rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.45)] rotate-[-0.3deg]">
        {/* Punch holes */}
        <div className="absolute left-3 top-10 z-10 h-8 w-8 rounded-full bg-background shadow-inner" />
        <div className="absolute left-3 top-1/2 z-10 h-8 w-8 rounded-full bg-background shadow-inner" />
        <div className="absolute left-3 bottom-10 z-10 h-8 w-8 rounded-full bg-background shadow-inner" />

        <div className="wawasan-paper rounded-sm px-4 py-6 pl-16">
          <div className="text-center border-b-2 border-dashed border-[#8f1d16]/40 pb-3 mb-4">
            <p className="wawasan-heading text-2xl font-black tracking-wide">WAWASAN 2020 ✏️📏</p>
            <p className="wawasan-ink text-sm">
              {wawasan.columns.length} lajur × {wawasan.pointsPerColumn} markah = 100 markah · Kod: {duel.code}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[560px]">
              <thead>
                <tr>
                  <th className="wawasan-ink text-left font-bold p-2 w-14">Abjad</th>
                  {wawasan.columns.map((col) => (
                    <th key={col} className="wawasan-ink text-left font-bold p-2">
                      {columnEmoji(col)} {col}
                    </th>
                  ))}
                  <th className="wawasan-ink text-center font-bold p-2 w-16">✓</th>
                </tr>
              </thead>
              <tbody>
                {/* Completed rows: the row sheet */}
                {wawasan.rounds.filter((r) => r.status === 'done').map((round) => {
                  let rowScore = 0;
                  const cells = wawasan.columns.map((_, i) => {
                    const a = norm(mySlot ? round.answers[mySlot][i] : null);
                    const b = norm(mySlot ? round.answers[otherSlot][i] : null);
                    const raw = mySlot ? (round.answers[mySlot][i] || '—') : '—';
                    const iChallenged = Boolean((round.challenges as any)?.[otherSlot]?.[String(i)] || (round.challenges as any)?.[otherSlot]?.[i]);
                    if (!a) return { text: raw, mark: '–', scored: false };
                    if (iChallenged) return { text: raw, mark: '✗', scored: false };
                    if (!b) {
                      rowScore += wawasan.pointsPerColumn;
                      return { text: raw, mark: '✓', scored: true };
                    }
                    if (a === b) return { text: raw, mark: '=', scored: false };
                    rowScore += wawasan.pointsPerColumn;
                    return { text: raw, mark: '✓', scored: true };
                  });
                  return (
                    <tr key={round.letter} className="border-t border-[#2e2b23]/20">
                      <td className="p-2">
                        <span className="wawasan-stamp text-[#8f1d16] text-lg">{round.letter}</span>
                      </td>
                      {cells.map((cell, i) => (
                        <td key={i} className="p-2">
                          <span className="wawasan-ink text-sm break-words">{cell.text}</span>{' '}
                          <span className={cell.scored ? 'text-emerald-700 font-bold' : 'text-[#2e2b23]/40'}>
                            {cell.mark}
                          </span>
                        </td>
                      ))}
                      <td className="p-2 text-center wawasan-ink font-bold">+{rowScore}</td>
                    </tr>
                  );
                })}

                {/* Review phase: both answers visible, can challenge opponent's invalid words */}
                {reviewRound && !completed && mySlot && (
                  <tr className="border-t-2 border-amber-600/60 bg-amber-50/70">
                    <td className="p-2 align-top">
                      <span className="wawasan-stamp text-[#8f1d16] text-2xl">{reviewRound.letter}</span>
                      <p className="wawasan-ink text-xs mt-1 font-bold">Semakan</p>
                    </td>
                    {wawasan.columns.map((col, i) => {
                      const myAns = reviewRound.answers[mySlot][i] || '—';
                      const oppAns = reviewRound.answers[otherSlot][i] || '—';
                      const myAnsNorm = norm(reviewRound.answers[mySlot][i]);
                      const oppAnsNorm = norm(reviewRound.answers[otherSlot][i]);
                      const oppChallenged = Boolean((reviewRound.challenges as any)?.[mySlot]?.[String(i)] || (reviewRound.challenges as any)?.[mySlot]?.[i]);
                      const iAmChallenged = Boolean((reviewRound.challenges as any)?.[otherSlot]?.[String(i)] || (reviewRound.challenges as any)?.[otherSlot]?.[i]);
                      const same = myAnsNorm && oppAnsNorm && myAnsNorm === oppAnsNorm;
                      const iConfirmed = Boolean((reviewRound.confirmed as any)?.[mySlot]);
                      return (
                        <td key={col} className="p-2 align-top min-w-[130px] space-y-2">
                          <div className={`rounded px-2 py-1 text-sm ${iAmChallenged ? 'bg-red-100 line-through opacity-60' : 'bg-white/70'}`}>
                            <span className="text-xs font-bold text-[#2e2b23]/60">Anda:</span>
                            <p className="wawasan-ink font-bold break-words">{myAns}</p>
                            {iAmChallenged && <p className="text-xs text-red-600 font-bold">✗ Ditanda lawan</p>}
                            {same && !iAmChallenged && <p className="text-xs text-[#2e2b23]/50">= sama → 0</p>}
                          </div>
                          <div className={`rounded px-2 py-1 text-sm ${oppChallenged ? 'bg-red-100 opacity-60' : 'bg-amber-100/70'}`}>
                            <span className="text-xs font-bold text-[#2e2b23]/60">Lawan ({otherName}):</span>
                            <p className="wawasan-ink break-words">{oppAns}</p>
                            {!oppAnsNorm ? (
                              <p className="text-xs text-[#2e2b23]/40">— kosong → 0</p>
                            ) : same ? (
                              <p className="text-xs text-[#2e2b23]/50">= sama → 0</p>
                            ) : oppChallenged ? (
                              <>
                                <p className="text-xs text-red-600 font-bold">✗ Anda tanda tidak sah → lawan 0</p>
                                {!iConfirmed && (
                                  <button
                                    type="button"
                                    onClick={() => handleChallenge(i)}
                                    disabled={challengingCols.has(i)}
                                    className="mt-1 text-xs font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 disabled:opacity-50"
                                  >
                                    {challengingCols.has(i) ? 'Membatalkan…' : '↩ Batal — anggap sah'}
                                  </button>
                                )}
                              </>
                            ) : null}
                            {!oppChallenged && oppAnsNorm && !same && !iConfirmed && (
                              <button
                                type="button"
                                onClick={() => handleChallenge(i)}
                                disabled={challengingCols.has(i)}
                                className="mt-1 text-xs font-bold text-[#8f1d16] underline underline-offset-2 hover:text-red-700 disabled:opacity-50"
                              >
                                {challengingCols.has(i) ? 'Menanda…' : '✗ Tandakan tidak sah'}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center align-top space-y-2">
                      {Boolean((reviewRound.confirmed as any)?.[mySlot]) ? (
                        <Badge className="bg-emerald-700">Anda sah ✓</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleConfirmReview}
                          disabled={isConfirming}
                          className="gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                        >
                          {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : '✓'} Sahkan
                        </Button>
                      )}
                      <div className="wawasan-ink text-xs">
                        <p>{otherName}: {(reviewRound.confirmed as any)?.[otherSlot] ? '✓ sudah sah' : '⏳ belum sah'}</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* The open row: answer sheet */}
                {openRound && !completed && !reviewRound && (
                  <tr className="border-t-2 border-[#8f1d16]/50 bg-[#fff8dc]/60">
                    <td className="p-2 align-top">
                      <span className="wawasan-stamp text-[#8f1d16] text-2xl">{openRound.letter}</span>
                    </td>
                    {wawasan.columns.map((col, i) => (
                      <td key={col} className="p-2 align-top min-w-[130px]">
                        {iSubmitted ? (
                          <p className="wawasan-ink text-sm italic">
                            {skipped[i] ? '— dilangkau ⏭️' : draft[i] ? `"${draft[i]}" ✓` : '—'}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <input
                              className="wawasan-input text-sm"
                              value={skipped[i] ? '' : (draft[i] ?? '')}
                              disabled={skipped[i]}
                              onChange={(e) => handleDraftChange(i, e.target.value)}
                              placeholder={skipped[i] ? 'Dilangkau ⏭️' : `${openRound.letter}…`}
                              maxLength={50}
                            />
                            <button
                              type="button"
                              onClick={() => toggleSkip(i)}
                              className={`text-xs font-bold underline underline-offset-2 ${
                                skipped[i] ? 'text-[#8f1d16]' : 'text-[#2e2b23]/50 hover:text-[#8f1d16]'
                              }`}
                            >
                              {skipped[i] ? '↩️ Batal langkau' : '⏭️ Langkau'}
                            </button>
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="p-2 text-center align-top">
                      {iSubmitted ? (
                        bothSubmitted ? (
                          <Badge className="bg-emerald-700">Siap!</Badge>
                        ) : (
                          <span className="wawasan-ink text-xs italic flex items-center gap-1 justify-center">
                            <Hourglass className="w-3 h-3" /> lawan…
                          </span>
                        )
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="gap-1 bg-[#8f1d16] hover:bg-[#8f1d16]/90 text-[#f6f1de] font-bold"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Hantar
                        </Button>
                      )}
                    </td>
                  </tr>
                )}

                {/* Upcoming letters preview */}
                {!completed && (
                  <tr className="border-t border-[#2e2b23]/20">
                    <td colSpan={wawasan.columns.length + 2} className="p-2">
                      <p className="wawasan-ink text-xs text-[#2e2b23]/60">
                        🔜 Huruf seterusnya:{' '}
                        {wawasan.letters.slice(wawasan.currentRound + 1, wawasan.currentRound + 6).join(' · ') || '—'}
                        {wawasan.letters.length - wawasan.currentRound - 1 > 5 &&
                          ` · …${wawasan.letters.length - wawasan.currentRound - 6} lagi`}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {completed && (
            <div className="text-center pt-4 space-y-2">
              <p className="wawasan-stamp text-[#8f1d16] text-xl">{winnerText}</p>
              <p className="wawasan-ink text-sm">
                Keputusan muktamad: {myName} {myTotal} — {otherTotal} {otherName}
                {wawasan.stoppedAt ? ' (ditamatkan awal oleh tuan rumah 🛑)' : ' (26 huruf selesai 🎉)'}
              </p>
              <Button asChild className="gap-2 mt-2">
                <Link href="/duels">Kembali ke Duel ⚔️</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        ✓ = jawapan unik (+{wawasan.pointsPerColumn}) · = = sama dengan lawan (0) · – = kosong/langkau (0)
      </p>

      {/* Walkthrough dialog */}
      <Dialog open={showWalkthrough} onOpenChange={(open) => (open ? setShowWalkthrough(true) : closeWalkthrough())}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline">📖 Cara Bermain Wawasan 2020</DialogTitle>
            <DialogDescription>
              Permainan kertas klasik Malaysia — sama seperti main di buku latihan sekolah! 🇲🇾
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 mt-2">
            {WALKTHROUGH_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-base">
                  {step.emoji}
                </span>
                <p className="pt-0.5">
                  <span className="font-bold mr-1">{i + 1}.</span>
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
          <Button onClick={closeWalkthrough} className="w-full mt-4 gap-2">
            Jom Main! ▶️
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
