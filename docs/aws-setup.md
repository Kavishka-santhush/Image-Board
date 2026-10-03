# AWS Console — Manual Setup Guide ( අදියරෙන් අදියර )

මේ file එකේ ඔයා AWS Console එකේ හදන දේවල් step by step තියෙනවා.
Code පැත්ත අපි හදනවා — manual පැත්ත ඔයා.

---

## 1️⃣ S3 Bucket එක හදන විදිහ (Step 6ට කලින් හදන්න)

### Bucket create

1. AWS Console → **S3** → **Create bucket**
2. Bucket name: `image-board-uploads-<ඔයාගේ ආකාරයේ අකුරු>` (global unique ඕනයි — එකම නමක් ගත්තනම් වෙන මොකද්දක් දාන්න)
3. Region: **Asia Pacific (Mumbai) ap-south-1** — EC2/RDS එකට හැකිතාක් ළඟින් (cross-region data transfer charges එපා)
4. ❌ Bucket versioning — need නෑ, off තියන්න
5. **Block public access settings**: මේක **ALL 4 ON තියන්න** — presigned URL upload එකට මේක බාධකයක් NOT 🎯
   - මතේ තියාගන්න: presigned URL = signed request. "Block public access" එකෙන් block කරන්නේ **anonymous** access එක විතරයි. Signed PUT වලට effect එකක් නෑ.
6. ❌ Server access logging — free tier එකේ need නෑ
7. **Create bucket** click කරන්න

### CORS configuration (මේක mandatory — මේක නැත්තම් browser S3 එකට upload කරන්න බෑ)

Bucket → **Permissions** tab → **CORS configuration** → edit කරලා මේක paste කරන්න:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

> Deploy කරනකොට EC2 domain/IP එකත් AllowedOrigins එකට එකතු කරනවා (Step 9-10දී ඒකට update කරන විදිහ කියලා දෙන්නම්).

**WHY?** Browser එකක් *another origin* එකකට (S3) fetch/PUT කරද්දී preflight OPTIONS request එකක් යවනවා. Bucket එකේ CORS rule නැත්තම් S3 ඒක reject කරනවා → upload fail → console එකේ "CORS Error". `AllowedHeaders: ["*"]` දාන්නේ presigned PUT එකේ `Content-Type` header එක preflight එකෙන් allow කරන්න.

### ඉතිරි public access (image display) — Step 7දී හදන්න

`<img src="https://bucket.s3.../uploads/x.jpg">` straight render කරන්න නම් anonymous GET (public read) ඕනයි. ඒක ආවරණය වෙන්න § 4️⃣ පහළින් තියෙනවා.

---

## 2️⃣ Local dev AWS credentials

Local machine එකෙන් presign කරන්න SDK එකට credentials ඕනයි. EC2 එකේදී මේක **අවශ්‍යම නෑ** (instance profile වලින් auto).

### Option A — AWS CLI (recommended)

1. https://aws.amazon.com/cli/ install කරන්න (හෝ `winget install AWS.CLI`)
2. PowerShell: `aws configure` → Access Key, Secret, region `ap-south-1`, output `json`
   - Keys හදන එක: Console → IAM → **Users** → ඔයාගේ user → **Security credentials** → **Create access key** → "CLI" select → keys copy කරගන්න (secret එක වෙලාවක විතරක් පෙන්නනවා!)
3. Test: `aws s3 ls` → buckets list එක එන්න ඕන

SDK එක automatic මේ `~/.aws/credentials` file එක කියවනවා — backend එකේ `.env` එකේ keys දාන්න **අවශ්‍ය නෑ**.

### Option B — env vars

