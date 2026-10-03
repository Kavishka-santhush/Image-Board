# 📸 Image Board — AWS CI/CD Learning App

Node.js + React + PostgreSQL app එකක් **AWS services හතරක් (EC2, RDS, S3, Lambda) හරහා GitHub Actions pipeline එකකින් automatic deploy වෙන** විදිහ ඉගෙන ගන්න හදපු project එකක්. Free tier (t2.micro/t3.micro) එකට හරියන විදිහට lightweight.

## Architecture — request යන විදිහ

```
                        ┌──────────────── GitHub ────────────────┐
                        │  push to main                          │
                        ▼                                        ▼
              ┌── deploy.yml ──────────┐              ┌── deploy-lambda.yml ──┐
              │ 1. backend syntax gate │              │ (only lambda/** changes)│
              │ 2. vite BUILD (runner!)│              │ npm ci → zip →        │
              │ 3. SSH upload → EC2    │              │ OIDC → update-function│
              │ 4. knex migrate → RDS  │              └───────────┬───────────┘
              │ 5. pm2 reload          │                          ▼
              │ 6. curl /api/health ✅ │                   ┌────────────┐
              └───────────┬────────────┘                   │  LAMBDA    │
                          ▼                                │ thumbnailer│
        ┌──────── EC2 (t2/t3.micro) ────────┐              └─────┬──────┘
        │ Nginx :80                          │                    │
        │  /          → /var/www (React dist)│         S3 event (uploads/*)
        │  /api/*     → Node :4000 (pm2)     │                    │
        └──────┬──────────────┬──────────────┘                    ▼
               │              │                        ┌────────────────────┐
               ▼              ▼                        │  S3 bucket         │
        ┌─────────────┐  ┌──────────┐  presign URL ←── │  uploads/    (original)  │
        │ RDS Postgres│  │    S3    │ ────────────────▶│  thumbnails/ (thumb) │
        └─────────────┘  └────▲─────┘   PUT bytes      └────────────────────┘
                              │        (browser → S3 directly — EC2 bypass!)
                         Browser (React)
```

**මුල සිට අග දක්වා එකම කතාව:** browser එක API එකට කියනවා → API එක S3 permission slip (presigned URL) එකක් දෙනවා → **file bytes යනවා straight S3 එකට** → S3 ඉවරයි කියලා Lambda එකට කියනවා → Lambda thumbnail එක හදලා **RDS එකේ row එක update කරනවා** → frontend එක refresh වුණාම thumbnail එක පේනවා. ඔයා code එකෙන් එකවත් poll කරවුවේ නෑ — **events වලින්ම** ඕන දේ වෙලා තියෙනවා.

## Folder structure

```
backend/    Express + Knex API (src/, migrations/, seeds/)
frontend/   React (Vite) SPA
lambda/     thumbnailer function
deploy/     nginx configs, pm2 ecosystem, EC2 bootstrap script
.github/    the two CI/CD workflows
docs/       aws-setup.md — 🇱🇰 ඔයා Console එකේ හදන හැම දෙයක්ම step-by-step
PLAN.md     🇱🇰 මුළු project plan එකම, steps 1-10
```

## Local එකේ run කරන විදිහ

**Requirements:** Node 20+, RDS Postgres (local PG **අවශ්‍ය නෑ**), S3 bucket, AWS credentials (`aws configure` හෝ env vars).

```powershell
# 1. Backend
cd backend ; npm install ; cp .env.example .env   # .env එකට RDS/S3 details
npm run migrate:latest ; npm run seed:run         # schema + sample data
npm run dev                                       # :4000

# 2. Frontend (වෙනත් terminal එකක)
cd frontend ; npm install
npm run dev                                       # :5173 — /api proxy → :4000
```

## Deploy (push එකෙන් පස්සේ ඔයා කරන්නේ බලා ඉන්න එක විතරයි)

```powershell
git push origin main      # → Actions tab එකේ 2 workflows (deploy.yml + deploy-lambda.yml)
```

මුලින් වරක් විතර setup කරන්න: **`docs/aws-setup.md`** එකේ § 1→7 අනුපිළිවෙළට — S3, credentials, RDS, Lambda, EC2, OIDC හැම එකක්ම click-by-click විදිහට Sinhala වලින් තියෙනවා. 🇱🇰

> ⚠️ `npm ci` නිසා **lockfiles** (`package-lock.json` ×3: backend, frontend, lambda) commit කරලා තියෙන්න ඕන.

## මේ project එකෙන් ඔයාට දැන් පැහැදිලිව විස්තර කරන්න පුළුවන් දේවල් ✅

- [x] **CI/CD** — build server-ලා නෙවෙයි pipeline-ලා (micro RAM limit ට බලපාන්නේ නෑ), path-filtered workflows, concurrency lock, health gate එකකින් red/green deploys
- [x] **S3 presigned uploads** — signatures, content-type binding, expiry, browser→S3 direct (EC2 bypass)
- [x] **Trust boundaries** — issued-key registry + HeadObject proof + FOR UPDATE race lock + mass-assign whitelist
- [x] **Lambda** — execution role vs DB password, warm-container pooling, event loops (prefix filters!), cross-platform packaging
- [x] **RDS** — SG-to-SG rules, TLS, connection budgets, migrations as deploy step
- [x] **IAM** — least-privilege policies, instance profiles, **keyless OIDC** GitHub→AWS
- [x] **Nginx** — reverse proxy, SPA fallback, immutable hashed assets vs no-cache index.html
- [x] **Knex** — idempotent migrations/seeds, rollback discipline
- [x] **React** — loading/error/empty states, fetch cancellation, presigned upload UX

## ඉවරයි නම් — teardown

**`docs/aws-setup.md` § 8** එකේ checklist එක අනුපිළිවෙළට execute කරන්න — free tier ඉක්මවා මුදල් යන්න කලින් resources ඉවත් කරන එක හොඳම පුරුද්ද. 💸
