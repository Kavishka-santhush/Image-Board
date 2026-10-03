# Image Board — AWS CI/CD Learning Project

## මේකෙන් ඉගෙන ගන්නේ මොනවද?

මේක Node.js + React + PostgreSQL app එකක්. ඒත් ප්‍රධාන ඉලක්කය තියෙන්නේ **AWS CI/CD pipeline එකක් හදලා, code push එකකින් ඔක්කොම automatic deploy වෙන එක** බලන එක. Free tier එකට හරියන විදිහට t2.micro / t3.micro EC2 instance එකක app එක RUN වෙනවා (build එකයි deploy එකයි GitHub Actions runner එකේ).

## Services ටික යොදාගන්නා විදිහ

| AWS Service | මේ app එකෙන් ඉගෙන ගන්නේ |
|---|---|
| **EC2 (t2/t3.micro)** | Node backend එක pm2 වලින් run කරන එක, Nginx වලින් React static files serve කරන එක, GitHub Actions SSH deploy |
| **RDS (PostgreSQL)** | DB host/migrate/seeds — local PG එකක් හොයන්නේ නෑ, ඔයා RDS එකටම connect වෙනවා |
| **S3** | Browser එකෙන්ම presigned URL වලින් upload straight to S3 (EC2 හරහා bytes යන්නේ නෑ) |
| **Lambda** | S3 event trigger → image thumbnail එකක් හදලා ආපහු S3 එකට save කරනවා (event-driven architecture) |
| **GitHub Actions** | push එකක් → test → build → EC2 deploy → RDS migrate → Lambda publish |

## Project Structure

```
image-board/
├── backend/          # Express + Knex API (port 4000)
│   ├── migrations/   # RDS schema
│   └── seeds/        # sample data
├── frontend/         # React (Vite) — build කරන්නේ GH Actions එකේ, Nginx serve කරනවා
├── lambda/
│   └── thumbnailer/  # S3 event → sharp → thumbnail → S3
├── .github/workflows/
│   └── deploy.yml    # මුළු CI/CD pipeline එකම
└── deploy/           # Nginx config, EC2 bootstrap script, pm2 ecosystem
```

## App එකේ feature එක (simple)

1. User කෙනෙක් **post** එකක් හදනවා — title, description, image එකක්
2. Image එක browser → S3 direct upload (presigned URL)
3. S3 එකට file එක ඇතුළු වුණාම **Lambda** trigger වෙනවා → thumbnail එකක් හදලා `thumbnails/` prefix එකට save කරනවා
4. Listing page එකේ thumbnail එක පෙන්නනවා

## Build Steps (අපි යන්නේ මේ විදිහට — frontend/backend alternate වලින්)

1. ✅ Backend skeleton — Express, Knex config, .env.example
2. ✅ Migrations + Seeds (posts table)
3. ✅ Frontend scaffold (Vite + React + Router)
4. ✅ Posts CRUD API
5. ✅ Posts UI ↔ API wire කරන එක
6. ✅ S3 presigned URL API
7. ✅ React direct-to-S3 upload
8. ✅ Lambda thumbnailer + S3 event mapping
9. ✅ GitHub Actions — EC2 deploy + RDS migrations
10. ✅ GitHub Actions — Lambda publish + Nginx/pm2 configs + setup docs

## ඔයා AWS පැත්තෙන් හදන දේවල් (manual — හැම එකක් ගැනම step-by-step උපදෙස් දෙන්නම්)

- EC2 t2.micro/t3.micro instance එකක් (Amazon Linux 2023)
- RDS PostgreSQL free tier (db.t3.micro, 20GB)
- S3 bucket එකක් + CORS rule එකක්
- Lambda execution role (S3 write permission)
- IAM user / GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EC2_SSH_KEY`, `EC2_HOST`)

## Local requirements

- Node.js 18+ (20 LTS හොඳයි)
- PostgreSQL local එකේ run කරන්න ඕනේ නෑ — `.env` එකේ `DATABASE_URL` ඔයාගේ RDS endpoint එකට දාන්න
- `npm install` → `npm run dev` (backend), `npm run dev` (frontend)