`backend/.env` එකට:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```
(මේ fields .env.example එකේ comment කරලා තියෙනවා — uncomment කරලා fill කරන්න)

> ⚠️ IAM user එකට permission: `AmazonS3FullAccess` simple but broad. Correct-but-advanced: bucket-scoped policy. Learning project එකකදී FullAccess ප්‍රමාණවත්, නමුත් production එකේදී bucket ARN එකට scope කරනවා — Step 9 IAM docs එකේ ඒක පෙන්නන්නම්.

---

## 3️⃣ මේ දක්වා හදපු code එක test කරන්න

```powershell
cd backend
# .env එක update කරන්න: S3_BUCKET=ඔයා හදපු bucket නම
npm run dev
```

වෙනත් terminal එකකින් presign request එකක් (PowerShell):

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/uploads/presign `
  -ContentType 'application/json' `
  -Body '{"content_type":"image/jpeg","size_bytes":123456}'
```

**Expect කරන්නේ:**
- ✅ `upload_url`, `key`, `expires_at` → S3 Console → bucket → Objects → ඒ key එකේ prefix එකට "0 objects" පේන්න ඕන (upload තාම කරලා නෑ නිසා)
- ❌ content_type "image/gif" දුන්නොත් → 400 + details
- ❌ size_bytes 9999999999 → "file too large"

RDS එකේ `uploads` table එකට row එකක් එකතු වෙන්න ඕන — verify: `psql` එකෙන් හෝ DBeaver වලින් `select * from uploads;`.

---

## 4️⃣ Bucket Public Read policy (Step 7 — images පෙන්නන්න)

**මතක තියාගන්න:** අපි public කරන්නේ `uploads/` prefix එකේ objects විතරයි — මුළු bucket එකම නෙවෙයි. Least privilege, S3 විදිහට.

### Step 4a — Block Public Access එකෙන් ONE toggle off

1. Bucket → **Permissions** → **Block Public Access settings** → **Edit**
2. **Block public access to buckets and objects granted through new and existing public access control lists (ACLs) and bucket policies** → ❌ OFF කරන්න (first toggle එක විතරයි! අනිත් 3 එක ON තියන්න)
3. **Save** → "Are you sure?" → confirm (warning එක දැකලා ටිකක් පරිස්සමට: අපි දාන policy එක GetObject විතරක් නිසා scope එක පටුයි)

### Step 4b — Bucket policy එක

Permissions → **Bucket policy** → paste (BUCKET_NAME වෙනුවට ඔයාගේ නම දාන්න):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": [
        "arn:aws:s3:::BUCKET_NAME/uploads/*",
        "arn:aws:s3:::BUCKET_NAME/thumbnails/*"
      ]
    }
  ]
}
```

> `thumbnails/` prefix එකත් දාලා තියෙන්නේ Step 8 Lambda එක ඒ prefix එකට thumbnails write කරන නිසා — ඒ imagesත් `<img>` වලින් පෙන්නන්න public read ඕනයි. Prefix දෙකම scope කරලා, මුළු bucket එකම නෑ.

> **WHY මෙහෙම?** Presigned PUT (upload) signed request නිසා BPA එකෙන් බාධාවක් නෑ. ඒත් `<img>` tag එකක් anonymous GET එකක් — ඒකට public read policy ඕන. Uploads = authenticated, display = public-read-only. මේ distinction එක S3 ඉගෙනීමේ core එකක්.

### Verify

S3 Console → bucket → uploads/ → ඕනෑම object එකක **Object URL** එක copy කරලා browser එකේ paste කරන්න → image එක පේන්න ඕන. 403 එනවා නම් 4a/4b හරියට කරලා නෑ — frontend එකේ placeholder box එක "image not reachable" කියලා පෙන්නන්නේ ඒකයි (PostImage onError).

---

## 5️⃣ Lambda thumbnailer (Step 8)

### 5a — IAM Role එක (Console)

1. Console → **IAM** → Roles → **Create role**
2. Trusted entity: **AWS service** → Use case: **Lambda**
3. Permissions attach කරන්න:
   - `AWSLambdaBasicExecutionRole` (CloudWatch logs)
   - `AWSLambdaVPCAccessExecutionRole` (5b නිසා Lambda VPC එකට දානවා — ENI create කරන්න මේක ඕන)
   - Inline policy එකක් (`Add permissions` → `Create inline policy` → JSON tab):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteBucket",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:HeadObject"],
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    }
  ]
}
```

