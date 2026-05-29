# Bildirimleri canlıya alma (Hansaray)

Push bildirimleri **Firebase Cloud Functions** ile gider. Cihaz kaydı **web tarayıcı** (Chrome, Safari) veya **iOS uygulama (TestFlight)** üzerinden yapılır.

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
4. **Web Push (VAPID):** Project Settings → **Cloud Messaging** → **Web Push certificates** → anahtar çifti oluştur. **Key pair** satırındaki **uzun** anahtarı kopyalayın (genelde `B` ile başlar, ~88 karakter). Kısa veya `ktGl…` gibi değerler **çalışmaz**.

## 3) Vercel ortam değişkeni (web)

Panelde ve yerelde `.env` içinde:

```env
VITE_FIREBASE_VAPID_KEY=BNx...  # Key pair (uzun public key). İsteğe bağlı; Console’da anahtar varsa boş bırakılabilir.
```

Deploy sonrası `public/firebase-messaging-sw.js` build sırasında otomatik üretilir (`vite.config.js`).

> Web push yalnızca **HTTPS** üzerinde çalışır (Vercel uygun). Safari 16.4+ ve güncel Chrome destekler.

## 4) Panel ayarları

1. https://hansaray.vercel.app → **Bildirimler**
2. Tüm seçenekleri açık bırakıp **Ayarları kaydet**
3. **Web:** giriş yap → tarayıcı bildirim iznini ver → **Bu cihazı kaydet** (veya sayfa açılınca otomatik kayıt)
4. **iOS:** TestFlight uygulamasında giriş → bildirim izni
5. **Bildirimler** sayfasında cihaz listede görünmeli (`web` veya `ios`)
6. **Test bildirimi gönder**

## 5) iOS uygulama (Apple Developer ~99$/yıl)

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

## 6) Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| `functions/not-found` | `npm run mobile:firebase` |
| Kayıtlı cihaz yok | Giriş + bildirim izni + **Bu cihazı kaydet** |
| Web kayıt olmuyor | `VITE_FIREBASE_VAPID_KEY` Vercel’de tanımlı mı? HTTPS mi? |
| Test 0 cihaz | APNs (iOS) veya VAPID (web) + Functions deploy |
| Safari’de yok | macOS/iOS Safari 16.4+; izin site ayarlarından |

## Logo değiştirme

1. Logonuzu **`public/logo.png`** olarak koyun (PNG, kare, en az 512×512; 1024×1024 ideal).
   - İsterseniz `public/logo.svg` de kullanılabilir; `npm run icons` her ikisinden de üretir.
2. `npm run icons`
3. `git push` (web) + `npx cap sync ios` (mobil ikon)
