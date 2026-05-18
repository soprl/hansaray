# Mobil (iOS) ve bildirim kurulumu

Web uygulaması Vercel'de çalışmaya devam eder. iOS uygulaması aynı arayüzü Vercel URL'sinden açar.

## 1. Firestore kuralları

```bash
firebase deploy --only firestore:rules
```

## 2. Cloud Functions (test + günlük hatırlatma)

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

- `sendTestNotification` — paneldeki "Test bildirimi gönder" butonu
- `scheduledDailyReminders` — zamanlanmış hatırlatmalar (giriş/çıkış, ödeme, özetler)
- `onReservationCreated` — yeni rezervasyon anlık bildirimi
- `onReservationUpdated` — kapora alındı + kalan tutar bildirimi

## 3. Firebase Console

1. Project Settings > Cloud Messaging > **Apple app (APNs)** — `.p8` anahtarı yükleyin
2. iOS uygulaması ekleyin (bundle id: `com.hansaray.otel`)

## 4. Capacitor iOS (Mac + Xcode)

`capacitor.config.json` içinde `server.url` değerini **canlı Vercel adresiniz** ile değiştirin.

```bash
npm install
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/push-notifications
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode'da Push Notifications capability ekleyin, Archive > TestFlight.

## 5. Panel

- Menü: **Bildirimler** (`/bildirimler`)
- Ayarları kaydedin
- iOS uygulamasında giriş yapın → bildirim izni
- Kayıtlı cihazlar listesinde telefon görünmeli
- **Test bildirimi gönder** ile deneyin

## Notlar

- Web'de arayüz ve ayarlar çalışır; push sadece kayıtlı iOS cihazlara gider.
- Kod değişikliği: `git push` → Vercel deploy → mobilde aynı arayüz (yeni iOS build gerekmez).
