# Points & Rewards System — Sketch

Status: **UYGULANDI (2026-10-11)** — domain + yerel mod + cloud (migration/RLS/trigger/RPC) + UI
sonlandırmaları yapıldı. Doğrulama: `npm test` (108 kontrol) + `bash scripts/verify-points-db.sh`
(17 SQL doğrulaması: yetkili skorlama, idempotency, stok yarışı, RLS).
Coupled to `BACKLOG.md` item **BL-1** — see *Server-side integrity* below.
Created 2026-10-11.

**Locked decisions (user, 2026-10-11):**

1. Points are earned **server-side only** — client never writes ledger rows (BL-1
   lands with the earn hook).
2. **Balances carry across school years** — no decay, no expiry, no yearly reset.
3. **No teacher approval for spending** — students redeem freely at their own
   discretion; flexibility over what to buy.
4. Prizes are **class-based pools** — class 4 and class 5 each have their own
   separate prize pool.
5. Prizes are **limited stock, first-come-first-served** — e.g. "red pen" costs 10
   points and stock is 10, so of 30 students only the first 10 who can afford it
   claim it; stock is enforced atomically by the server.

## 1. Goal

Give every student a running **point balance** earned from reading assignments and
exams, with the *quality* of the result feeding the points. Students can **save**
points to redeem a higher-value reward later, or **spend now** on any reward they can
already afford. The reward catalog is decided/edited later by the teacher/admin —
it must not be hard-coded in the client.

Motivation model: "do more, be careful." Points reward both **participation**
(completing work) and **care/quality** (accuracy, effort), so a careless 100%
participation that scores low earns less than a careful one.

## 2. Core model: a ledger, not a counter

Do **not** store a single mutable `points` integer on the student. Use an
append-only **transaction ledger** and derive the balance from it. This gives an
auditable history, makes "save vs spend" trivial (spend is just a negative row),
and is idempotent (an exam earns exactly once even if re-submitted).

Three concepts:

- **Point transaction (ledger row)** — one earned or one spent event.
- **Reward catalog** — the spendable items, editable later.
- **Redemption** — the link when a student spends on a catalog item.
Optionally: **Save goal** — a student marks a reward they are saving for (progress
bar), which *is* the "save for higher value" mechanism.

## 3. Data model

### 3.1 `point_transactions` (ledger — the source of truth)

```
id            uuid pk
teacher_id    uuid not null references profiles(id) on delete cascade
student_id    uuid not null references students(id) on delete cascade
kind          text not null check (kind in ('earn','spend','adjust'))
source        text not null check (source in
              ('exam','reading','catalog','manual'))  -- what triggered it
ref_type      text           -- 'exam','reading' for earn; 'catalog' for spend
ref_id        uuid           -- attempts.id / reading_attempts.id / reward_redemptions.id
amount        integer not null -- >0 for earn, <0 for spend, sign allowed for adjust
label         text not null default ''   -- human note, e.g. "Sınav: Matematik %85", "Ödül: Kitap"
balance_after integer        -- denormalized running total for fast UI; validated server-side
created_at    timestamptz not null default now()
```

Balance for a student = the `balance_after` of its most recent row
(`ORDER BY created_at DESC LIMIT 1`), or `SUM(amount)`. Keep `balance_after`
denormalized **and** validated by the server trigger so it cannot drift from `SUM`.

### 3.2 `rewards` (catalog — one pool per class, edited later)

```
id           uuid pk
teacher_id   uuid not null references profiles(id) on delete cascade  -- pool owner
class_id     uuid not null references classes(id) on delete cascade   -- class-scoped pool
name         text not null check (char_length(trim(name)) between 1 and 120)
icon         text not null default 'star'      -- emoji / icon key
cost         integer not null check (cost >= 1)
description  text not null default ''
active       boolean not null default true
quantity     integer not null check (quantity >= 0)  -- REMAINING stock (never NULL)
redemption_count integer not null default 0          -- lifetime claims
created_at   timestamptz not null default now()
```

Key consequences of the locked decisions:

- **Class-scoped pool**: `class_id` partitions the catalog — a class-5 student can
  only see/redeem class-5 rewards. Two classes never compete for the same stock.
- **Stock never unlimited**: `quantity` is *remaining* stock, always present. When
  it reaches 0 the reward disappears from student view ("tükenmiş").
- **No approval flow**: redemption is instant; `reward_redemptions` is the final
  record a teacher later cross-checks against stock (§5).
- Teacher/admin edits the pool for their classes, and by `admin` via `AdminScreen`.
  Seed presets ship in a new `src/data/seedRewards.js`.

### 3.3 `reward_redemptions` (a spend)

```
id              uuid pk
teacher_id      uuid not null references profiles(id) on delete cascade
student_id      uuid not null references students(id) on delete cascade
reward_id       uuid not null references rewards(id) on delete set null
cost            integer not null            -- snapshot of cost at redeem time
redeemed_at     timestamptz not null default now()
```

A redemption always creates **one** `point_transactions` row with `kind='spend'`,
`source='catalog'`, `ref_type='catalog'`, `ref_id=reward_redemptions.id`,
`amount = -cost`.

