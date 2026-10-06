# Batnab

Бичлэг үзэх, оруулах, хуваалцах YouTube маягийн видео сайт. Firebase дээр ажиллана
(Authentication, Realtime Database, Storage, Hosting).

## Боломжууд

- **Google бүртгэлээр нэвтрэх** — нэвтэрсэн хэрэглэгч бүр өөрийн сувагтай
- **Бичлэг оруулах** — чирж оруулах эсвэл сонгох (MP4, WebM, MOV, MKV…, 500MB хүртэл), явцыг хувиар харуулна
- Нүүр зургийг бичлэгээс автоматаар авна, эсвэл өөрийн зургийг оруулж болно
- Бичлэг тоглуулагч, үзэлтийн тоо, лайк / дислайк, хуваалцах холбоос
- Сэтгэгдэл бичих, өөрийн (эсвэл өөрийн бичлэг дээрх) сэтгэгдлийг устгах
- Хайлт, сувгийн хуудас, өөрийн бичлэгийг устгах
- Үзсэн түүх, таалагдсан бичлэгүүд
- Утас, таблет, компьютерт тохирсон

## Firebase консол дээр нэг удаа хийх тохиргоо

[Firebase консол](https://console.firebase.google.com/project/rgtbn-bb94f) дээр:

1. **Authentication → Sign-in method** → **Google**-ийг идэвхжүүлнэ.
2. **Realtime Database** үүсгэсэн байх (аль хэдийн байгаа: `rgtbn-bb94f-default-rtdb`).
3. **Storage** → *Get started*. Анхаар: шинэ Storage bucket ашиглахад төслийг
   **Blaze (pay-as-you-go)** төлөвлөгөөнд шилжүүлэх шаардлагатай. Үнэгүй хэмжээ нь 5GB хадгалалт,
   өдөрт 100GB татан авалт.
4. Өөр домэйнээс ажиллуулах бол **Authentication → Settings → Authorized domains**-д нэмнэ.

## Ажиллуулах

```bash
cd batnab
npm install
npm run dev          # http://localhost:3000
```

## Нийтлэх (Firebase Hosting)

```bash
npx firebase-tools login
npm run deploy       # build хийгээд hosting, database rules, storage rules-ийг байршуулна
```

Сайт `https://rgtbn-bb94f.web.app` хаяг дээр гарна.

## Аюулгүй байдлын дүрмүүд

- `database.rules.json` — хүн бүр бичлэг үзэж болно; зөвхөн нэвтэрсэн хэрэглэгч бичлэг/сэтгэгдэл/лайк нэмнэ;
  бусдын бичлэгийг засах, устгах боломжгүй; үзэлтийн тоог зөвхөн 1-ээр нэмэгдүүлнэ.
- `storage.rules` — хэрэглэгч зөвхөн `videos/<өөрийн uid>/...` хавтсанд бичлэг (500MB хүртэл) болон
  нүүр зураг (5MB хүртэл) оруулна.

## Локал эмулятор дээр турших

```bash
npx firebase-tools emulators:start --only auth,database,storage
VITE_FIREBASE_EMULATORS=true npm run dev
```
