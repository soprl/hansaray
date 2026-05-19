# Mobil kurulum (Apple parası en sonda)

Canlı panel: **https://hansaray.vercel.app**

## Aşama 1 — Şimdi (ücretsiz, senin terminalinde)

### 1) Firebase CLI giriş

```bash
firebase login
cd /Users/selsud/Desktop/otel
firebase use --add
```

Listeden Firebase projeni seç (Vercel `.env` içindeki `VITE_FIREBASE_PROJECT_ID` ile aynı).

### 2) Firestore kuralları + Cloud Functions

```bash
npm run mobile:firebase
```

veya:

```bash
firebase deploy --only firestore:rules,functions
```

**Functions** (europe-west1):
- `sendTestNotification` — panel test butonu
- `scheduledDailyReminders` — günlük hatırlatmalar
- `onReservationCreated` / `onReservationUpdated` — anlık bildirimler

> Blaze plan gerekebilir (zamanlanmış fonksiyonlar). Console’dan kontrol et.

### 3) Telefonda ücretsiz kullanım (push yok)

1. iPhone Safari → https://hansaray.vercel.app
2. Paylaş → **Ana Ekrana Ekle**
3. Uygulama gibi açılır; giriş ve tüm panel çalışır

### 4) Logo

Varsayılan Hansaray logosu yüklü. Kendi logonuz için:

```bash
# public/logo.png dosyanızı koyun (PNG, kare, 1024×1024 önerilir), sonra:
npm run icons
npm run build
```

Web: `git push` → Vercel. iOS: `npx cap sync ios` → Xcode.

### 5) Panel — Bildirimler

Detaylı rehber: **NOTIFICATIONS_SETUP.md**

Web’den **Bildirimler** → ayarları kaydet. Push, Aşama 2’de (TestFlight) çalışır.

---

## Aşama 2 — Apple Developer üyeliği sonrası (~99$/yıl)

### Firebase Console

1. Project Settings → Cloud Messaging → **Apple (APNs)** → `.p8` anahtarı
2. iOS uygulaması ekle → bundle id: `com.hansaray.otel`

### CocoaPods (bir kez, Mac)

```bash
brew install cocoapods
pod --version
```

### Capacitor iOS (Mac + Xcode)

`capacitor.config.json` zaten Vercel URL kullanıyor.

```bash
npm install
npm run build
npx cap add ios    # yalnızca bir kez
npx cap sync ios
npx cap open ios
```

> CocoaPods yoksa `add ios` başarısız olur; `ios` klasörü oluşmaz.

Xcode:
- Signing & Capabilities → **Push Notifications**
- Archive → **TestFlight**

### Test

1. TestFlight’tan uygulamayı kur
2. Giriş yap → bildirim izni
3. Web **Bildirimler** → kayıtlı cihazda telefon görünmeli
4. **Test bildirimi gönder**

---

## Güncelleme notları

| Değişiklik | Ne gerekir |
|------------|------------|
| Panel arayüzü (React) | `git push` → Vercel |
| Cloud Functions | `firebase deploy --only functions` |
| Native iOS (Capacitor config vb.) | Yeni Xcode build |

---

## Sorun giderme

- **Test bildirimi çalışmıyor:** Functions deploy + Blaze + cihaz listesinde token var mı?
- **Ana ekranda push yok:** Normal; iOS PWA’da push sınırlı. TestFlight uygulaması gerekir.
- **Capacitor boş ekran:** `server.url` Vercel adresiyle aynı mı, site açılıyor mu?