### 3.4 `save_goals` (optional, "save for higher value")

```
id           uuid pk
student_id   uuid not null references students(id) on delete cascade
reward_id    uuid not null references rewards(id) on delete cascade
created_at   timestamptz not null default now()
unique (student_id, reward_id)
```

Purely a UI goal — no ledger effect. Progress = `balance / cost`. This is the
explicit answer to "save to spend on higher-value things."

### 3.5 RLS (mirror the existing exemplary pattern)

- `point_transactions`: select = `teacher_id = auth.uid() and is_teacher()` **or**
   `student_id = current_student_id()`. Insert **only** via the server scoring/
   redeem functions (students cannot write ledger rows themselves).
- `rewards`: teacher = own classes' pools; student = active rewards of their own
   class (`students.class_id = rewards.class_id`, `status = 'active'`), and stock
   is still re-checked at redeem time (never trust the client's read).
- `reward_redemptions`: teacher read own; student read own + insert through the
   redeem function.
- `save_goals`: student own; teacher read own students.

## 4. Earn formula (quality-aware, configurable)

Points = **participation base** + **quality bonus**, so results matter.

**All earn math runs server-side** (locked decision): the client only triggers the
attempt insert; the `security definer` earn function recomputes the score from the
authoritative test row and writes the ledger. Formulas below are implemented once in
SQL (cloud) and mirrored in `src/domain/points.js` (local mode + tests).

### 4.1 Exam

```
base   = 5                       -- completed an exam at all
bonus  = round(quality * 0.15)   -- quality = score_percent (0..100) -> 0..15
care   = timedBonus              -- earned only if NOT time-up and avg time reasonable
points = clamp(base + bonus + care, 1, 30)
```

- A perfect careful exam → ~20 + care.
- A rushed/time-up low-score exam → ~5. Result relevance is built in via `bonus`.
- Constants live in `domain/points.js` (`POINTS.exam.base`, `.qualityWeight`,
   `.care`, `.max`) so teachers/admins can tune later, not in the DB.

### 4.2 Reading

A reading earns when **read = true** (dwell + scroll met, per `reading attempts`)
and the quiz passes `quiz_threshold`:

```
base   = 3
quiz   = round(quizScorePercent * 0.08)  -- 0..8
points = clamp(base + quiz, 1, 12)
```

Incomplete reading (`read = false`) earns 0 (no points for skipping), matching the
existing "careful" intent. Quiz quality feeds the bonus.

### 4.3 Idempotency

Earn points at most once per attempt. The ledger insert uses `ON CONFLICT (ref_type,
ref_id) DO NOTHING` (unique constraint) so a re-submission or a retry never double-
earns. Spend is naturally idempotent via the redemption row.

### 4.4 Open: what "care" means precisely
`care`/time bonuses reward effort but could be gamed by slow answering. **Decision
needed:** cap care on *first-attempt* accuracy and per-question time distribution
rather than total time, to reward genuine focus without rewarding dawdling. Flagged
as an open question in §8.

## 5. Spend / redeem mechanics

- A student **always** may keep their balance (do nothing) → *saving for free*.
- A student **may redeem** any `active` reward of their class where
  `balance >= cost` **and** `quantity >= 1` ("spend immediately if they can
  afford"). **No teacher approval** — redemption is instant (locked decision).
- **First-come-first-served stock**: redemption goes through a server function
  `redeem_reward(reward_id)` that, in **one atomic transaction**:
  1. locks the reward row,
  2. checks `active` + `quantity >= 1`,
  3. checks the student's balance >= cost (balance = ledger sum),
  4. decrements `quantity`, increments `redemption_count`,
  5. records the `reward_redemptions` row (cost snapshot),
  6. inserts the negative `point_transactions` row.
  It rejects on insufficient balance **or** exhausted stock — concurrent students
  race safely because the lock serializes claims, so exactly `quantity` students
  win. The client can never overspend or oversell.
- `balance` is the running ledger sum, so spending on one item immediately lowers the
  balance available for the next — "spend now or save" is the same state, just a
  choice of when to redeem.
- **Save goal** (optional UI): student taps "save for this"; UI shows
  `balance / cost` progress. Encourages deferring small spends for a bigger item.

## 6. UI

### 6.1 Student side (`StudentPortalScreen.jsx`)
- **Balance chip** in the header — current points, prominent and always visible.
- **After each exam/reading** — a small "+N puan" confirmation (like the existing
   submit-result screen) showing what they earned and the new balance.
- **Ödül Mağazası (Reward Shop) screen** — grid of active rewards of the student's
  own class with `cost`, icon, **remaining stock** ("Kalan: 7/10"), and state:
  `Affordable` / `Yetersiz bakiye` / `Tükendi`. Tap to redeem instantly (no
  approval); tap "Bunun için biriktir" to set a save goal. Progress bars for active
  save goals.
- **History** — recent earn/spend transactions (`point_transactions`).

### 6.2 Teacher/Admin side
- **AdminScreen / a new Rewards panel** — manage the catalog: add/edit/retire
   rewards, view class-wide redemption summary, top earners, and "who is saving for
   what".
- Points appear in reports (`ReportsScreen` / `buildRuleReport`) as a per-student
   line: balance, exams+readings completed, total earned.

## 7. Integration & migration plan (UYGULANDI)

1. ✅ **Domain (pure, tested):** `src/domain/points.js` — `earnForExam`,
   `earnForReading`, `balanceOf`, `earnedAlready`, `canAfford`, `redeemState`,
   `progressToward`, `catalogForClass`, transaction factory'ları; 35 kontrol
   `scripts/verify.mjs` "6b) Puanlar & Ödüller" bölümünde.
2. ✅ **Local mode:** `src/db/storage.js` (`pointTransactions/rewards/redemptions/
   saveGoals`, seed `src/data/seedRewards.js`, yedek round-trip) + `store.jsx`
   (`addAttempt` yerel kazanım, `addReward/updateReward/deleteReward/
   adjustPoints/refreshPoints`).
3. ✅ **Cloud + server integrity:** `supabase/migrations/20261011120000_points_rewards.sql`
   — tablolar, RLS, `award_attempt_points`/`award_reading_points` trigger'ları
   (sınav skoru yetkili sorulardan yeniden hesaplanır), `redeem_reward` (atomik,
   kilitli), `adjust_student_points`. `src/cloud/rewards.js` istemci katmanı.
   Not: BL-1'in tamamı (attempts.score_percent düzeltmesi) parklıdır.
4. ✅ **UI:** öğrenci portalı bakiye çipi + `#/odul-magazasi` (StudentShopScreen),
   sınav/okuma sonuçlarında `+N puan` (PointsEarned), öğretmen `#/oduller`
   (RewardsScreen: havuz/bakiyeler/hareketler), App.jsx rota + nav.

## 8. Decisions

**Resolved (user, 2026-10-11):**

- ~~Catalog ownership~~ → **class-based pools**; every reward row carries `class_id`
  (§3.2). Teacher manages their own classes' pools; admin may manage all.
- ~~Spending consequences~~ → **no approval / no fulfillment step**; redemption is
  instant and final. Teachers audit via `reward_redemptions` history only.
- ~~Point decay / expiry~~ → **no decay; balances carry across school years**.
- ~~Earn location~~ → **server-side only**, landing together with BL-1.
- ~~Stock~~ → always limited (`quantity` not null), first-come-first-served,
  atomic (§5).

**Still open:**

1. **Point economy numbers** — are the exam/reading formulas in §4 sensible for the
   grades used (1–6)? Default constants are placeholders; confirm or adjust.
2. **Care/anti-dawdle** — exactly what earns the `care` bonus, and how to prevent
   slow-answering from farming it (§4.4)?
3. **Streak/badges** — out of scope for this sketch, but "do more over time" suggests
   a daily-streak bonus; note for a future iteration, not this one.
4. **Teacher visibility of redemptions** — a summary widget in the teacher UI
   (claims per reward, who claimed what) — polish, not a design blocker.

## 9. Test plan (UYGULANDI)

`scripts/verify.mjs` — "6b) Puanlar & Ödüller" bölümü (35 kontrol):
- `earnForExam`: mükemmel+dikkatli 25, süre dolmuş 20, sonuç yükseldikçe puan
  artar, tüm kombinasyonlar [1,30] aralığında, geçersiz giriş güvenli.
- `earnForReading`: `read=false` → 0; tamamlandı+mükemmel quiz 11; [1,12] aralığı.
- Ledger: kazanım pozitif / harcama negatif / düzeltme işaretli, `balanceOf`
  zinciri, `earnedAlready` idempotency, `canAfford` sınırı (10/10 ✓),
  `redeemState` (affordable/unaffordable/sold_out/inactive), `progressToward`.
- Sınıf havuzları: 1-6 arası her sınıfın havuzu var, sınıf 4 ≠ sınıf 5,
  "Kırmızı kalem" 10 puan/10 adet, sıralama + pasif eleme.
- Yedek: ledger + havuz + harcama round-trip.

`scripts/verify-points-db.sh` (+ `scripts/verify-points.sql`) — gerçek PostgreSQL
üzerinde tüm migration'lar ve 17 doğrulama: yetkili skorlama (istemci sahte
%100 → 10 puan), ledger RLS yazma engeli, sil+yeniden puanlamama, okuma kapıları,
stok yarışı/kilit, sınıf sınırı, yetersiz bakiye, öğretmen düzeltmesi,
yabancı öğretmen izolasyonu, bakiye zinciri. `npm test` yerine **yalnızca
veritabanı değişikliklerinde** çalıştırılır (yerel PostgreSQL gerektirir).

## 10. Why a ledger and not a balance column

Append-only ledger → full audit ("why is this student's balance X?"), trivial
"save vs spend" (spend is a negative row), natural idempotency for earn-once, and it
survives catalog edits (a past redemption keeps its `cost` snapshot). The
denormalized `balance_after` keeps reads cheap; the server trigger keeps it
consistent. This is the shape the whole sketch builds around.
