import React, { useState } from 'react';
import { X, CheckCircle, Award, Target, BookOpen, Layers, Code, FileCode2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_KEYS } from '../data/quizData';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'code'>('rules');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Хаах"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'rules'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Тоглоомын дүрэм</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'code'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Тоглоомын кодын бүтэц</span>
          </button>
        </div>

        {activeTab === 'rules' ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 id="rules-title" className="text-xl font-display font-bold text-white">
                  Тоглоомын Дүрэм ба Заавар
                </h2>
                <p className="text-xs text-slate-400">
                  Мэдлэгээ сорьж, 100 бүтэн оноо цуглуулах дүрэм
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6 text-sm text-slate-300">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Яг 10 асуулт:</span>
                  <span>Тоглоом нь тус бүр 1 асуулт бүхий 10 өөр ангиллын нийт 10 асуултаас бүрдэнэ.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <Target className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">4 сонголт, 1 зөв хариулт:</span>
                  <span>Асуулт бүр A, B, C, D гэсэн 4 хариултын хувилбартай бөгөөд зөвхөн 1 нь зөв байна.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <Award className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Онооны систем (100 оноо):</span>
                  <span>Зөв хариулт бүр 10 оноо авчирна. Дээд боломжит оноо 100 оноо байна.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <BookOpen className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Шуурхай үр дүн ба тайлбар:</span>
                  <span>Хариулт сонгосны дараа зөв эсэх нь тэр даруй харагдаж, шинэ баримт өгүүлэх сонирхолтой тайлбар дэлгэгдэнэ.</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Багтсан 10 Төрөл
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORY_KEYS.map((key, i) => {
                  const cat = CATEGORIES[key];
                  return (
                    <div
                      key={key}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300 flex items-center gap-2"
                    >
                      <span className="text-amber-400 font-mono font-bold text-[11px]">{i + 1}.</span>
                      <span className="truncate">{cat.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-white">
                  Тоглоомын Эх Кодын Бүтэц
                </h2>
                <p className="text-xs text-slate-400">
                  Google AI Studio орчинд кодоо хэрхэн үзэх ба засварлах тухай
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-amber-400">
                💡 Кодоо шууд нээж үзэх арга:
              </p>
              <p>
                1. AI Studio дэлгэцийн дээд хэсэгт байрлах <strong>«Code»</strong> (эсвэл <code className="text-cyan-300">&lt; / &gt;</code>) товч дээр дарна.
              </p>
              <p>
                2. Зүүн талын файлын мод (File tree)-ноос хүссэн файлынхаа кодыг бүрэн эхээр нь нээж үзэх, өөрчлөх, татах боломжтой.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Үндсэн файлууд:
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
                  <FileCode2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-amber-300 font-mono font-bold">src/data/quizData.ts</code>
                    <p className="text-slate-400 mt-0.5">10 ангиллын 30 асуулт, хариултын хувилбарууд болон тайлбаруудын сан.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
                  <FileCode2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-cyan-300 font-mono font-bold">src/App.tsx</code>
                    <p className="text-slate-400 mt-0.5">Тоглоомын урсгал, онооны тооцоолол, үе шат (state management).</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
                  <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-emerald-300 font-mono font-bold">src/components/QuestionCard.tsx</code>
                    <p className="text-slate-400 mt-0.5">Асуултын карт, 4 сонголт (A, B, C, D), шуурхай хариу үйлдэл ба тайлбар.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
                  <FileCode2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-purple-300 font-mono font-bold">src/components/ResultsScreen.tsx</code>
                    <p className="text-slate-400 mt-0.5">Эцсийн 100 оноо, салютын эффект, дүн шинжилгээ, асуултыг эргэн харах хэсэг.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start gap-2.5">
                  <FileCode2 className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                  <div>
                    <code className="text-pink-300 font-mono font-bold">src/utils/soundEffects.ts</code>
                    <p className="text-slate-400 mt-0.5">Web Audio API ашигласан хөгжөөнт дууны эффектүүд.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};

