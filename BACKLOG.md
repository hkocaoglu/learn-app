# Backlog

Parked review findings from the 2026-10-11 codebase review. Not yet implemented —
each item is recorded here so it is not lost, and can be picked up later.

Format: **ID — Title** (priority) · `location` · problem · proposed fix · status.

---

## BL-1 — Client-graded scoring (integrity gap)
**Priority: High** · `src/cloud/attempts.js:29`, `src/cloud/submitStudentAttempt`,
`supabase/migrations/*attempts*`

**Problem.** Exam attempts are graded in the browser: `scoreAttempt(test, answers)`
runs client-side and the result — `correct_count`, `score_percent`, and per-question
`correctIndex`/`correct` — is inserted directly into `attempts` / `reading_attempts`.
RLS correctly stops cross-user/cross-teacher data leakage, but it does **not** stop a
student from tampering their own session:
- the correct answer to every question is exposed to the student's browser, and
- a student can submit `score_percent: 100` via DevTools.

**Proposed fix.** A `security definer` server function that receives only the raw
`answers` + `assignment_id`, joins to the authoritative `tests.questions`,
re-scores server-side, and rejects any mismatch. Never persist client-supplied
`correct_count`/`correctIndex` for grading purposes.

**Partial mitigation landed (2026-10-11, points system):** the
`20261011120000_points_rewards.sql` trigger `award_attempt_points` now **recomputes
exam scores from the authoritative `tests.questions` before awarding points**, so
points are tamper-resistant even though `attempts.score_percent` itself is still
client-supplied. Remaining to fully close BL-1:

- reject/overwrite the client's `attempts.score_percent` (displayed results still
  lie if tampered), and
- **`reading_attempts` has no `answers` column** — reading quiz scores cannot be
  recomputed at all; the reading earn trigger falls back to the stored
  `score_percent`. Closing BL-1 should add an `answers jsonb` column to
  `reading_attempts`, send it from `submitReadingAttempt`, and recompute there too.

**Status:** parked — partially mitigated 2026-10-11 (exam *points* recompute
server-side in the earn trigger; score display + reading answers gap still open).

---

## BL-2 — Documentation drift
**Priority: Low** · `AGENTS.md` (repo + parent `~/AGENTS.md`), `README.md`

**Problem.** Docs describe the app in an older state:
- `npm run lint` is referenced (and an `.oxlintrc.json` is claimed in the parent
  `~/AGENTS.md`) but **no lint script or lint config exists**. Scripts are only
  `dev / build / build:single / preview / test`.
- `README.md` still points to `node verify.tmp.mjs`, which does not exist; the real
  entry point is `npm test` (= `node scripts/verify.mjs`).
- Counts/assets have moved on: 9 migrations, 20 screens, 8 components, plus the
  TTS + reading-passage/quiz subsystem (`api/tts/speak.js`, `src/ai/tts.js`,
  `src/lib/speech.js`, `src/cloud/readings.js`, `src/cloud/passages.js`) — none of
  which the repo `AGENTS.md` "Key Directories" section mentions.

**Proposed fix.** Update both `AGENTS.md` files and `README.md` to match the current
code (scripts, asset counts, the TTS/reading subsystem, `npm test` as the sole
check). Confirm the points system is reflected too once it lands.

**Partially fixed (2026-10-13):** the reading + RSVP subsystem is now documented in
`AGENTS.md` (`domain/readingGates.js`, `domain/rsvp.js`, `cloud/readings.js`,
`cloud/passages.js`, `docs/rsvp-reading.md`, migration count) and `README.md`'s stale
`node verify.tmp.mjs` was corrected to `npm test`. Still open: the phantom `npm run lint`
claim, asset/screen counts, and the parent `~/AGENTS.md`.

**Status:** parked (partially fixed).

---

## BL-3 — Dead linter directives
**Priority: Low** · `src/ui/screens/ExamScreen.jsx:101,147`

**Problem.** Two `// eslint-disable(-next-line)` comments reference ESLint, which is
not installed. They are harmless noise but mislead. The line-101 one also keys a dep
array on a `elapsedSec === 0 ? 0 : elapsedSec` workaround that would benefit from a
comment if kept.

**Proposed fix.** Remove or reword the directives; add an explanatory comment at the
line-101 dep array (or simplify the timer effect so the workaround is unnecessary).

**Status:** parked.

---

## Notes
- **BL-1 ↔ points system:** the points earn hook landed *with* a server-side
  recompute for exam scores, so the reward ledger is already tamper-resistant for
  exams. Reading quiz scores remain client-trusted until BL-1 adds an `answers`
  column to `reading_attempts`.
- Points system verification: `npm test` (144 checks incl. 35 for `domain/points.js`
  and 33 for the RSVP word-flow mode) plus `bash scripts/verify-points-db.sh`
  (19 live-SQL assertions, one of which covers the RSVP points gate — run when
  migrations change; needs local PostgreSQL).
- No automated test coverage exists for React UI, router/store, cloud, or CSS
  (`scripts/verify.mjs` covers only `src/domain/*`, `src/db/storage.js`,
  `src/ai/client.js`, `api/ai/report.js`). The points sketch in
  `docs/points-system.md` includes a `verify.mjs` section for the pure
  `domain/points.js` logic.