> **WHY bucket-scoped?** Lambda role එකට `AmazonS3FullAccess` දුන්නොත් ඔයාගේ AWS account එකේ *හැම* bucket එකටම access එකක් එනවා — blast radius එක විශාලයි. Least privilege = resource ARN එක ඔයාගේ bucket එකට විතරක් scope කරන එක.

4. Role name: `image-board-lambda-role` → create.

### 5b — Network පැත්ත (මේක තමයි hardest part)

Lambda එකෙන් RDS එකට connect වෙන්න ඕන. RDS security group එක `VPC default` විතරයි allow කරන්නේ නම්, Lambda default network එකෙන් (ඒකෙ own implicit VPC එකක්) RDS එකට යන්න බෑ. Solution: **Lambda එක ඔයාගේ default VPC එකේම place කරනවා** — ඊට පස්සේ traffic VPC ඇතුළේම රැඳෙනවා, SG rule එක SG-to-SG පටු කරන්න පුළුවන්:

1. **RDS console** → ඔයාගේ instance → **Modify** → *Publicly accessible* → **Yes** (Lambda VPC-integrated වුණාම real-world එකේ අවශ්‍ය නෑ, ඒත් free-tier default-VPC setup එකක DNSprivate resolve වෙන්න ඕන — මතක තියාගන්න production එකේ මේක No)
2. **EC2 Console → Security groups** → ඔයාගේ **default** SG එකේ inbound rule එකක්: **5432 from the same default SG** (මේක Lambda use කරන SG එකයි)
3. RDS SG එකට inbound rule එකක්: **PostgreSQL 5432, source = default SG** (`sg-…`) — 0.0.0.0/0 **නැහැ!** 🔒

### 5c — Deploy package එක සෑදීම (Windows PowerShell)

```powershell
cd lambda\thumbnailer

# 1. Linux binaries install කිරීම (ඔයා Windows එකේ, Lambda Linux එකේ run වෙනවා!)
npm install --cpu=x64 --os=linux --libc=glibc

# 2. Zip එක — Compress-Archive පාවිච්චි කරන්න එපා ⚠️
#    (Windows PowerShell එකේ Compress-Archive zip entries වල path
#     separator විදිහට \ දානවා — Lambda/node ඒ module එක find කරන්න
#     බැරි වෙනවා. tar.exe (bsdtar) forward-slash දානවා — හරි විදිහ.)
tar.exe -a -cf function.zip index.js package.json node_modules
```

### 5d — Function එක හදන විධිය (AWS CLI)

```powershell
# ACCOUNT_ID සහ REGION වෙනස් කරන්න; SUBNETS/SG default VPC එකෙන් ගන්න
# (EC2 Console → VPC → Subnets → default VPC එකේ subnet-… id 2-3 එකක්,
#  Security Groups → default SG හඳුනාගෙන)

aws lambda create-function `
  --function-name image-board-thumbnailer `
  --runtime nodejs20.x `
  --handler index.handler `
  --zip-file fileb://function.zip `
  --role "arn:aws:iam::ACCOUNT_ID:role/image-board-lambda-role" `
  --timeout 30 `
  --memory-size 256 `
  --vpc-config "SubnetIds=subnet-aaa,subnet-bbb,SecurityGroupIds=sg-ccc" `
  --environment "Variables={DATABASE_URL=postgres://postgres:PASSWORD@RDS_ENDPOINT:5432/imageboard}"
