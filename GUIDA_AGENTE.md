# Guida operativa Assetto — per nuovo agente

Documento di handoff per continuare lo sviluppo. Repo: **https://github.com/SamWise1987/assetto-hybrid-training**

---

## Cos'è il progetto

**Assetto** è una PWA mobile-first, **local-first**, per allenamento ibrido:
- **Ipertrofia domestica** (manubri, corpo libero)
- **Corsa** (martedì facile + sabato principale)
- Blocco di **8 settimane** con autoregolazione deterministica, spiegabile e annullabile
- Limitazioni cliniche cervicali/spalla documentate in `SAFETY.md`

L'app funziona **senza account** in locale (IndexedDB). Cloud (Supabase) e AI (OpenAI) sono **opt-in**.

---

## Stato attuale (cosa è già fatto)

### Core app
- Onboarding + seed demo (3 settimane)
- Schermate: Oggi, Calendario, Progressi, Esercizi, Impostazioni
- Flusso forza: check-in → warmup → serie (peso/reps/RIR) → check-out → progressione automatica
- Flusso corsa: registrazione durata/RPE → calibrazione martedì → sabato
- Export/import JSON, CSV, cancellazione dati
- PWA + service worker (solo produzione)

### Motore
- `src/lib/autoregulation.ts` — progressione forza, readiness, deload
- `src/lib/run-calibration.ts` — calibrazione corsa intelligente
- `src/lib/training-engine.ts` — orchestrazione post-seduta
- `src/lib/templates.ts` — risoluzione nomi allenamento personalizzati

### Backend (Next.js API routes)
| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/health` | GET | Stato backend |
| `/api/coach` | POST | Revisione settimanale (OpenAI o fallback locale) |
| `/api/sync/push` | POST | Upload snapshot IndexedDB |
| `/api/sync/pull` | GET | Download snapshot cloud |
| `/api/me` | GET/PATCH | Profilo e ruolo utente |
| `/api/plans` | GET/POST | Lista/crea piani allenamento |
| `/api/plans/[id]` | PATCH | Modifica piano (nomi sessioni) |
| `/api/plans/[id]/assign` | POST | Assegna piano ad atleta |
| `/api/plans/assigned` | GET | Piano attivo dell'atleta |
| `/api/admin/roles` | POST | Promuovi admin/coach (solo admin) |

### Ruoli admin / coach
- Tab **Coach** visibile solo a admin/coach
- Studio piani: rinomina allenamenti, salva piano, assegna ad atleta per email
- Migration Supabase: `002_roles_and_plans.sql`

### Git
- Pushato su GitHub `master`
- Ultimo commit significativo: admin/coach plan studio + nomi personalizzabili

---

## Problema noto: Node.js

**Ambiente attuale:** Node `v20.12.1`  
**Richiesto:** Node `>=20.19` (consigliato **22 LTS**)

Sintomi con Node vecchio:
- `npm run dev` impiega ~11 min poi crasha (`TypeError: Cannot read properties of undefined`)
- ESLint fallisce (`require(...) is not a function`)
- Playwright E2E timeout (dev server non parte in 120s)

`npm run typecheck` e `npm test` (Vitest) **passano** anche con Node vecchio.

---

## Passi da eseguire (ordine consigliato)

### 1. Aggiorna Node

**Opzione A — nvm (Mac, consigliata):**
```bash
nvm install 22
nvm use 22
nvm alias default 22
node -v   # deve mostrare v22.x
```

**Opzione B — Homebrew:**
```bash
brew install node@22
brew link --overwrite node@22
node -v
```

**Poi reinstalla dipendenze:**
```bash
cd "/Users/samuelerea/Documents/Hybrid app"
rm -rf node_modules .next
npm install
```

### 2. Verifica locale

```bash
npm run typecheck
npm test
npm run lint
npm run dev          # deve partire in pochi secondi su http://localhost:3000
npx playwright install chromium
npm run test:e2e
npm run build
```

### 3. Configura `.env.local`

```bash
cp .env.example .env.local
```

Compila:

```env
# Admin (la tua email → diventi admin al primo login)
ASSETTO_ADMIN_EMAILS=tua@email.com
NEXT_PUBLIC_ADMIN_EMAILS=tua@email.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (opzionale)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

Riavvia `npm run dev` dopo ogni modifica a `.env.local`.

### 4. Setup Supabase

1. Crea progetto su https://supabase.com
2. **SQL Editor** → esegui **in ordine**:
   - `supabase/migrations/001_assetto_backend.sql`
   - `supabase/migrations/002_roles_and_plans.sql`
3. **Authentication → Providers** → abilita **Email** (magic link/OTP)
4. **Authentication → URL Configuration** → redirect consentiti:
   - `http://localhost:3000`
   - URL Vercel di produzione (quando deployi)
5. **Project Settings → API** → copia URL, anon key, service_role key in `.env.local`

### 5. Primo utilizzo nell'app

1. Apri `http://localhost:3000`
2. Onboarding → accetta disclaimer → **Crea il mio piano**
3. **Impostazioni** → inserisci email → **Invia link di accesso**
4. Clicca link nella mail → torni loggato
5. Se email è in `ASSETTO_ADMIN_EMAILS` → compare tab **Coach**
6. **Coach** → rinomina allenamenti → **Salva piano**
7. Inserisci email atleta → **Assegna piano**
8. (Opzionale) **Carica backup cloud** / **Scarica backup cloud**

### 6. OpenAI (opzionale)

