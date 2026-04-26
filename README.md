# Otel Rezervasyon Takip (MVP)

React + Tailwind + Firebase tabanli, mobil uyumlu otel yonetim paneli.

## Teknoloji

- React (Vite)
- Tailwind CSS
- Firebase Authentication
- Firestore
- Recharts
- date-fns

## Kurulum

```bash
npm install
cp .env.example .env
```

`.env` dosyasina Firebase proje bilgilerini girin:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

## Firebase Kurulumu

### 1) Authentication

- Firebase Console > Authentication > Sign-in method
- `Email/Password` girisini aktif edin
- Authentication > Users altindan kullanicilari manuel ekleyin (otel sahibi / calisan)

### 2) Firestore

- Firestore Database olusturun
- Koleksiyonlar:
  - `reservations`
  - `transactions`
  - `users` (opsiyonel)

### 3) Firestore Security Rules

`firestore.rules` dosyasini kullanin:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reservations/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /transactions/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy etmek icin:

```bash
firebase deploy --only firestore:rules
```

## Gelistirme Komutlari

```bash
npm run dev
npm run build
npm run lint
```

## Mimari Notlar

- Tum sayfalar auth korumali route ile korunur.
- Dashboard/Reports hesaplari ortak utility dosyalarina tasinmistir:
  - `src/utils/formatters.js`
  - `src/utils/financeUtils.js`
  - `src/utils/reservationUtils.js`
- Performans icin sayfalar `React.lazy` ile code-splitting kullanir.

## Vercel Deploy

1. Projeyi GitHub'a push edin.
2. Vercel'de `New Project` ile repo baglayin.
3. Framework: `Vite` (otomatik algilanir).
4. Environment Variables kismina `.env` degiskenlerini ekleyin.
5. Deploy edin.

## Netlify Deploy

1. Projeyi GitHub'a push edin.
2. Netlify > `Add new site` > `Import an existing project`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Environment Variables kismina `.env` degiskenlerini ekleyin.
6. Deploy edin.

## Uygulama Ozeti

- Login / Logout
- Rezervasyon CRUD + tarih cakisma kontrolu
- Takvim doluluk gorunumu
- Gelir/Gider CRUD
- Dashboard canli metrikleri
- Reports grafik ve ozetleri

## Smoke Test Checklist

- [ ] Login (Email/Password)
- [ ] Logout
- [ ] Rezervasyon ekleme
- [ ] Cakisan rezervasyon engelleme
- [ ] Rezervasyon duzenleme
- [ ] Rezervasyon silme
- [ ] Takvim dolu/bos gun kontrolu
- [ ] Gelir ekleme
- [ ] Gider ekleme
- [ ] Reports hesaplamalari (rezervasyon geliri, manuel gelir, toplam gelir, gider, net)
- [ ] Mobil gorunum kontrolu
