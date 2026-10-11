import {Globe, Link2, Lock} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Visibility} from '../lib/types';

export const VISIBILITY: Record<Visibility, {label: string; hint: string; icon: ReactNode}> = {
  public: {label: 'Нийтийн', hint: 'Хүн бүр хайж, нүүр хуудсанд харж болно', icon: <Globe size={18} />},
  unlisted: {label: 'Холбоосоор', hint: 'Зөвхөн холбоос авсан хүмүүс үзнэ, жагсаалтад гарахгүй', icon: <Link2 size={18} />},
  private: {label: 'Хувийн', hint: 'Зөвхөн та үзнэ. Drive дээрх файл ч нийтэд хаагдана', icon: <Lock size={18} />},
};

export function VisibilityPicker({value, onChange, disabled}: {value: Visibility; onChange: (v: Visibility) => void; disabled?: boolean}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 font-semibold">Хэн үзэх вэ?</legend>
      {(Object.keys(VISIBILITY) as Visibility[]).map((key) => {
        const v = VISIBILITY[key];
        return (
          <label
            key={key}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
              value === key ? 'border-blue-500 bg-blue-500/10' : 'border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <input
              type="radio"
              name="visibility"
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="mt-1 accent-blue-500"
            />
            <span className="mt-0.5 text-neutral-300">{v.icon}</span>
            <span className="text-sm">
              <span className="block font-medium">{v.label}</span>
              <span className="text-neutral-400">{v.hint}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Small label shown on the owner's own unlisted/private videos. */
export function VisibilityBadge({value}: {value?: Visibility}) {
  if (!value || value === 'public') return null;
  const v = VISIBILITY[value];
  return (
    <span className="inline-flex items-center gap-1 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300 [&_svg]:h-3 [&_svg]:w-3">
      {v.icon}
      {v.label}
    </span>
  );
}
