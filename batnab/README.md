# Batnab

Шинэ сайтын суурь: Google бүртгэлээр нэвтрэх/бүртгүүлэх, Firebase (нэвтрэлт, мэдээллийн сан, hosting),
автомат байршуулалт. Сайтын агуулга удахгүй нэмэгдэнэ.

Өмнөх YouTube маягийн Batnab бүхэлдээ git-ийн `a5f4b32` commit-д хадгалагдсан.

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

`database.rules.json` — одоогоор зөвхөн `admins` жагсаалтыг нэвтэрсэн хэрэглэгч уншина; бусад бүх зүйл
хаалттай. Шинэ хэсэг нэмэх бүрт тухайн хэсгийн дүрмийг энд нэмнэ.

## Локал эмулятор дээр турших

```bash
npx firebase-tools emulators:start --only auth,database
VITE_FIREBASE_EMULATORS=true npm run dev
```
