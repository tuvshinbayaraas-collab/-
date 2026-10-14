# Batnab

Математикийн тестийн сайт: Google бүртгэлээр нэвтрэх/бүртгүүлэх, тест өгөх, дүнгээ хадгалах.

- Тест бүр 30 бодлоготой, 5 сонголттой (А–Д). Тест өгөх бүрт бодлогуудын **байр холилдоно**; хуудсаа
  дахин ачаалахад дараалал, сонгосон хариултууд, цаг хадгалагдана.
- Дуусгахад оноо, зарцуулсан хугацаа, бодлого бүрийн зөв хариулт харагдана. Нэвтэрсэн хэрэглэгчийн дүн
  Firebase-д хадгалагдаж «Миний дүнгүүд» хуудсанд, шилдэг дүн нь нүүр хуудсанд харагдана.
- Одоогоор: Тест 1.А, 1.Б, 2.А, 2.Б («Математикийн тестүүд» номын 7–14-р хуудас). Хариултын түлхүүрийг
  бодож гаргасан (номонд хариулт хавсраагүй тул).

### Шинэ тест нэмэх

1. `src/tests/test<дугаар><A|B>.tsx` файл үүсгэнэ (жишээ нь `test1A.tsx`-ийг дагана): бодлого бүр
   `q` (текст, томьёо `$…$` дотор — KaTeX), хэрэгтэй бол `fig` (зураг), `c` (5 сонголт), `a` (зөв хариултын үсэг).
2. Зураг: `src/components/figures.tsx`-ийн `Plot` (координатын хавтгай, шулуун, муруй, будсан муж) болон
   `Geo` (геометрийн зураг) — давтагддаг зургууд `src/tests/shared.tsx`-д.
3. `src/tests/index.ts`-д тестийн мэдээлэл болон ачаалагчийг нэмнэ.

## Firebase консол дээр нэг удаа хийх тохиргоо

[Firebase консол](https://console.firebase.google.com/project/rgtbn-bb94f) дээр:

1. **Authentication → Sign-in method** → **Google**-ийг идэвхжүүлнэ.
2. **Realtime Database** үүсгэсэн байх (аль хэдийн байгаа: `rgtbn-bb94f-default-rtdb`).
3. `batnab.web.app` болон өөр домэйнээс ажиллуулах бол **Authentication → Settings → Authorized domains**-д нэмнэ.

### Хянагч (админ)

Хянагчдын жагсаалт `batnab/admins.json` файлд байна (`"<Firebase User UID>": true`). Файлыг засаж push хийхэд
GitHub Actions мэдээллийн сангийн `admins` хэсгийг яг энэ файлтай ижил болгоно (файлаас хассан хүн эрхээ
алдана). UID-г [Firebase → Authentication → Users](https://console.firebase.google.com/project/rgtbn-bb94f/authentication/users)
хэсгээс харна. Сайтаас хэн ч өөрийгөө админ болгож чадахгүй (дүрмээр хаалттай).

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

`database.rules.json` — `results/<uid>`: хэрэглэгч зөвхөн өөрийн дүнгээ уншиж, шинэ дүн нэмнэ (засаж,
устгах боломжгүй; оноо нийт бодлогын тооноос хэтрэхгүй). `admins`-ийг нэвтэрсэн хэрэглэгч уншина. Бусад бүх
зүйл хаалттай.

## Локал эмулятор дээр турших

```bash
npx firebase-tools emulators:start --only auth,database
VITE_FIREBASE_EMULATORS=true npm run dev
```