1. API key su https://platform.openai.com
2. `OPENAI_API_KEY` in `.env.local` (server, più sicuro)
3. Oppure chiave in **Impostazioni** app (solo dispositivo)
4. **Impostazioni** → abilita coach AI → **Analisi settimanale**

Senza chiave: funziona il coach deterministico locale (nessuna chiamata esterna).

### 7. Deploy Vercel

1. Importa repo GitHub in Vercel
2. Framework: **Next.js**, build: `npm run build`
3. Aggiungi tutte le variabili di `.env.local` in Vercel Environment Variables
4. Deploy
5. Aggiungi URL Vercel nei redirect Supabase
6. Verifica: `https://tuo-dominio.vercel.app/api/health`

### 8. Promuovere un coach (solo admin)

```bash
curl -X POST http://localhost:3000/api/admin/roles \
  -H "Authorization: Bearer TUO_JWT_SUPABASE" \
  -H "Content-Type: application/json" \
  -d '{"email":"coach@email.com","role":"coach"}'
```

Il JWT si ottiene dopo login magic link (session Supabase nel browser).

---

## Architettura file chiave

```text
src/lib/autoregulation.ts      Regole pure forza/readiness/deload
src/lib/run-calibration.ts     Calibrazione martedì → sabato
src/lib/training-engine.ts     Post-seduta: progressione + merge prescrizioni
src/lib/templates.ts           Nomi allenamento risolti (default + custom + piano)
src/lib/plans.ts               CRUD piani locali
src/lib/roles.ts               Admin/coach/athlete
src/lib/db.ts                  Dexie schema v3, sync locale
src/lib/remote-sync.ts         Push/pull cloud + syncAccountProfile
src/lib/ai-coach.ts            Snapshot + prompt OpenAI
src/components/screens/coach.tsx   Studio piani (staff only)
src/components/screens/today/      Flusso giornaliero
supabase/migrations/           Schema PostgreSQL
e2e/essential-flows.spec.ts    Test Playwright mobile 390×844
```

### Flussi dati

**Forza:** utente inserisce peso/reps/RIR → check-out → `evaluateExerciseProgression` → `progressionDecisions` + `activePrescriptions` aggiornati.

**Corsa:** utente registra durata/RPE martedì → `calibrateSaturdayRun` → `runCalibrationDecisions` + `runPlans` sabato aggiornati.

**Piani:** coach modifica `displayName` sessioni → salva `training_plans` → assegna → atleta riceve nomi personalizzati via `getResolvedTemplates()`.

---

## Regole business (non modificare senza aggiornare docs)

- Upper body: risposta 24h obbligatoria prima di progredire
- Corsa: max +10% volume settimanale, domenica libera, no recupero aggressivo
- Sintomi neurologici → hard stop
- Dolore >3/10 → stop; dolore 3/10 → sostituzione
- Documentazione: `AUTOREGULATION.md`, `SAFETY.md`

---

## Checklist rapida

```
[ ] Node 22 installato
[ ] rm -rf node_modules .next && npm install
[ ] npm run dev ok (< 30 secondi)
[ ] .env.local compilato
[ ] Migration 001 + 002 su Supabase
[ ] Email OTP abilitata + redirect URL
[ ] Login magic link funziona
[ ] Tab Coach visibile (admin)
[ ] Rinomina allenamento + salva piano
[ ] Assegna piano ad atleta
[ ] (Opzionale) OPENAI_API_KEY + analisi settimanale
[ ] (Opzionale) Deploy Vercel + env vars
[ ] npm run lint && npm run test:e2e passano
```

---

## Migliorie suggerite (backlog per agente)

### Priorità alta
1. **Build nativa Capacitor** — Xcode/Android Studio + HealthKit/Health Connect (vedi `CAPACITOR.md`)
2. **Fix stabilità dev** — verificare con Node 22 che lint/E2E passano
3. **Pull piano assegnato** — già implementato in bootstrap app; verificare su device

### Priorità media
4. **Edit esercizi nel piano** — già in studio coach (serie/reps + run config)
5. **Undo calibrazioni corsa** — già in Progressi
6. **Garmin / Huawei** — via sync verso Apple Health / Health Connect (non SDK diretti)

### Priorità bassa
7. Strava (opzionale, evita se possibile — richiede subscription/API limits)
8. Notifiche push per seduta del giorno
9. Multi-blocco (dopo settimana 8, nuovo blocco automatico)

---

## Comandi utili

```bash
npm run dev          # sviluppo
npm run build        # build produzione
npm run typecheck    # TypeScript
npm test             # Vitest unit
npm run test:e2e     # Playwright
npm run lint         # ESLint
```

---

## Note per l'agente

- **Non committare** `.env.local` (è in `.gitignore`)
- **Non committare** senza richiesta esplicita dell'utente
- L'app è **local-first**: cloud e AI sono opt-in, mai obbligatori
- `ASSETTO_ADMIN_EMAILS` promuove ad admin al primo `/api/me` (non sovrascrive coach/admin esistenti)
- Schema IndexedDB: versione 3 (`templateCustomizations`, `trainingPlans`, `planAssignments`, `accountProfiles`)
- Test E2E: viewport mobile 390×844, onboarding usa `getByLabel` per checkbox disclaimer
- Repo path locale: `/Users/samuelerea/Documents/Hybrid app`

---

## Documentazione correlata

- `README.md` — overview tecnica
- `AUTOREGULATION.md` — regole motore
- `SAFETY.md` — limiti clinici
- `.env.example` — variabili ambiente
