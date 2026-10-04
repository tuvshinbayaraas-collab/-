import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Check, X, ArrowRight, Lightbulb, Flame, Clock } from 'lucide-react';
import { Question, OptionId } from '../types/quiz';
import { CATEGORIES } from '../data/quizData';
import { CategoryIcon } from './CategoryIcon';
import { sounds } from '../utils/soundEffects';

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  score: number;
  streak: number;
  timedMode: boolean;
  onAnswerSelected: (selectedId: OptionId, isCorrect: boolean) => void;
  onNextQuestion: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionIndex,
  totalQuestions,
  score,
  streak,
  timedMode,
  onAnswerSelected,
  onNextQuestion,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<OptionId | null>(null);
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(25);
  const [scoreGainedAnim, setScoreGainedAnim] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const categoryInfo = CATEGORIES[question.categoryKey] || {
    name: question.categoryName,
    accentBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  // Reset local question state when question index changes
  useEffect(() => {
    setSelectedOptionId(null);
    setHasAnswered(false);
    setTimeLeft(25);
    setScoreGainedAnim(false);
  }, [questionIndex]);

  // Handle Answer selection
  const handleSelectOption = useCallback(
    (optionId: OptionId) => {
      if (hasAnswered) return;

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setSelectedOptionId(optionId);
      setHasAnswered(true);

      const isCorrect = optionId === question.correctOptionId;

      if (isCorrect) {
        sounds.playCorrect();
        setScoreGainedAnim(true);
        if (streak + 1 >= 3) {
          setTimeout(() => sounds.playStreak(), 280);
        }
      } else {
        sounds.playIncorrect();
      }

      onAnswerSelected(optionId, isCorrect);
    },
    [hasAnswered, question.correctOptionId, streak, onAnswerSelected]
  );

  // Timer countdown if timed mode is enabled
  useEffect(() => {
    if (!timedMode || hasAnswered) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time expired: auto mark as unanswered (timeout)
          sounds.playIncorrect();
          setHasAnswered(true);
          onAnswerSelected('A', false); // timeout treated as wrong
          return 0;
        }
        if (prev <= 6) {
          sounds.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timedMode, hasAnswered, onAnswerSelected]);

  // Keyboard shortcut listener (A, B, C, D / 1, 2, 3, 4 / Enter / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!hasAnswered) {
        const key = e.key.toUpperCase();
        if (key === 'A' || key === '1') {
          e.preventDefault();
          handleSelectOption('A');
        } else if (key === 'B' || key === '2') {
          e.preventDefault();
          handleSelectOption('B');
        } else if (key === 'C' || key === '3') {
          e.preventDefault();
          handleSelectOption('C');
        } else if (key === 'D' || key === '4') {
          e.preventDefault();
          handleSelectOption('D');
        }
      } else {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playSelect();
          onNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswered, handleSelectOption, onNextQuestion]);

  const progressPercent = ((questionIndex + 1) / totalQuestions) * 100;
  const isCorrectAnswer = selectedOptionId === question.correctOptionId;
  const isLastQuestion = questionIndex === totalQuestions - 1;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:py-8 animate-in fade-in duration-200">
      {/* Top HUD: Category, Question Counter, Score, Streak */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          {/* Category Tag */}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${categoryInfo.accentBg}`}>
              <CategoryIcon categoryId={question.categoryKey} className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              {question.categoryName}
            </span>
          </div>

          {/* Right Metrics: Streak & Score */}
          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold animate-bounce">
                <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                <span>{streak} дараалсан зөв!</span>
              </div>
            )}

            <div className="relative flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
              <span className="text-slate-400">Оноо:</span>
              <span className="font-bold text-amber-400 tabular-nums text-sm">
                {score}
              </span>
              <span className="text-slate-600">/ 100</span>

              {scoreGainedAnim && (
                <span className="absolute -top-3 right-0 text-emerald-400 font-bold text-xs animate-ping">
                  +10
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar & Counter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>
              Асуулт <span className="text-white font-bold">{questionIndex + 1}</span> / {totalQuestions}
            </span>
            <span className="text-slate-500">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Optional Timed Bar */}
        {timedMode && !hasAnswered && (
          <div className="flex items-center gap-2 pt-1">
            <Clock className={`w-3.5 h-3.5 ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
            <div className="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  timeLeft <= 5 ? 'bg-rose-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${(timeLeft / 25) * 100}%` }}
              />
            </div>
            <span
              className={`text-xs font-mono font-bold tabular-nums ${
                timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-slate-400'
              }`}
            >
              {timeLeft}с
            </span>
          </div>
        )}
      </div>

      {/* Main Question Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl mb-6">
        <h2 className="text-lg sm:text-2xl font-semibold text-white leading-relaxed mb-6">
          {question.question}
        </h2>

        {/* 4 Choices: A, B, C, D */}
        <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Хариултын хувилбарууд">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isThisCorrect = option.id === question.correctOptionId;

            let buttonStyles =
              'border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/80 hover:border-slate-700 text-slate-200';
            let badgeStyles = 'bg-slate-800 text-slate-300 border-slate-700';

            if (hasAnswered) {
              if (isThisCorrect) {
                // Correct answer is highlighted in vibrant green
                buttonStyles =
                  'border-emerald-500/80 bg-emerald-950/40 text-emerald-200 shadow-lg shadow-emerald-950/50';
                badgeStyles = 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold';
              } else if (isSelected && !isThisCorrect) {
                // Chosen wrong answer is marked in red
                buttonStyles =
                  'border-rose-500/80 bg-rose-950/40 text-rose-200 shadow-lg shadow-rose-950/50';
                badgeStyles = 'bg-rose-500 text-white border-rose-400 font-bold';
              } else {
                // Other non-selected incorrect choices dimmed
                buttonStyles = 'border-slate-800/40 bg-slate-950/30 text-slate-500 opacity-60';
                badgeStyles = 'bg-slate-800/50 text-slate-500 border-slate-800';
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={hasAnswered}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between gap-4 group cursor-pointer ${buttonStyles} ${
                  !hasAnswered ? 'active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-amber-400' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 border transition-all ${badgeStyles}`}
                  >
                    {option.id}
                  </div>
                  <span className="text-sm sm:text-base font-medium break-words">
                    {option.text}
                  </span>
                </div>

                {hasAnswered && (
                  <div className="shrink-0">
                    {isThisCorrect ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center">
                        <X className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Immediate Feedback & Educational Explanation Panel */}
      {hasAnswered && (
        <div className="space-y-4 animate-in slide-in-from-bottom-3 duration-300">
          <div
            className={`p-5 rounded-2xl border ${
              isCorrectAnswer
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-display font-bold text-base mb-2">
              {isCorrectAnswer ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-emerald-400">Зөв хариулт! +10 оноо</span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                    <X className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-rose-400">
                    Буруу хариуллаа! Зөв хариулт: {question.correctOptionId}
                  </span>
                </>
              )}
            </div>

            {/* Explanation / Fun fact */}
            <div className="flex items-start gap-2.5 pt-2 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300 block mb-0.5">
                  Танин мэдэхүйн баримт:
                </span>
                <span>{question.explanation}</span>
              </div>
            </div>
          </div>

          {/* Next Action Button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                sounds.playSelect();
                onNextQuestion();
              }}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-display font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{isLastQuestion ? 'Үр Дүнг Харах' : 'Дараагийн Асуулт'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
