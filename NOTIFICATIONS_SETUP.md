# Bildirimleri canlıya alma (Hansaray)

Push bildirimleri **Firebase Cloud Functions + iOS uygulama (TestFlight)** ile çalışır. Web/PWA’da cihaz kaydı yoktur.

## 1) Firebase (senin Mac’inde)

```bash
firebase login
cd /Users/selsud/Desktop/otel
cp .firebaserc.example .firebaserc
# .firebaserc içindeki YOUR_FIREBASE_PROJECT_ID değerini Vercel .env VITE_FIREBASE_PROJECT_ID ile değiştir
npm run mobile:firebase
```

Deploy edilen fonksiyonlar (`europe-west1`):

| Fonksiyon | Görev |
|-----------|--------|
| `sendTestNotification` | Panel → Test bildirimi |
| `scheduledDailyReminders` | Günlük hatırlatmalar (saat bazlı) |
| `onReservationCreated` | Yeni rezervasyon |
| `onReservationUpdated` | Kapora / kalan ödeme |

> Zamanlanmış fonksiyonlar için Firebase **Blaze** planı gerekir.

## 2) Firebase Console

1. **Project Settings → Cloud Messaging → Apple (APNs)**  
   Apple Developer’dan `.p8` anahtarı yükle (Key ID, Team ID, Bundle ID).
2. **Bundle ID:** `com.hansaray.otel` (Xcode ile aynı olmalı).
3. iOS uygulaması Firebase projesine ekli değilse ekle.

## 3) Panel ayarları

1. https://hansaray.vercel.app → **Bildirimler**
2. Tüm seçenekleri açık bırakıp **Ayarları kaydet**
3. iOS uygulamasında giriş yap → bildirim izni ver
4. **Bildirimler** sayfasında cihaz listede görünmeli
5. **Test bildirimi gönder**

## 4) iOS uygulama (Apple Developer ~99$/yıl)

```bash
npm install
npm run icons          # logo → uygulama ikonları
npm run build
npx cap sync ios
npx cap open ios
```

Xcode:

- **Signing & Capabilities** → Push Notifications
- Uygulama ikonu: `resources/icon.png` (veya `npm run icons` sonrası sync)
- Archive → TestFlight

## 5) Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| `functions/not-found` | `npm run mobile:firebase` |
| Kayıtlı cihaz yok | TestFlight uygulaması, giriş, bildirim izni |
| Test 0 cihaz | APNs anahtarı + bundle id kontrolü |
| Web’de kayıt yok | Normal; iOS uygulama gerekir |

## Logo değiştirme

1. Logonuzu **`public/logo.png`** olarak koyun (PNG, kare, en az 512×512; 1024×1024 ideal).
   - İsterseniz `public/logo.svg` de kullanılabilir; `npm run icons` her ikisinden de üretir.
2. `npm run icons`
3. `git push` (web) + `npx cap sync ios` (mobil ikon)
