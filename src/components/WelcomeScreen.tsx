import React from 'react';
import { Play, Sparkles, Clock, ShieldCheck, Zap } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '../data/quizData';
import { CategoryIcon } from './CategoryIcon';
import { sounds } from '../utils/soundEffects';

interface WelcomeScreenProps {
  onStart: (timedMode: boolean) => void;
  timedMode: boolean;
  setTimedMode: (enabled: boolean) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  timedMode,
  setTimedMode,
}) => {
  const handleStart = () => {
    sounds.playSelect();
    onStart(timedMode);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-300">
      {/* Hero Badge */}
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Монгол Хэл Дээрх Интерактив Асуулт Хариулт</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-tight text-white mb-4 leading-tight">
          Мэдлэгийн <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">Цом</span>
        </h1>

        <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          10 төрлийн сонирхолтой сэдвээр өөрийн мэдлэг, сэтгэхүйгээ сорьж, нийт 100 оноо цуглуулах оюуны сорилтод тавтай морилно уу!
        </p>
      </div>

      {/* Rules & Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-2xl sm:text-3xl font-display font-bold text-amber-400 mb-1 tabular-nums">
            10
          </div>
          <div className="text-xs font-semibold text-white uppercase tracking-wider mb-0.5">
            Асуулт
          </div>
          <div className="text-xs text-slate-400">
            10 өөр салбар тус бүрээс нэг онцгой асуулт
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400 mb-1 tabular-nums">
            100
          </div>
          <div className="text-xs font-semibold text-white uppercase tracking-wider mb-0.5">
            Дээд Оноо
          </div>
          <div className="text-xs text-slate-400">
            Зөв хариулт бүрд 10 оноо олгоно
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="text-2xl sm:text-3xl font-display font-bold text-cyan-400 mb-1 flex items-center gap-1">
            <Zap className="w-6 h-6 text-cyan-400" />
            <span>Шуурхай</span>
          </div>
          <div className="text-xs font-semibold text-white uppercase tracking-wider mb-0.5">
            Тайлбар ба Баримт
          </div>
          <div className="text-xs text-slate-400">
            Хариулт бүрийн дараа сонирхолтой шинэ мэдлэг
          </div>
        </div>
      </div>

      {/* 10 Categories Grid */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Тоглоомонд багтсан 10 ангилал
          </span>
          <span className="text-xs text-slate-500">1 асуулт / сэдэв</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {CATEGORY_KEYS.map((key, idx) => {
            const cat = CATEGORIES[key];
            return (
              <div
                key={key}
                className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 hover:border-slate-700 transition-all text-left group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded-lg ${cat.accentBg}`}>
                    <CategoryIcon categoryId={key} className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    0{idx + 1}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                  {cat.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode Selection & Start Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Цагийн Тохиргоо</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimedMode(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                !timedMode
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Тайван (Хязгааргүй)
            </button>
            <button
              onClick={() => setTimedMode(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                timedMode
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Сорилт (25 секунд)
            </button>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-display font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Тоглоом Эхлүүлэх</span>
        </button>
      </div>

      {/* Helpful keyboard hint */}
      <div className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-slate-600" />
        <span>Гар дээрх A, B, C, D эсвэл 1, 2, 3, 4 товчоор шууд хариулж болно</span>
      </div>
    </div>
  );
};
