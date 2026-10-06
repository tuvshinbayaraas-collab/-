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
- Сэтгэгдэл бичих, өөрийн (эсвэл өөрийн бичлэг дээрх) сэтгэгдлийг устгах
- Хайлт, сувгийн хуудас, өөрийн бичлэгийг устгах
- Үзсэн түүх, таалагдсан бичлэгүүд
- Утас, таблет, компьютерт тохирсон

## Firebase консол дээр нэг удаа хийх тохиргоо

[Firebase консол](https://console.firebase.google.com/project/rgtbn-bb94f) дээр:

1. **Authentication → Sign-in method** → **Google**-ийг идэвхжүүлнэ.
2. **Realtime Database** үүсгэсэн байх (аль хэдийн байгаа: `rgtbn-bb94f-default-rtdb`).
3. [Google Cloud Console → Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=rgtbn-bb94f)
   → **Enable** дарна.
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
npm run deploy       # build хийгээд hosting болон database rules-ийг байршуулна
```

Сайт `https://rgtbn-bb94f.web.app` хаяг дээр гарна.

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
