import React from 'react';
import { Volume2, VolumeX, RotateCcw, HelpCircle } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

interface HeaderProps {
  score: number;
  questionIndex: number;
  totalQuestions: number;
  isPlaying: boolean;
  onRestart: () => void;
  onOpenRules: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  score,
  questionIndex,
  totalQuestions,
  isPlaying,
  onRestart,
  onOpenRules,
}) => {
  const [soundOn, setSoundOn] = React.useState<boolean>(sounds.enabled);

  const handleToggleSound = () => {
    const nextState = sounds.toggle();
    setSoundOn(nextState);
  };

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold font-display text-lg">
            М
          </div>
          <div>
            <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-white block">
              Мэдлэгийн Цом
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation & Status */}
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          {isPlaying ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-300">
                Асуулт <span className="text-white font-semibold tabular-nums">{questionIndex + 1}</span> / {totalQuestions}
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-300">
                Оноо: <span className="text-amber-400 font-bold tabular-nums">{score}</span> / 100
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
              <span>10 Сэдэв</span>
              <span className="text-slate-700">·</span>
              <span>100 Дээд Оноо</span>
              <span className="text-slate-700">·</span>
              <span>Монгол Хэлээр</span>
            </div>
          )}
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenRules}
            title="Тоглоомын дүрэм"
            className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Дүрэм</span>
          </button>

          <button
            onClick={handleToggleSound}
            title={soundOn ? 'Дуу хаах' : 'Дуу нээх'}
            className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all flex items-center gap-1.5"
            aria-label="Дууны тохиргоо"
          >
            {soundOn ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Дуутай</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline text-slate-500">Дуугүй</span>
              </>
            )}
          </button>

          {isPlaying && (
            <button
              onClick={onRestart}
              title="Шинээр эхлэх"
              className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 rounded-lg transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Шинээр эхлэх</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
