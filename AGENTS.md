# Repository Guidelines

## Project Overview
Sınıf Test: static teacher-focused web app for grades 1–4 (Matematik/Geometri/Türkçe). Builds/applies topic-tagged multiple-choice tests, stores results in browser `localStorage`, emits deficiency reports (rule-based default, optional OpenAI-compatible AI). Cloud (Supabase + Vercel serverless `api/`) is opt-in; local mode works with no server.

## Architecture & Data Flow
SPA composition: `src/main.jsx` → `src/App.jsx` (`AuthProvider` → `AuthenticatedApp` → `StoreProvider` → `AppShell` + hash `Router`).
- `StoreProvider` (`src/state/store.jsx`) is the sole global store. Hash router (`go()`/`parseHash()`), `db {students,tests,bank,attempts,aiReports}`, `settings {threshold, ai:{provider,baseUrl,apiKey,model}}`, `cloudLoading/cloudError`.
- `domain/` holds pure logic (no state/cloud imports); `cloud/` adapts Supabase snake_case rows to camelCase; `src/ui/screens/*` are thin callers of `useStore()`/`useAuth()`.
- Dual-write: cloud mode (`cloudUser?.id && isSupabaseConfigured`) writes Supabase first then patches local `db` + `saveDB` cache; local mode uses per-user keys `learn_app_db_v1_<userId>`, seeded by `buildSeed()`.
- Exam flow: `ExamScreen` collects `answers {qid→index}` + `timeByQid` → `actions.addAttempt` → `scoreAttempt()` → attempt row → `Results`/`Reports` read `aggregate*`/`buildRuleReport` or `createAIClient(settings.ai).generateReport(ctx)` → `saveAiReport`.
- Auth: `AuthProvider` wraps `supabase.auth` + `profiles` role lookup (`role==='admin'`); student role short-circuits to `StudentPortalScreen`. Routes are Turkish hashes: `#/`, `#/ogrenciler`, `#/siniflar`, `#/atamalar`, `#/testler`, `#/banka`, `#/sinav/:id`, `#/sonuclar`, `#/raporlar`, `#/ayarlar`, `#/admin`.

## Key Directories
- `src/state/store.jsx` — single Context store, routing, all CRUD + AI-report actions.
- `src/auth/` — `AuthProvider.jsx`, `authErrors.js` (TR message mapping).
- `src/domain/` — `model.js` (constants/validation/normalize), `scoring.js`, `report.js` (rule fallback), `studentAuth.js` (code→synthetic email).
- `src/db/storage.js` — `localStorage` DB (`learn_app_db_v1`), seed/backup, scoped keys.
- `src/cloud/` — `teacherData.js` (fetch + CRUD), `students.js`, `classes.js`, `assignments.js`, `attempts.js`, `tests.js`, `adminData.js`.
- `src/ai/` — `client.js` (`createAIClient`, `PROVIDERS`), `prompts.js`.
- `src/ui/screens/` (17 files) + `src/ui/components/` (8 files: `Modal`, `QuestionForm`, `JsonImportDialog`, `Review*`, `ScoreBar`, `Badges`).
- `src/lib/supabase.js` — client singleton, `isSupabaseConfigured`, `requireSupabase()`.
- `src/data/seedQuestions.js` — first-run bank (≥60 Qs, 12 tests).
- `api/ai/report.js`, `api/students/provision.js` — Vercel serverless (OpenRouter proxy, student provisioning).
- `supabase/migrations/` — 5 SQL migrations (run in date order via SQL Editor).
- `scripts/verify.mjs` — only repo script / only test.

## Development Commands
```bash
npm install          # Node 18+, npm only
npm run dev          # vite → http://localhost:5173 (frontend only)
npm run build        # vite build → dist/ (Vercel: buildCommand + outputDirectory dist)
npm run build:single # vite build --mode single → dist-single/index.html (single-file Blogger embed)
npm run preview      # serve dist/ locally
npm test             # node scripts/verify.mjs
vercel dev           # local dev with serverless api/ (not an npm script)
```
No lint/format/typecheck scripts. Deploy `dist/` to Netlify Drop / GitHub Pages / Vercel; hash router needs no server.

