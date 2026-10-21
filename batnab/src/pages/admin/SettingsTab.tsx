import {Download} from 'lucide-react';
import {useState} from 'react';
import Switch, {SavedNote, useSavedNote} from '../../components/Switch';
import {useSettings, saveSetting, type Settings} from '../../lib/settings';
import {TESTS} from '../../tests';
import {untilReset} from '../../lib/week';
import {download, resultsCsv, type AdminData} from './data';

export default function SettingsTab({data}: {data: AdminData}) {
  const settings = useSettings();
  const [error, setError] = useState('');
  const [saved, flash] = useSavedNote();
  if (!settings) return <p className="py-10 text-center text-neutral-400">Ачаалж байна…</p>;

  const change = <K extends keyof Settings>(name: K, value: Settings[K]) => {
    setError('');
    saveSetting(name, value).then(flash, (e) => setError((e as Error).message));
  };
  const row = (name: 'retakes' | 'leaderboard' | 'photos', title: string, text: string) => (
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
        <p className="mt-1 text-sm text-neutral-400">Бүртгэлгүй хүн нэвтрэхгүйгээр өгч үзэх тест. Дүн нь хадгалагдахгүй, дуусгахад аль бодлого дээр алдсан нь харагдана.</p>
        <select
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
          'Унтраавал сурагч тест бүрийг долоо хоногт нэг л удаа өгнө. Асаалттай үед ч анализ эхний оролдлогыг тусад нь харуулдаг.',
        )}
        {row(
          'leaderboard',
          'Leaderboard',
          'Сурагчид долоо хоног бүрийн эхний 3-ыг (тест бүрээр болон хамгийн өндөр оноогоор) харж, долоо хоногийн эцэст эхний 3 нь медаль авна. Сурагч өөрийн оноог тохиргооноосоо нууж болно. Оноог сурагчийн хадгалсан хариулт, түлхүүрээс энэ самбар дахин тооцоолж засдаг.',
        )}
        {row(
          'photos',
          'Сурагчид өөрийн зураг тавихыг зөвшөөрөх',
          'Унтраавал сурагчид зөвхөн бэлэн дүрснээс (амьтан г.м.) сонгоно, тавьсан зургууд нь сайт дээр харагдахгүй болно. Зургууд устахгүй: буцааж асаахад дахин харагдана. Нэг сурагчийн зургийг түүний хуудаснаас устгаж болно.',
        )}
      </section>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">Хадгалж чадсангүй: {error}</p>}
      <SavedNote show={saved} />

      <section className="rounded-2xl bg-neutral-900 p-5">
        <h2 className="font-semibold">Долоо хоног бүр шинээр эхлэх</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Баасан гараг бүрийн 24:00-д (Улаанбаатарын цагаар) бүх сурагчийн дүн цэвэрлэгдэж, тестүүдийг шинээр өгнө. Бүртгэл, түлхүүр,
          тохиргоо хэвээр үлдэнэ. Дараагийн цэвэрлэгээ: {untilReset()} дараа.
        </p>
        <h3 className="mt-4 text-sm font-semibold">Энэ долоо хоногийн дүнг хадгалж авах</h3>
        <p className="mt-1 text-sm text-neutral-400">Бүх оролдлого Excel-д нээгдэх CSV файлаар. Цэвэрлэгдэхээс өмнө татаж аваарай.</p>
        <button
          onClick={() => download(`batnab-dun-${today}.csv`, resultsCsv(data))}
          disabled={!data.results.length}
          className="mt-3 flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-black hover:bg-blue-400 disabled:opacity-50"
        >
          <Download size={16} /> CSV татах ({data.results.length})
        </button>
      </section>

      <section className="rounded-2xl bg-neutral-900 p-5 text-sm text-neutral-400">
        <h2 className="font-semibold text-neutral-100">Анхаарах зүйл</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Сурагч нууц үгээ мартвал багш солих боломжгүй. Шинэ нэвтрэх нэрээр дахин бүртгэж, хуучныг нь устгана.</li>
          <li>Сурагч нууц үгээ “Профайл” хэсэгт өөрөө сольж болно.</li>
          <li>Сурагч тестээ дуусгахад аль бодлого дээр алдсанаа л харна, зөв хариулт нь харагдахгүй. Зөв хариултыг зөвхөн багш харна.</li>
        </ul>
      </section>
    </div>
  );
}
