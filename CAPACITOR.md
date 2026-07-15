# Capacitor — build nativa iOS / Android

RobertaFunctional resta un'app Next.js su Vercel. Capacitor aggiunge uno **shell nativo**
che espone **Apple HealthKit** e **Android Health Connect**, così corsa, camminata e riepiloghi di forza
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
              RobertaFunctional IndexedDB + Supabase
              (cache offline e sincronizzazione web)
```

## Guida passo passo (sul tuo Mac)

Tutto si fa su **un solo Mac**. Non serve Windows.

### 0. Cosa ti serve

- Mac con spazio libero (~25–40 GB consigliati)
- Account Apple (per Xcode; per pubblicare sullo Store serve anche Apple Developer a pagamento)
- Node.js 22+ (`node -v`)
- JDK 21 per Android (`java -version`); Capacitor 8 genera sorgenti Java 21 e Android Studio include un runtime compatibile
- URL dell’app su Vercel (es. `https://tuo-progetto.vercel.app`)
- iPhone e/o telefono Android fisici (HealthKit/Health Connect su simulatori sono limitati)

### 1. Installa Xcode (iOS)

1. Apri **App Store** sul Mac
2. Cerca **Xcode** → **Ottieni / Installa** (download grande, può impiegare molto)
3. Apri Xcode una volta e accetta licenza + componenti aggiuntivi
4. Nel terminale:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -runFirstLaunch
```

5. (Opzionale ma utile) Xcode → Settings → Platforms → assicurati di avere un **iOS Simulator** installato

### 2. Installa Android Studio (Android)

1. Scarica da https://developer.android.com/studio
2. Installa e apri **Android Studio**
3. Completa il setup wizard (SDK, platform tools)
   - in **Settings → Build Tools → Gradle**, seleziona il JDK integrato di Android Studio 21, non un vecchio Java 8 di sistema
4. In **Settings → Languages & Frameworks → Android SDK**:
   - SDK Platforms: almeno **Android 14 (API 34)** o superiore
   - SDK Tools: Android SDK Build-Tools, Platform-Tools, (opzionale) Emulator
5. Se usi un telefono fisico: attiva **Opzioni sviluppatore** + **Debug USB**, collega con USB

### 3. Prepara il progetto

Nel Terminale, cartella del repo:

```bash
git checkout cursor/production-ready-platform-1f7d
# oppure master, se avete già mergiato la PR Capacitor

npm install

cp .env.example .env.local
```

Apri `.env.local` e imposta (con il tuo URL reale):

```env
NEXT_PUBLIC_APP_URL=https://tuo-dominio.vercel.app
CAPACITOR_SERVER_URL=https://tuo-dominio.vercel.app
```

Poi:

```bash
npm run cap:sync
```

In Supabase aggiungi `https://tuo-dominio.vercel.app/auth/callback` alle Redirect URLs. Inviti e recupero password arrivano prima a questa pagina web; il pulsante **Apri l’app** usa `com.robertafunctional.app://auth`, già registrato nei progetti iOS e Android. L’app gestisce sia token nel fragment sia callback PKCE con `code`.

### 4. iOS — apri, firma, prova Health

```bash
npm run cap:ios
```

In Xcode:

1. Seleziona il target **App** (sinistra)
2. Tab **Signing & Capabilities**
   - Team: il tuo Apple ID / team
   - Bundle ID: `com.robertafunctional.app` (o cambialo se già usato)
   - **+ Capability** → aggiungi **HealthKit** (se non già presente)
   - verifica che **Push Notifications** sia associata al Team e al provisioning profile
   - verifica che in **Background Modes** sia attivo `Remote notifications` (la dichiarazione `Info.plist` è già presente nel repo)
3. Collega l’**iPhone** con cavo, sbloccalo, confida in “Questo computer”
4. In alto scegli il tuo iPhone (non il Simulator, per i test salute)
5. Premi **Run ▶**
6. Sul telefono: Impostazioni → permette lo sviluppatore / fiducia nell’app se richiesto
7. Nell’onboarding collega Apple Health; in seguito puoi forzare l’import da **Impostazioni → Integrazioni**