## Code Conventions & Common Patterns
- JS/JSX only, ESM (`"type": "module"`). camelCase (`correctIndex`, `addBankQuestion`); snake_case only at Supabase boundary, mapped in `cloud/teacherData.js` (`correct_index→correctIndex`). UID prefixes `s_/t_/q_/a_/r_`; versioned keys `learn_app_db_v1/settings_v1/meta_v1`; TR UI strings + TR route slugs.
- Domain pure: `validateQuestion/validateTest → string[]`, `normalizeTest` (questions inherit test grade/subject), `scoreAttempt(test, answers, {timeByQid}) → {details,correctCount,scorePercent,totalSeconds,topicStats}`. Constants: `GRADES=[1..4]`, `DEFAULT_THRESHOLD=60`, `MIN_QUESTIONS_FOR_TOPIC=3`, deficiency `total>=3 && percent<60`, slow badge `avgSeconds>90`.
- Async: `async/await`, `Promise.all` for cloud reads, `let active/mounted` effect guards, raw `fetch`; no router/fetch lib. DI: no container — `useAuth()` + `useStore()` Contexts, Supabase module singleton, AI via factory `createAIClient(settings.ai)` at call site.
- Errors: AI returns `{ok:true,text}|{ok:false,error}`; cloud/storage `throw Error(TR message)`; screens `try{…}catch(e){setError(e.message)}finally{setLoading(false)}`; store surfaces `cloudError` full-screen with retry; missing Supabase → `requireSupabase()` throws.
- Styling: single hand-written `src/styles.css` (~30KB), no Tailwind. Images: `fileToImageData` (jpeg/png/gif/webp ≤800KB) as `data:` URL or `https://` in `question.image`.

## Important Files
- Entry: `index.html` → `src/main.jsx` → `src/App.jsx` → `src/state/store.jsx`.
- Logic: `src/domain/model.js`, `src/domain/scoring.js`, `src/domain/report.js`, `src/db/storage.js`, `src/ai/client.js`, `src/lib/supabase.js`, `src/cloud/teacherData.js`.
- Config: `package.json`, `vite.config.js` (`react()` + conditional `viteSingleFile()`, `base:'./'`, `target:'es2019'`), `vercel.json`, `.env.example`, `.gitignore`.
- Backend: `api/ai/report.js` (needs `OPENROUTER_API_KEY`, 503 if missing), `api/students/provision.js` (needs `SUPABASE_SECRET_KEY`).
- Docs/fixtures: `README.md` (357 lines, Turkish; note stale `node verify.tmp.mjs` — use `npm test`), `ornek-test-2-sinif-matematik.json`, `ornek-test-2-sinif-geometri-resimli.json`.

## Runtime/Tooling Preferences
- Runtime Node 18+; package manager npm only (`package-lock.json` v3; pins vite 5.4.21, react 18.3.1, supabase-js 2.116). No `engines`/`packageManager`/`.nvmrc`/Docker/bun/pnpm/yarn.
- No TS (`tsconfig` absent), no eslint/prettier/biome/tailwind/postcss/husky. Match existing hand style; don't add tooling.
- Env: template `.env.example`, never commit `.env*` (git-ignored except `!.env.example`). Frontend `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` via `import.meta.env`; server-only `OPENROUTER_API_KEY/MODEL/SITE_URL/SITE_NAME`, `SUPABASE_URL`/`SUPABASE_SECRET_KEY` via `process.env` (set in Vercel dashboard). Browser AI key optional in `localStorage` via Settings; falls back to rule report.

## Testing & QA
- No framework, no `*.test.*`/`tests/`/`e2e/`, no coverage tool. Single check: `npm test` (= `node scripts/verify.mjs`).
- `scripts/verify.mjs`: hand-rolled `check(name, cond, extra)` → `✓`/`✗`, exit 0 + `TÜM TESTLER GEÇTİ` on pass, else `N TEST BAŞARISIZ` exit 1. Sections: seed (≥60 bank Qs, 12 tests, ≥5 Qs/test), scoring + timing, JSON export/import, `ZAYIF KONULAR` rule report, backup, student-code normalization, mocked OpenRouter client + Vercel handler (inline `localStorage`/`fetch`/fake-response stubs, no fixtures).
- Covers only `src/domain/*`, `src/db/storage.js`, `src/ai/client.js`, `api/ai/report.js`. Never covered: React UI, router/store, Supabase cloud, CSS, `ornek-test-*.json`. No CI (`.github/` absent); validate locally with `npm test`.
