import {Download} from 'lucide-react';
import {useState} from 'react';
import Switch, {SavedNote, useSavedNote} from '../../components/Switch';
import {useSettings, saveSetting, type Settings} from '../../lib/settings';
import {TESTS} from '../../tests';
import {untilReset} from '../../lib/week';
import BackupSection from './Backup';
import {download, resultsCsv, type AdminData} from './data';
import Loading from '../../components/Loading';

export default function SettingsTab({data}: {data: AdminData}) {
  const settings = useSettings();
  const [error, setError] = useState('');
  const [saved, flash] = useSavedNote();
  if (!settings) return <Loading small />;

  const change = <K extends keyof Settings>(name: K, value: Settings[K]) => {
    setError('');
    saveSetting(name, value).then(flash, (e) => setError((e as Error).message));
  };
  const row = (name: 'retakes' | 'leaderboard' | 'photos' | 'shuffleChoices' | 'games', title: string, text: string) => (
    <Switch on={settings[name]} onChange={(on) => change(name, on)} className="items-start p-5">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-neutral-400">{text}</span>
      </span>
    </Switch>
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-4">
      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="font-semibold">Туршилтын тест</h2>
        <p className="mt-1 text-sm text-neutral-400">Бүртгэлгүй хүн нэвтрэлгүйгээр өгч үзэх тест. Дүн хадгалагдахгүй, зөвхөн алдсан бодлогууд нь харагдана.</p>
        <select
          aria-label="Туршилтын тест"
          value={settings.trial}
          onChange={(e) => change('trial', e.target.value)}
          className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-blue-500 sm:w-auto"
        >
          <option value="">Туршилтгүй</option>
          {TESTS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </section>

      <section className="divide-y divide-neutral-800 overflow-hidden rounded-2xl bg-neutral-900">
        {row(
          'retakes',
          'Тестийг дахин өгөхийг зөвшөөрөх',
          'Унтраавал сурагч тест бүрийг долоо хоногт нэг л удаа өгнө. Асаалттай байсан ч анализ эхний оролдлогыг тусад нь харуулна.',
        )}
        {row(
          'leaderboard',
          'Leaderboard',
          'Сурагчид долоо хоног бүрийн эхний 3-ыг тест тус бүрээр болон нийлбэр оноогоор харна. Долоо хоног дуусахад эхний гурав нь медаль, одон авна. Сурагч өөрийн оноог тохиргооноосоо нууж болно.',
        )}
        {row(
          'photos',
          'Сурагчид өөрийн зураг тавихыг зөвшөөрөх',
          'Унтраавал сурагчид зөвхөн бэлэн дүрснээс сонгоно, тавьсан зургууд нь харагдахгүй болно. Зургууд устахгүй, буцааж асаахад дахин гарна. Нэг сурагчийн зургийг түүний хуудаснаас устгаж болно.',
        )}
        {row(
          'games',
          'Тоглоом',
          'Сурагчид Тоглоом хэсэгт таван математик тоглоом тоглож, өдөр бүр шинэ сорил хийж, ангидаа оноогоор өрсөлдөнө. 14 хоног тутам тоглоом бүрийн эхний гурав медаль авна. Хичээлийн үеэр хэрэггүй бол унтраана.',
        )}
        {row(
          'shuffleChoices',
          'Хариултын сонголтыг холих',
          'Сонголтуудын дараалал сурагч бүрт өөр болно. Ингэвэл хажуугийнхаасаа хуулах боломжгүй. Түлхүүр, дүн, анализ номын үсгээрээ хэвээр. «А ба Б», «дээрх бүгд» гэх мэт сонголттой бодлого холигдохгүй.',
        )}
      </section>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Хадгалж чадсангүй: {error}</p>}
      <SavedNote show={saved} />

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="font-semibold">Долоо хоног бүр шинээр эхлэх</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Баасан гараг бүрийн 24:00-д бүх сурагчийн дүн цэвэрлэгдэж, тестүүдийг дахин өгнө. Бүртгэл, түлхүүр,
          тохиргоо хэвээр үлдэнэ. Дараагийн цэвэрлэгээ хүртэл {untilReset()}.
        </p>
        <h3 className="mt-4 text-sm font-semibold">Энэ долоо хоногийн дүнг хадгалж авах</h3>
        <p className="mt-1 text-sm text-neutral-400">Бүх оролдлогыг Excel-д нээгддэг CSV файлаар татна. Цэвэрлэгдэхээс өмнө татаж аваарай.</p>
        <button
          onClick={() => download(`batnab-dun-${today}.csv`, resultsCsv(data))}
          disabled={!data.results.length}
          className="mt-3 flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          <Download size={16} /> CSV татах ({data.results.length})
        </button>
      </section>

      <BackupSection />

      <section className="rounded-2xl bg-neutral-900 p-5 text-sm text-neutral-400">
        <h2 className="font-semibold text-neutral-100">Анхаарах зүйл</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Сурагч нууц үгээ мартвал багш солих боломжгүй. Шинэ нэвтрэх нэрээр дахин бүртгэж, хуучныг нь устгана.</li>
          <li>Сурагч нууц үгээ Профайл хэсэгт өөрөө сольж болно.</li>
          <li>Тест дуусахад сурагч зөвхөн алдсан бодлогуудаа харна. Зөв хариултыг зөвхөн багш харна.</li>
        </ul>
      </section>
    </div>
  );
}
