# Rezervasyonlar yüklenmiyor — Firestore kuralları

Giriş çalışıyor ama rezervasyon listesi boş / **permission-denied** ise büyük ihtimalle **Firestore güvenlik kuralları** Firebase’e hiç yüklenmemiştir (test modu süresi dolmuş olabilir).

## CLI 401 hatası (“Already logged in” ama deploy olmuyor)

Bu, Firebase CLI oturumunun **süresi dolmuş / bozulmuş** olduğu anlamına gelir. `firebase login` tek başına yetmez; önce çıkış yapıp yeniden giriş gerekir:

```bash
cd /Users/selsud/Desktop/otel
firebase logout
firebase login --reauth
firebase projects:list
```

`projects:list` içinde **hansaray-5a4d6** görünüyorsa:

```bash
npm run firebase:rules
```

Hâlâ 401 alırsanız (nadir):

```bash
rm ~/.config/configstore/firebase-tools.json
firebase login
npm run firebase:rules
```

**Not:** `kalitekontrolerpa@gmail.com` hesabının Firebase Console’da bu projeye **Owner veya Editor** yetkisi olmalı. Projeyi başka bir Gmail ile açtıysanız, o hesapla `firebase login` yapın.

---

## Hızlı çözüm — Terminal (oturum düzgünse)

```bash
cd /Users/selsud/Desktop/otel
firebase logout
firebase login --reauth
npm run firebase:rules
```

Başarılı olunca: `✔ Deploy complete!`

Sonra panelde **çıkış → tekrar giriş** veya sayfayı yenileyin.

---

## Alternatif — Kuralları tarayıcıdan yapıştırın (CLI gerekmez)

CLI ile uğraşmak istemezseniz kuralları elle yükleyebilirsiniz; rezervasyonlar için aynı etkiyi yapar.

1. [Firebase Console](https://console.firebase.google.com) → proje **hansaray-5a4d6**
2. **Build** → **Firestore Database** → **Rules** sekmesi
3. Aşağıdaki kuralların **tamamını** yapıştırın (veya `firestore.rules` dosyasını açıp kopyalayın)
4. **Publish** / **Yayınla**

```javascript
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
    match /notificationSettings/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /businessTargets/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /deviceTokens/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && (docId == request.auth.uid || docId.matches('^' + request.auth.uid + '_.+'));
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

5. Uygulamada çıkış → tekrar giriş

## Kontrol

1. [Firebase Console](https://console.firebase.google.com) → proje **hansaray-5a4d6**
2. **Firestore Database** → **Data** → `reservations` koleksiyonunda kayıtlar var mı?
3. **Rules** sekmesi — kurallar şuna benzer olmalı:

```
allow read, write: if request.auth != null;
```

(rezervasyonlar ve transactions için)

## Vercel

Vercel Environment Variables içinde `VITE_FIREBASE_PROJECT_ID` değeri **hansaray-5a4d6** olmalı (local `.env` ile aynı).

## Hâlâ boş ama hata yok

- Yanlış Firebase projesine bağlısınızdır (Vercel env kontrol)
- `reservations` koleksiyonu gerçekten boştur