```

> **WHY 256MB / 30s?** 400px thumbnail එකකට 256MB ප්‍රමාණවත් (sharp/streaming — original 5MB ට වඩා වැඩි නෑ). Lambda එකේ memory වැඩි කරාම CPU share එකත් proportional — ඒ නිසා cold start + resize එක 512MB-1024MB වලට වඩා වේගවත් වෙන්න පුළුවන්; learning project එකකට 256MB හොඳ balance එකක්. Timeout 30s: RDS connect hang වුණොත් function එක සදහටම run වෙන්න ඉඩ දීම එපා — fail fast, observe in logs.

### 5e — S3 event notification එක (Console)

1. S3 → bucket → **Properties** → **Event notifications** → **Create event notification**
2. Name: `thumbnail-on-upload`
3. Event types: **PUTs and POSTs** (Object Created → Put) විතරයි (Delete/Restore අවශ්‍ය නෑ)
4. **Prefix**: `uploads/` — **මේක load-bearing filter එකක්!** thumbnail PUT වලදීත් event fire වෙනවා; prefix නැත්තම් S3→Lambda→S3 **infinite loop** එකක් 💸
5. Destination: **Lambda function** → `image-board-thumbnailer`
   - Console එක මෙතනදී function resource-based policy එකට auto-permission එකක් දානවා (S3 → ඔයාගේ function invoke කරන්න) — ඔයා හදන්න ඕන නෑ.

### 5f — Test කරන විධිය

1. App එකෙන් නව post එකක් image එකකින් create කරන්න
2. **Refresh නොකර** 10-20s ඉන්න — Lambda run වෙනවා
3. Home එකට ගිහින් refresh → thumbnail එක පෙනියි — **ඔයා frontend/backend කිසිම code එකක් වෙනස් කරලා නෑ!** (async event processing මේකයි)
4. වැඩ කරන්නේ නැත්නම් logs බලන්න:
```powershell
aws logs tail /aws/lambda/image-board-thumbnailer --follow
```

> **Debug hint**: `Connection terminated` → 5b SG rules. `Task timed out` → RDS public/SG නෑ. `AccessDenied` on PutObject → 5a inline policy. `code signature` / module not found → 5c (`--os=linux` නැතුව install කළා නම්).

---

## 6️⃣ EC2 + GitHub Actions (Step 9)

### 6a — EC2 instance එක (Console)

1. EC2 → **Instances** → **Launch instances**
2. Name: `image-board-web`
3. AMI: **Amazon Linux 2023** (free tier eligible)
4. Instance type: **t2.micro හෝ t3.micro** (free tier)
5. Key pair: නව එකක් හදලා `.pem` එක **download කරලා සුරක්ෂිතව තියන්න** (ඔයාට manual SSH වලට අවශ්‍ය ප්‍රධාන key එක මේකයි)
6. Network settings:
   - VPC: default, Subnet: public subnet එකක්
   - **Security group** → name `image-board-web-sg` → inbound rules:
     - SSH 22 → **My IP විතරයි** (0.0.0.0/0 දාන්න එපා 🔒)
     - HTTP 80 → **0.0.0.0/0** (අපිට ලෝකෙට serve කරන්න ඕන)
   - ✅ **Enable auto-assign public IPv4** (public DNS එකක් ඕනයි)
7. Launch.

### 6b — EC2 Instance Profile (IAM — S3 access WITHOUT keys)

Step 6 comment එකේ කියූවා EC2 එකේ AWS keys නෑ කියලා — මේකයි ඒ mechanism එක:

1. IAM → **Roles** → Create role → Trusted entity: **AWS service** → Use case: **EC2**
2. Name: `image-board-ec2-role`
3. උඩ Step 8a වල හදපු bucket-scoped inline policy එකම මෙතනත් attach කරන්න (GetObject/PutObject/HeadObject, `arn:aws:s3:::BUCKET_NAME/*`) — EC2 එකට presign කරන්නත් HeadObject කරන්නත් ඕනයි. CloudWatch අවශ්‍ය නෑ (logs pm2 වලින් local).
4. EC2 Console → instance → **Security → Modify node role** → `image-board-ec2-role` attach කරන්න

> **මේකෙන් සිද්ධ වෙන්නේ:** backend එකේ `new S3Client({})` call එක EC2 metadata service එකෙන් short-lived credentials ගන්නවා. `.env` එකේ AWS keys **එකම වචනයක්වත්** දාන්න ඕන නෑ — server compromise වුණාම පවා keys කඩත්තු වෙන්නේ නෑ.

### 6c — RDS Security Group එකට EC2 allow එක

RDS SG → Inbound → **5432 from `image-board-web-sg`** (SG-to-SG, IP නෑ!). EC2 එකෙන් migrate/run වෙන්න ඕන නිසා. ඔයාගේ laptop IP rule එක (Step 2ක දාපු) තියාගන්න — dev කරන්න.

### 6d — Box එක සූදානම් කරන එක (SSH + bootstrap)

```powershell
cd C:\path\to\your-key.pem
# Windows එකේ key permissions:
icacls .\your-key.pem /reset
icacls .\your-key.pem /grant:r "$($env:USERNAME):(R)"

ssh -i .\your-key.pem ec2-user@<public-dns>
```

SSH ගියාම:

```bash
git clone <ඔයාගේ repo URL> ~/src && cd ~/src
# ⚠️ Windows එකේ commit කරපු .sh files වල \r\n line endings එන්න පුළුවන් —
# bash එකට ඒක "bad interpreter" error එකක්. විසඳුම එක line එකයි:
sed -i 's/\r$//' deploy/ec2-bootstrap.sh
cp deploy/ec2-bootstrap.sh /tmp/ && bash /tmp/ec2-bootstrap.sh
```

(pipeline එකට කලින් repo එක public නම් හරි; private නම් Console එකෙන් raw file එක download කරලා server එකට copy කරන්න — මේක වෙන්නේ එක පාරක් විතරයි.)

### 6e — EC2 එකේ `.env` එක (මේක විතරක් manual — secrets GitHub වල ගබඩා නෑ!)

```bash
mkdir -p /var/app/image-board/backend
cat > /var/app/image-board/backend/.env << 'EOF'
PORT=4000
DATABASE_URL=postgres://postgres:PASSWORD@RDS-ENDPOINT:5432/imageboard?sslmode=require
DB_POOL_MIN=1
DB_POOL_MAX=5
AWS_REGION=ap-south-1
S3_BUCKET=ඔයාගේ-bucket-නම
UPLOAD_MAX_MB=5
PRESIGN_TTL_SEC=300
REQUIRE_ISSUED_KEY=true
EOF
chmod 600 /var/app/image-board/backend/.env   # වෙන කවුරුත් කියවන්න බැරි
```

> **AWS keys දාන්නෙ නෑ** — 6b instance profile එකම ප්‍රමාණවත් (default credential chain 🔗 Step 6 comment එක මතක් කරගන්න).

### 6f — Deploy SSH keypair (GitHub → EC2)

මේක ඔයා manual login වෙන key එක නෙවෙයි — pipeline එකට විශේෂ deploy key එකක් හදමු (වෙන් කරන්න හේතුව: මේ key එක GitHub වල තියෙනවා, ඒක leak වුණොට ඔයාගේ personal key එක ආරක්ෂිතයි):

```powershell
ssh-keygen -t ed25519 -f gh_deploy -C "github-actions" -N '""'
# gh_deploy.pub එකේ content එක copy කරගන්න
```

EC2 එකේ (SSH වෙලා):
```bash
echo 'public key content එක මෙතනට' | tee -a ~/.ssh/authorized_keys
```

### 6g — GitHub Secrets (3කි)

Repo → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Name | Value |
|---|---|
| `EC2_HOST` | instance public DNS (console → instance → Public IPv4 DNS) |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | `gh_deploy` PRIVATE key එකේ සම්පූර්ණ content එක (notepad වලින් open කරලා copy කරන්න — `-----BEGIN...-----` lines ඕනෑම වෙන්න ඕන) |

### 6h — පළමු deploy එක 🚀

```powershell
git add .   # ⚠️ backend/package-lock.json සහ frontend/package-lock.json ද එකතු කරන්න (6i බලන්න)
git commit -m "feat: full app with CI/CD pipeline"
git push origin main
```

GitHub → **Actions** tab → workflow run එක open කරලා බලන්න:
1. `check-backend` 🟢 (syntax gate)
2. `build-frontend` 🟢 (vite build artifact එකෙන්)
3. `deploy-ec2` 🟢 — logs එකේ `==> HEALTH GATE` පස්සේ `{"status":"ok","db":"up"}` පේනවා නම් **ඔයා production එකේ ඉන්නවා** 🎉
4. Browser එකෙන්: `http://<EC2_HOST>` — Image Board, සැබෑ images S3 වලින්, ඔයාගේ pipeline එකෙන් deploy උනා!

> **6i — LOCKFILE** වැඩේ: `npm ci` කියන්නේ lockfile එකෙන්ම install කරනවා; lockfile නැත්තම් job එක fail. ඒ නිසා local එකේ `npm install` (backend/frontend දෙකෙන්ම) හදලා package-lock.json දෙකම commit කරන්න.

### පිරිසිදු CI/CD habits (මේ pipeline එකේ අදහස)

- push = deploy — merge කරන ඔයාම, deploy කරන්නේ pipeline එක
- red job = broken deploy (health gate curl); නිහඬ ව්‍යසන නෑ
- rollback = පරණ commit එකට revert push එකක් — pipeline ඒක ආපහු deploy කරනවා

---

## 7️⃣ Lambda pipeline එකට දාන්න — GitHub OIDC (Step 10)

**මේක තමයි අලුත්ම, හොඳම විදිහ:** GitHub runner එක AWS පැත්තෙන් trust කරනම short-lived OIDC token එකකින් temporary credentials මට්ට කරනවා — **AWS access keys කිසිම ලෙක ගබඩා වෙන්නේ නෑ**. Keys GitHub secrets වල තියාගෙන ඉන්න එක production එකේ අවදානමක් (leak වුණොට සම්පූර්ණ account එකම!).

### 7a — IAM OIDC provider එක (වරක් විතරක්)

1. IAM → **Identity providers** → **Add provider**
2. Provider type: **OpenID Connect**
3. Provider URL: `https://token.actions.githubusercontent.com`
4. Audience: **`sts.amazonaws.com`** (මේක miss කරන එක 🔴 No.1 troubleshooting bug එක)
5. Add provider.

### 7b — Deploy role එක

1. IAM → Roles → Create role → Trusted entity: **Web identity** → උඩ හදපු OIDC provider එක select
2. User-defined conditions → `Account` check කරගන්න;
   - **Audience**: manual token → `actions.githubusercontent.com` නෙවෙයි **`sts.amazonaws.com`** තියාගන්න
3. Permissions: inline policy එකක් — scope පටුම විදිහට (least privilege) මතක අමුතුවෙන්:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UpdateThumbnailerOnly",
      "Effect": "Allow",
      "Action": ["lambda:UpdateFunctionCode", "lambda:PublishVersion", "lambda:GetFunction"],
      "Resource": "arn:aws:lambda:ap-south-1:ACCOUNT_ID:function:image-board-thumbnailer"
    }
  ]
}
```

4. Role name: `image-board-gh-deploy` → create → **Role ARN** එක copy කරගන්න.

### 7c — Trust relationship පටු කරන්න (default: හැම GitHub repo එකකින්ම ඒ role එක assume කරන්න පුළුවන්!)

Roles → `image-board-gh-deploy` → **Trust relationships** → Edit policy → `Condition` එක මෙ විදිහට වෙනස් කරන්න:

```json
"Condition": {
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:ඔයාගේ-GITHUB_USERNAME/image-board:ref:refs/heads/main"
  }
}
```

> **WHY?** ඒකෙන් කියන්නේ: *මේ repo එකේ main branch එකෙන් විතරයි* මේ role එක assume කරන්න පුළුවන්. ඕනම GitHub user එකක ඕනම repo එකකට ඔයාගේ account එකට ලඟින් එන්න දෙන එක — key leak එකක් වගේම නරකයි. මේ step එක skip කරපු blog posts ගොඩක් තියෙනවා; අපි skip කරන්නේ නෑ.

### 7d — GitHub secret එක

Repo → Settings → Secrets and variables → Actions → New:

| Name | Value |
|---|---|
| `AWS_LAMBDA_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/image-board-gh-deploy` |

(`AWS_REGION` වශයෙන් org-level variable එකක් දාන්නට බැරි විට default ap-south-1 වලට workflow එක run වෙනවා.)

### 7e — Test

`lambda/thumbnailer/index.js` එකේ comment line එකක් වෙනස් කරලා commit+push → **Deploy Lambda** workflow එක trigger වෙනවා (README edit එකකින් වෙන එක නෑ — paths filter!); job එක green නම් Lambda code එක AWS එකේ 🎉

> **ALTERNATIVE (OIDC වැඩ කරන්නේ නැත්නම්):** `aws-actions/configure-aws-credentials` වල `aws-access-key-id` / `aws-secret-access-key` secrets දාන්න පුළුවන් — ඒත් ඒක පැරණි, අවදානම් විදිහයි. OIDC හදන විදිහ බලන්න හොඳයි.

> **Version/alias tip:** S3 notification එක `$LATEST` එකට point කරනවා (Console default). Workflow එකෙන් publish කරන immutable versions production-grade deploys වලදී alias (`PROD`) එකකින් pin කරනවා — instant rollback එකට. Learning phase එකේ $LATEST ප්‍රමාණවත්; හැඳුනුමක් විදිහට මතක තියාගන්න.

---

## 8️⃣ ඉගෙනීම ඉවරයි නම් — TEARDOWN checklist (බිල් පනතින් බේරෙන්න 😄)

**හැම දෙයක්ම පිළිවෙළට ඉවත් කරන්න** (dependencies නිසා order එක වැදගත්):

1. ☐ S3 bucket → **Event notifications** එක delete (Lambda function එකට කලින් — නැත්නම් S3 invoke errors පෙන්නනවා)
2. ☐ S3 objects ටික select-all → **Delete** (uploads/ + thumbnails/ — versions තිබුණොත් ඒවාත්)
3. ☐ Lambda → `image-board-thumbnailer` → **Delete**
4. ☐ CloudWatch → Log groups → `/aws/lambda/…` + `/aws/pm2…` ටික delete
5. ☐ EC2 → instance → **Stop instance** → ඊට පස්සේ **Terminate** (Stop = ඉතිරි EBS disk එකට ගෙවන්න වෙනවා!)
6. ☐ Elastic IPs (දාලා තියෙනවා නම්) → release
7. ☐ RDS → instance → **Delete** ("Create final snapshot?" → No; auto minor version checkbox එකත් බලන්න)
8. ☐ Security groups → custom ටික delete (default එක ඉතුරු වෙනවා — ඒක ठीकයි)
9. ☐ IAM → roles (`image-board-lambda-role`, `image-board-ec2-role`, `image-board-gh-deploy`) + OIDC provider → delete
10. ☐ Billing dashboard එක **24-48h** වත් විවෘත කරලා බලන්න — free tier ඉක්මවා charges එකක් ආවා නම් හේතුව මෙතනින් හොයාගන්න පුළුවන්

> **Region** එකම මතක තියාගන්න — ap-south-1 එකේ නෑ වෙන region එකකවත් resources එකක් ඉතුරු වෙලාද කියලා බලන්න (Console එකේ top-right එකේ region switcher එක!). "Orphaned volume in another region" — free-tier students ලගාගෙනම වෙච්චි වැඩක්.

---

## 🗑️ Cost warning (free tier)

- S3 standard: 5GB free — ඔයාගේ test uploads KBs ප්‍රමාණයයි, fret වෙන්න එපා
- Region එකක් ම තියාගන්න (ap-south-1 recommended — Mumbai is free-tier eligible)
- Monthly bill check: Console → **Billing and Cost Management** — bookmark කරන්න
