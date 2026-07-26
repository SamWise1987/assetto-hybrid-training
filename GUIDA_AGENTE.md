# Guida operativa Assetto / RobertaFunctional — per nuovo agente

Documento di handoff. Repo: **https://github.com/SamWise1987/assetto-hybrid-training**

---

## Cos'è il progetto

**RobertaFunctional (Assetto)** è una piattaforma **cliente–trainer** per allenamento ibrido:

- **Ipertrofia domestica** (manubri, corpo libero)
- **Corsa** (martedì facile + sabato principale)
- Blocco di **8 settimane** con autoregolazione deterministica, spiegabile e annullabile
- Limitazioni cliniche cervicali/spalla documentate in `SAFETY.md`

Superfici: **web/PWA** (primaria) + shell **Capacitor iOS/Android** (stessa UI Next.js).

L’accesso richiede **account** (invito admin/trainer). IndexedDB è cache offline; Supabase è la fonte condivisa.

---

## Stato attuale (luglio 2026)

### Core app
- Login account-first (email/password, invite/recovery)
- Onboarding + consenso clinico
- Schermate atleta: **Oggi**, Calendario, Progressi, **Altro** (Avvisi, Analisi, Schede, Impostazioni)
- Flusso forza semplificato: check-in compatto → warmup saltabile → serie con stepper/prefill/rest timer → check-out
- Flusso corsa da Oggi
- Export/import JSON, CSV, cancellazione dati
- PWA + service worker (solo produzione)

### Motore
- `src/lib/autoregulation.ts` — progressione forza, readiness, deload
- `src/lib/run-calibration.ts` — calibrazione corsa
- `src/lib/training-engine.ts` — orchestrazione post-seduta

### Backend
API Next.js su Vercel + Supabase (Auth, Postgres RLS, Realtime inbox). Migrazioni `001`–`008` in `supabase/migrations/`.

### Health
- Capacitor + `@capgo/capacitor-health`
- Import allenamenti (corsa/camminata/forza) + segnali: FC a riposo, HRV, respiro, SpO₂, passi, sonno
- Persistenza locale Dexie `healthMetrics` + cloud `health_metric_samples` (migrazione `009`)
- Flusso: Watch → Apple Salute → app iOS → cloud → webapp (Progressi / Impostazioni)
- Visibili in Progressi e nella card integrazioni

### Native
- `ios/` e `android/` pronti per build su Mac (vedi `CAPACITOR.md`)
- Signing App Store / TestFlight e push APNs restano operazioni su Mac con account Apple Developer

---

## UX atleta (principi)

1. Home = **solo oggi** (una CTA dominante)
2. Logging mid-set con numeri grandi, stepper, rest timer automatico
3. Prefill dall’ultima serie dello stesso esercizio
4. Navigazione primaria corta; Analisi/Avvisi sotto **Altro**

---

## Setup rapido

```bash
npm install
cp .env.example .env.local
# Compila Supabase + ASSETTO_ADMIN_EMAILS
npm run dev
```

Node richiesto: `>=20.19` (consigliato 22+).

Comandi: `npm run typecheck`, `npm test`, `npm run lint`, `npm run test:e2e`, `npm run build`.

---

## Architettura file chiave

```text
src/components/assetto-app.tsx     Shell + tab per ruolo
src/components/screens/today/      Flusso giornaliero
src/components/screens/more.tsx    Hub secondario atleta
src/lib/native-health.ts           HealthKit / Health Connect
src/lib/health-vitals.ts           Riepilogo segnali salute
src/lib/db.ts                      Dexie v5 (include healthMetrics)
supabase/migrations/               Schema PostgreSQL 001–008
CAPACITOR.md                       Build iOS/Android
```

---

## Regole business

- Non modificare regole in `AUTOREGULATION.md` / `SAFETY.md` senza aggiornare docs e test
- Cloud e AI restano opzionali a livello di feature flag, ma il login è obbligatorio
- Non inventare set/reps da Health: solo riepiloghi e matching a scheda

---

## Backlog

1. Signing + TestFlight iOS su Mac
2. Push APNs/FCM produzione
3. Multi-blocco dopo settimana 8
4. Reminder push seduta del giorno

---

## Documentazione correlata

- `README.md` — overview tecnica
- `AUTOREGULATION.md` — regole motore
- `SAFETY.md` — limiti clinici
- `CAPACITOR.md` — Health + store
- `.env.example` — variabili ambiente