> HealthKit va testato su iPhone reale. Il Simulator non basta.

### 5. Android — apri, build, prova Health Connect

```bash
npm run cap:android
```

In Android Studio:

1. Attendi il sync Gradle
2. Collega il telefono Android (o avvia un emulatore)
3. Premi **Run ▶**
4. Sul telefono assicurati di avere **Health Connect** (su Android 14+ è di sistema; su versioni più vecchie installalo dal Play Store)
5. Nell’onboarding collega Health Connect; in seguito puoi forzare l’import da **Impostazioni → Integrazioni**
6. Garmin/Huawei: nelle loro app attiva la sincronizzazione verso Health Connect

### Push native — configurazione provider

L'app registra già i token nativi nell'endpoint `/api/push/register`, ma la consegna remota richiede anche la configurazione dei provider:

- **iOS/APNs**: abilita Push Notifications per l'App ID nel portale Apple Developer, crea una APNs key e configura `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` e `APNS_ENVIRONMENT` su Vercel;
- **Android/FCM**: crea il progetto Firebase, registra il package `com.robertafunctional.app`, aggiungi `google-services.json` in `android/app/` e configura `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL` e `FCM_PRIVATE_KEY` su Vercel;
- non inserire chiavi APNs o FCM nel bundle browser o nell'app: devono restare esclusivamente lato server.

Finché i provider non sono configurati, inbox realtime, badge e deep link interni continuano a funzionare su tutte le piattaforme.

Per controllare senza esporre i valori delle chiavi cosa manca nella configurazione locale:

```bash
npm run check:production
```

### 6. Apple Watch / Garmin / Huawei (lato utente)

- **Apple Watch**: le corse finiscono già in Apple Salute → le importa RobertaFunctional
- **Garmin**: Garmin Connect → impostazioni → sincronizza attività con Apple Salute (iPhone) o Health Connect (Android)
- **Huawei**: Huawei Health → Health Connect (Android). Su iPhone spesso serve export GPX

### 7. Se qualcosa non funziona

| Problema | Cosa controllare |
|----------|------------------|
| App bianca / non sca | `CAPACITOR_SERVER_URL` punta al deploy Vercel corretto? Hai rifatto `npm run cap:sync`? |
| Nessun permessi Salute | Signing: capability HealthKit attiva? Hai concesso i permessi nel dialog? |
| “Health non disponibile” su browser | Normale: serve l’app installata da Xcode/Android Studio, non Safari |
| 0 attività importate | Controlla che in Salute / Health Connect ci siano workout di corsa, camminata o forza negli ultimi 30 giorni |

## iOS (dettaglio già preparato nel repo)

Nel progetto sono già presenti:

- stringhe `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` in `Info.plist`
- file `App.entitlements` con HealthKit

Se Xcode chiede di riattivare la capability, aggiungila da **Signing & Capabilities**.

## Android (dettaglio già preparato nel repo)

- permesso history Health Connect nel manifest
- manifest Health Connect limitato in fase di merge a workout, distanza, calorie e frequenza cardiaca in sola lettura
- URL privacy in `strings.xml` → pagina `/privacy` del sito
- fallback privacy anche in `www/privacypolicy.html`

## Comandi utili

```bash
npm run cap:sync          # copia www + plugin nelle platform
npm run cap:ios
npm run cap:android
npx cap run android       # rebuild + install
```

## Limitazioni oneste

- **Huawei** su iOS: spesso solo GPX o sync indiretto; su Android punta a Health Connect.
- **Garmin**: non c'è SDK Capacitor “diretto” gratis affidabile; il ponte ufficiale è
  Garmin Connect → Apple Health / Health Connect.
- Il backend Next.js (login, piani, sync e inbox) resta su Vercel: web e shell Capacitor usano gli stessi endpoint.
- La build firmata App Store / Play Store va fatta da un Mac/CI con certificati — non da questo ambiente cloud Linux (iOS).

## Test senza device

- Browser: import **GPX**
- Unit test: `src/lib/native-health.test.ts` mappa workout → `RunSession`
