import {BarChart3, Bot, CodeXml, Crown, Flame, Lightbulb, MonitorPlay, Palette} from 'lucide-react';
import type {ReactNode} from 'react';

/** Who made what. Add a line here to credit someone else. */
const CREDITS: {role: string; en: string; name: string; icon: ReactNode}[] = [
  {role: 'Бүтээгч', en: 'Creator', name: 'Баттүшиг', icon: <Crown size={18} />},
  {role: 'Санаа', en: 'Idea', name: 'Баттүшиг', icon: <Lightbulb size={18} />},
  {role: 'Программист', en: 'Coder', name: 'Баттүшиг', icon: <CodeXml size={18} />},
  {role: 'Firebase, өгөгдлийн сан', en: 'Firebase', name: 'Баттүшиг', icon: <Flame size={18} />},
  {role: 'Дата анализ', en: 'Data analysis', name: 'Баттүшиг', icon: <BarChart3 size={18} />},
  {role: 'Бот тестер', en: 'Bot tester', name: 'Баттүшиг', icon: <Bot size={18} />},
  {role: 'Демо бүтээсэн', en: 'Demo', name: 'Баттүшиг', icon: <MonitorPlay size={18} />},
  {role: 'Дизайн', en: 'Design', name: 'Баттүшиг', icon: <Palette size={18} />},
];

export default function Credits() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="flex flex-col items-center rounded-2xl bg-neutral-900 px-5 py-8 text-center">
        <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
        <h1 className="mt-4 text-2xl font-bold">Бүтээгчид</h1>
        <p className="mt-1 text-sm text-neutral-400">Batnab — ангийн математикийн тест, шалгалтын сайт</p>
        <p className="mt-5 text-xs font-medium uppercase tracking-wider text-neutral-500">Бүтээсэн</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-blue-300">Баттүшиг</p>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {CREDITS.map((c) => (
          <li key={c.en} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{c.en}</p>
              <p className="text-sm text-neutral-300">{c.role}</p>
            </div>
            <p className="shrink-0 font-semibold">{c.name}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-xs text-neutral-500">© {new Date().getFullYear()} Batnab</p>
    </div>
  );
}
