# Capacitor — build nativa iOS / Android

RobertaFunctional resta un'app Next.js su Vercel. Capacitor aggiunge uno **shell nativo**
che espone **Apple HealthKit** e **Android Health Connect**, così le corse da orologio
entrano senza Strava (né subscription).

## Perché Capacitor (e non Strava)

| Percorso | Costo | Apple Watch | Garmin | Huawei |
|----------|-------|-------------|--------|--------|
| Strava OAuth | spesso piano a pagamento / limiti API | sì, se sync Strava | sì | sì |
| **Capacitor + Health** | gratis (store fees a parte) | **HealthKit** | tramite sync → Health | Health Connect / GPX |
| GPX manuale | gratis | sì | sì | sì |

**Consiglio:** Capacitor è il percorso di produzione. Strava resta opzionale.

## Flusso dati

```text
Apple Watch ──► Apple Health (HealthKit)
Garmin Watch ──► Garmin Connect ──► Apple Health / Health Connect
Huawei Watch ──► Huawei Health ──► Health Connect (Android) / GPX
                         │
                         ▼
              Capacitor native shell
              (@capgo/capacitor-health)
                         │
                         ▼
              RobertaFunctional IndexedDB
              (+ calibrazione corsa martedì→sabato)
```

## Prerequisiti

- Node 22+
- App deployata su Vercel (URL pubblico)
- **iOS:** Mac + Xcode 16+, Apple Developer account, capability HealthKit
- **Android:** Android Studio, SDK 26+, Health Connect installato sul device

## Setup

```bash
cp .env.example .env.local
# Imposta l'URL di produzione usato dal WebView nativo:
# CAPACITOR_SERVER_URL=https://tuo-dominio.vercel.app
# NEXT_PUBLIC_APP_URL=https://tuo-dominio.vercel.app

npm install
npx cap sync
```

Apri i progetti nativi:

```bash
npm run cap:ios      # richiede macOS
npm run cap:android
```

## iOS (HealthKit)

1. Xcode → target **App** → **Signing & Capabilities** → aggiungi **HealthKit**
2. Verifica in `Info.plist` (già template in `ios/` dopo `cap add`):

```xml
<key>NSHealthShareUsageDescription</key>
<string>RobertaFunctional legge le tue corse da Apple Salute per aggiornare il piano.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>RobertaFunctional non scrive allenamenti nella Salute se non richiesto esplicitamente.</string>
```

3. Build su device fisico (HealthKit non è completo sul Simulator)

## Android (Health Connect)

1. Min SDK ≥ 26 (già impostato da Capacitor / plugin)
2. Declarare history se serve >30 giorni (plugin supporta `requestHistoryAccess`)
3. Privacy policy: `www/privacypolicy.html` oppure stringa
   `health_connect_privacy_policy_url` in `strings.xml` che punta a `/privacy` sul sito
4. Sul device: app **Health Connect** attiva; Garmin/Huawei devono scrivere su Health Connect

## Comandi utili

```bash
npm run cap:sync          # copia www + plugin nelle platform
npm run cap:ios
npm run cap:android
npx cap run android       # rebuild + install
```

## Limitazioni oneste

- **Huawei** su iOS: spesso solo GPX o sync indiretto; su Android punta a Health Connect.
- **Garmin**: non c’è SDK Capaciotor “diretto” gratis affidabile; il ponte ufficiale è
  Garmin Connect → Apple Health / Health Connect.
- Il backend Next.js (login, piani coach, sync) resta su Vercel: il WebView carica quell’URL.
- La build firmata App Store / Play Store va fatta da un Mac/CI con certificati — non da questo ambiente cloud Linux (iOS).

## Test senza device

- Browser: import **GPX**
- Unit test: `src/lib/native-health.test.ts` mappa workout → `RunSession`
