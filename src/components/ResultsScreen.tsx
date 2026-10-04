import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Share2,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { UserAnswer } from '../types/quiz';
import { getScoreEvaluation } from '../data/quizData';
import { CategoryIcon } from './CategoryIcon';
import { sounds } from '../utils/soundEffects';

interface ResultsScreenProps {
  score: number;
  userAnswers: UserAnswer[];
  onPlayAgain: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  score,
  userAnswers,
  onPlayAgain,
}) => {
  const [showReview, setShowReview] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const evalResult = getScoreEvaluation(score);
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const incorrectCount = userAnswers.length - correctCount;

  useEffect(() => {
    // Play fanfare audio for victory / high scores
    if (evalResult.isVictory) {
      sounds.playVictory();

      // Launch canvas-confetti celebration fireworks
      try {
        const duration = 2.5 * 1000;
        const animationEnd = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899'],
          });

          if (Date.now() < animationEnd) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      } catch {
        // Safe fallback if confetti canvas fails
      }
    }
  }, [score, evalResult.isVictory]);

  const handleShare = () => {
    const text = `🏆 "Мэдлэгийн Цом" асуулт хариултын тоглоомд 100-аас ${score} оноо авлаа! Та бас мэдлэгээ сориорой.`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in zoom-in-95 duration-300">
      {/* Trophy & Final Score Banner */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 text-center relative overflow-hidden shadow-2xl mb-8">
        {/* Subtle radial glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Celebration Trophy Icon */}
        <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/10 animate-bounce">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold mb-2">
          {evalResult.badge}
        </div>

        <h1 className={`text-2xl sm:text-4xl font-display font-black mb-2 ${evalResult.colorClass}`}>
          {evalResult.title}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto mb-6 leading-relaxed">
          {evalResult.comment}
        </p>

        {/* Big Score Display */}
        <div className="flex items-baseline justify-center gap-1 mb-8">
          <span className="text-5xl sm:text-7xl font-display font-extrabold text-white tracking-tight tabular-nums">
            {score}
          </span>
          <span className="text-xl sm:text-2xl text-slate-500 font-display font-bold">
            / 100 оноо
          </span>
        </div>

        {/* Score Summary Metrics */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-lg sm:text-xl font-display font-bold text-emerald-400 tabular-nums">
              {correctCount}
            </div>
            <div className="text-[11px] text-slate-400">Зөв хариулсан</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-lg sm:text-xl font-display font-bold text-rose-400 tabular-nums">
              {incorrectCount}
            </div>
            <div className="text-[11px] text-slate-400">Буруу хариулсан</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="text-lg sm:text-xl font-display font-bold text-amber-400 tabular-nums">
              {Math.round((score / 100) * 100)}%
            </div>
            <div className="text-[11px] text-slate-400">Амжилт</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              sounds.playSelect();
              onPlayAgain();
            }}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-display font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Дахин Тоглох</span>
          </button>

          <button
            onClick={handleShare}
            className="w-full sm:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4 text-slate-400" />
            <span>{copiedShare ? 'Хуулагдлаа! 👍' : 'Үр Дүнг Хуваалцах'}</span>
          </button>
        </div>
      </div>

      {/* 10 Categories Result Breakdown Grid */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>10 Сэдвийн Гүйцэтгэл</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {userAnswers.map((item, idx) => {
            const isOk = item.isCorrect;
            return (
              <div
                key={item.question.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isOk
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-200'
                    : 'bg-rose-950/20 border-rose-900/40 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                      isOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="p-1 rounded-md bg-slate-900 shrink-0">
                    <CategoryIcon categoryId={item.question.categoryKey} className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span className="text-xs font-medium truncate">
                    {item.question.categoryName}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold tabular-nums ${isOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOk ? '+10' : '0'} оноо
                  </span>
                  {isOk ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Mode Toggle Accordion */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/70 overflow-hidden">
        <button
          onClick={() => setShowReview(!showReview)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">
              Бүх асуултууд ба тайлбаруудыг эргэн харах
            </span>
          </div>
          {showReview ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showReview && (
          <div className="p-4 sm:p-6 border-t border-slate-800/80 space-y-6 animate-in fade-in duration-200">
            {userAnswers.map((answer, index) => {
              const q = answer.question;
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                        {index + 1}-р асуулт
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {q.categoryName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {answer.isCorrect ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Зөв (+10)
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          Буруу (0)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-white">
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {q.options.map((opt) => {
                      const isCorrectChoice = opt.id === q.correctOptionId;
                      const wasUserChoice = opt.id === answer.selectedOptionId;

                      let optClass = 'bg-slate-900 border-slate-800 text-slate-400';
                      if (isCorrectChoice) {
                        optClass = 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-medium';
                      } else if (wasUserChoice && !isCorrectChoice) {
                        optClass = 'bg-rose-950/40 border-rose-500/50 text-rose-300';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${optClass}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{opt.id}.</span>
                            <span>{opt.text}</span>
                          </div>
                          {isCorrectChoice && (
                            <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0">
                              (Зөв)
                            </span>
                          )}
                          {wasUserChoice && !isCorrectChoice && (
                            <span className="text-[10px] uppercase font-bold text-rose-400 shrink-0">
                              (Таны сонголт)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-amber-300 block mb-0.5">
                        Тайлбар:
                      </span>
                      <span>{q.explanation}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
