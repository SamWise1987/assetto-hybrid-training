# Assetto

Assetto è una PWA mobile-first, local-first e installabile per seguire un blocco di otto settimane che combina ipertrofia domestica e corsa. Ogni modifica automatica è deterministica, spiegata e annullabile. Non sono richiesti account né servizi esterni.

## Avvio

Requisiti: Node.js `>=20.19` (consigliato Node 22 o 24) e npm.

```bash
npm install
npm run dev
```

Aprire `http://localhost:3000`. Al primo accesso, accettare il disclaimer e scegliere **Crea il mio piano**. Il seed iniziale include tre settimane di dati demo.

## Comandi

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
```

Per la prima esecuzione E2E può essere necessario installare Chromium:

```bash
npx playwright install chromium
```

## Stack

- Next.js 16.2.10, App Router, React 19.2.7 e TypeScript strict;
- Tailwind CSS 4.3.2 con componenti accessibili proprietari;
- Dexie 4.4.4 / IndexedDB per la persistenza locale;
- Zustand 5 per lo stato di navigazione minimo;
- Recharts 3.9 per i grafici;
- Zod 4.4 per la validazione dei log;
- OpenAI SDK 6 per il coach settimanale opzionale;
- date-fns 4 per pianificazione settimanale corsa;
- Vitest 4.1 e Playwright 1.61;
- manifest, icone e service worker per installazione/offline.

Le versioni sono fissate nel `package.json` per build riproducibili.

## Architettura

```text
src/app/                    App Router, manifest, stile globale
src/components/             shell, UI primitives, onboarding e schermate
src/lib/types.ts            modello dati TypeScript
src/lib/program.ts          programma iniziale e seed demo
src/lib/autoregulation.ts   regole pure e deterministiche
src/lib/run-calibration.ts  calibrazione martedì → sabato
src/lib/training-engine.ts  orchestrazione post-seduta
src/lib/ai-coach.ts         snapshot e prompt coach AI
src/lib/db.ts               schema Dexie, import/export, seed
src/lib/sync-adapter.ts     sync remoto e coach adapter
src/lib/remote-sync.ts      client cloud push/pull
src/lib/supabase/           client Supabase browser/server
src/app/api/coach/route.ts  coach OpenAI opzionale
src/app/api/sync/           push/pull snapshot cloud
src/app/api/health/route.ts health backend
supabase/migrations/        schema PostgreSQL
e2e/                        flussi Playwright
public/sw.js                cache dell’app shell
```

Il motore non legge direttamente IndexedDB: riceve input tipizzati e restituisce una `ProgressionDecision`. La UI o uno strato applicativo salva poi input, regola, prescrizione precedente, output e stato di undo. Questo rende le decisioni testabili e verificabili.

## Dati e privacy

Tutti i dati risiedono nel database IndexedDB `assetto-local-v1`. Dalle impostazioni si può:

- esportare/importare il database completo in JSON;
- esportare lo storico in CSV;
- cancellare tutto con tripla conferma intenzionale;
- ripristinare il seed demo.

## Backend e Supabase (opt-in)

L'app resta **local-first**. Il backend Next.js espone:

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/health` | GET | Stato backend e servizi configurati |
| `/api/coach` | POST | Revisione settimanale (OpenAI o fallback locale) |
| `/api/sync/push` | POST | Carica snapshot IndexedDB (Bearer JWT Supabase) |
| `/api/sync/pull` | GET | Scarica ultimo snapshot cloud |

### Setup Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Esegui `supabase/migrations/001_assetto_backend.sql` nel SQL Editor.
3. Abilita **Email OTP** in Authentication → Providers.
4. Copia URL, anon key e service role key in `.env.local`:

```bash
cp .env.example .env.local
```

5. In Impostazioni app: login con magic link → **Carica backup cloud**.

RLS garantisce che ogni utente veda solo i propri snapshot.

## Ruoli admin / coach

1. Imposta la tua email in `ASSETTO_ADMIN_EMAILS` (`.env.local` e Vercel).
2. Accedi con magic link in **Impostazioni**.
3. Al primo login diventi **admin** e compare il tab **Coach**.
4. In **Studio piani** puoi:
   - rinominare ogni allenamento (es. "Forza A" → "Upper ipertrofia");
   - salvare un piano personalizzato su Supabase;
   - assegnarlo a un atleta tramite email.
5. Per promuovere un coach: `POST /api/admin/roles` con `{ "email": "...", "role": "coach" }`.

Esegui anche `supabase/migrations/002_roles_and_plans.sql` nel SQL Editor.

## Coach AI (opzionale)

1. Copia `.env.example` in `.env.local` e imposta `OPENAI_API_KEY`.
2. Oppure inserisci la chiave nelle Impostazioni (salvata solo sul dispositivo).
3. Dopo ogni settimana, usa **Analisi settimanale** per una revisione forza + corsa.

## Calibrazione automatica

- **Forza**: a ogni check-out, peso/ripetizioni/RIR alimentano `evaluateExerciseProgression` e aggiornano le prescrizioni attive.
- **Corsa**: se martedì corri meno del previsto (es. 30 invece di 50 min), il sabato viene ricalibrato in modo prudente entro il tetto settimanale +10%.

## PWA e offline

La build di produzione registra `public/sw.js`, mette in cache shell, manifest e icone e usa IndexedDB per piano e sedute già presenti. In sviluppo il service worker non viene registrato per evitare cache stale. I dati inseriti persistono dopo refresh.

## Deploy Vercel

1. Importare il repository in Vercel.
2. Framework preset: **Next.js**.
3. Build command: `npm run build`.
4. Variabili ambiente (minimo nessuna; per cloud/AI vedi `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (opzionale)
5. Pubblicare. Il service worker viene registrato solo in produzione.

## Verifica manuale consigliata

- onboarding e seed;
- check-in standard e hard stop selezionando un sintomo neurologico;
- registrazione/undo/ripetizione serie e check-out;
- risposta nelle 24 ore;
- corsa e sintomi;
- undo di una modifica automatica;
- JSON/CSV, import e cancellazione;
- viewport 390 × 844 e desktop;
- modalità offline dopo un primo caricamento in produzione.

Le regole sono documentate in [AUTOREGULATION.md](./AUTOREGULATION.md); i limiti clinici in [SAFETY.md](./SAFETY.md).
Per iOS/Android nativo (HealthKit / Health Connect, senza Strava): [CAPACITOR.md](./CAPACITOR.md).
