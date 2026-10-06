# Batnab

Бичлэг үзэх, оруулах, хуваалцах YouTube маягийн видео сайт.

- **Firebase** (үнэгүй Spark төлөвлөгөө хангалттай): нэвтрэлт, мэдээллийн сан, hosting
- **Google Drive**: бичлэгийн файлууд оруулсан хүний өөрийн Drive-ийн «Batnab» хавтсанд хадгалагдаж,
  Google Drive-ийн тоглуулагчаар тоглогдоно

## Боломжууд

- **Google бүртгэлээр нэвтрэх** — нэвтэрсэн хэрэглэгч бүр өөрийн сувагтай
- **Бичлэг оруулах** — чирж оруулах эсвэл сонгох (MP4, WebM, MOV, MKV…, 10GB хүртэл), явцыг хувиар харуулна
- Нүүр зургийг бичлэгээс автоматаар авна, эсвэл өөрийн зургийг оруулж болно
- Бичлэг тоглуулагч, үзэлтийн тоо, лайк / дислайк, хуваалцах холбоос
- **Сэтгэгдэл**: сэтгэгдэлд хариулах (reply), сэтгэгдэлд лайк дарах, засах, устгах, эможи,
  «Шилдэг / Хамгийн шинэ» эрэмбэ, холбоос автоматаар линк болох, @нэр тэмдэглэх.
  Сувгийн эзэн сэтгэгдэлд ❤️ өгөх, дээр тогтоох (pin), өөрийн бичлэг дээрх сэтгэгдлийг устгах боломжтой
- Хайлт, сувгийн хуудас, өөрийн бичлэгийг устгах
- **Shorts** — 3 минутаас богино босоо бичлэгүүд дээрээс доош гүйлгэж үздэг тусдаа хэсэгтэй
  (босоо, богино бичлэгийг оруулахад автоматаар Shorts болгохыг санал болгоно)
- **Захиалга (Subscribe)** — сувгийг захиалах, захиалагчийн тоо, захиалсан сувгуудын шинэ бичлэгийн жагсаалт
- **Үзүүлэлт (Studio)** — сүүлийн 28 хоногийн өдөр тутмын үзэлтийн график, нийт үзэлт, захиалагч, лайк,
  сэтгэгдэл, бичлэг тус бүрийн үзүүлэлтийн хүснэгт
- **Мэдэгдэл** — дээд хэсгийн хонх (уншаагүй тоотой) болон «Мэдэгдэл» хуудас: таны бичлэгт сэтгэгдэл,
  сэтгэгдэлд хариулт, @дурдалт, сэтгэгдэлд лайк / ❤️ / тогтоох, шинэ захиалагч, захиалсан сувгийн шинэ бичлэг.
  Ангилалаар шүүх, бүгдийг уншсан болгох, устгах, хөтчийн (desktop) мэдэгдэл асаах боломжтой
- Үзсэн түүх, таалагдсан бичлэгүүд
- Утас, таблет, компьютерт тохирсон

## Firebase консол дээр нэг удаа хийх тохиргоо

[Firebase консол](https://console.firebase.google.com/project/rgtbn-bb94f) дээр:

1. **Authentication → Sign-in method** → **Google**-ийг идэвхжүүлнэ.
2. **Realtime Database** үүсгэсэн байх (аль хэдийн байгаа: `rgtbn-bb94f-default-rtdb`).
3. [Google Cloud Console → Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=rgtbn-bb94f)
   → **Enable** дарна.
4. `batnab.web.app` болон өөр домэйнээс ажиллуулах бол **Authentication → Settings → Authorized domains**-д нэмнэ.

## Ажиллуулах

```bash
cd batnab
npm install
npm run dev          # http://localhost:3000
```

## Нийтлэх (Firebase Hosting)

```bash
npx firebase-tools login
npm run deploy       # build хийгээд hosting болон database rules-ийг байршуулна
```

Сайт `https://batnab.web.app` (мөн `https://rgtbn-bb94f.web.app`) хаяг дээр гарна.

## Автомат байршуулалт (GitHub Actions)

`.github/workflows/batnab-deploy.yml` нь `batnab/` өөрчлөгдөж push хийгдэх бүрт (`main` болон
`claude/youtube-site-batnab-jfgjry` branch) сайтыг build хийж Firebase руу байршуулна.
GitHub → Actions → **Deploy Batnab** → **Run workflow**-оор гараар ч ажиллуулж болно.

Нэг удаа хийх тохиргоо:
1. [Google Cloud → Service accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=rgtbn-bb94f)
   → **Create service account** (`github-deploy`), roles: **Firebase Admin**, **Service Usage Consumer**.
2. Тэр service account → **Keys** → **Add key → Create new key → JSON** → файл татагдана.
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**,
   нэр: `FIREBASE_SERVICE_ACCOUNT_RGTBN_BB94F`, утга: JSON файлын бүх агуулга.

## Аюулгүй байдлын дүрмүүд

- `database.rules.json` — хүн бүр бичлэг үзэж болно; зөвхөн нэвтэрсэн хэрэглэгч бичлэг/сэтгэгдэл/лайк нэмнэ;
  бусдын бичлэгийг засах, устгах боломжгүй; үзэлтийн тоог зөвхөн 1-ээр нэмэгдүүлнэ.
- Google Drive: апп зөвхөн `drive.file` эрх авна — өөрийн үүсгэсэн файлуудад л хандана, хэрэглэгчийн
  бусад файлыг харж чадахгүй. Бичлэг «холбоостой хүн бүр үзэх» тохиргоотой болно.

## Локал эмулятор дээр турших

```bash
npx firebase-tools emulators:start --only auth,database
VITE_FIREBASE_EMULATORS=true npm run dev
```

## Google Drive-тэй холбоотой анхаарах зүйлс

- Шинээр оруулсан бичлэгийг Google Drive боловсруулахад хэдэн минут шаардагдана.
- Нэг бичлэгийг маш олон хүн богино хугацаанд үзвэл Google Drive түр хязгаарлаж болно.
- Хэрэглэгч бичлэгээ Drive-аасаа устгавал Batnab дээр тоглохгүй болно.
