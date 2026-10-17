# Deployment

How the POC runs on one small AWS server, how to set it up the first time, and how to run it day to day. The decisions are recorded in `docs/DOMAIN.md` D101.

## How it fits together

```text
             Internet (https://<domain>)
                        │
        ┌───────────────┴──────────────────────────────────────┐
        │  EC2 t4g.small, Ubuntu, Docker Compose (/opt/event-planner)
        │                                                      │
        │  web       Nginx :80 :443   the React build, HTTPS,   │
        │            │                /api → backend            │
        │  backend   NestJS :3000     pictures in volume uploads│
        │            │                                          │
        │  postgres  PostgreSQL 17    data in volume pgdata     │
        │                                                      │
        │  migrate   applies new migrations, then exits        │
        │  certbot   Let's Encrypt certificate (volume letsencrypt)
        └──────────────────────────────────────────────────────┘
          nightly backup ──► S3 bucket (30 days)     email ──► Amazon SES
```

- **Domain:** bought at GoDaddy, which also keeps its DNS records. They point the domain at the server and prove to Amazon SES that the domain is yours.
- **Building and deploying:** done from the Mac. `build-images.sh` builds the two images for the server's ARM processor, and `deploy.sh` streams them to the server over SSH. There is no image registry. Each version is named after the git commit, and the server keeps the last three for rollback.
- **Settings:** they live only in `/opt/event-planner/.env` on the server. The template is `deploy/.env.example`, and the real file is never committed.
- **Database migrations:** they run on their own at every deploy, before the API starts.

| File | Purpose |
|---|---|
| `backend/Dockerfile` | API image: the built server, production dependencies and the Prisma CLI for migrations |
| `deploy/web/` | Web image: the React build in Nginx, with HTTPS, caching and the fallback to `index.html` for page addresses |
| `deploy/docker-compose.yml` | The stack: memory limits, health checks, restart policy, log rotation (10 MB × 3 per service) |
| `deploy/scripts/` | `server-setup.sh`, `build-images.sh`, `deploy.sh`, `issue-cert.sh`, `renew-cert.sh`, `backup.sh`, `restore.sh`, `local-test.sh` |
| `frontend/e2e-deploy/` | Smoke tests of a deployed site (`playwright.deploy.config.ts`) |

## Costs and the Free plan

The AWS account uses the **Free plan**: new accounts get $100 in credits, and up to $100 more for trying listed services. Launching an EC2 instance and creating a budget, both part of this guide, are among them; the credits page in Billing lists them.

**Expected monthly usage, paid from the credits** (approximate, Frankfurt prices; Billing shows the real figures):

| Item | Per month |
|---|---|
| EC2 t4g.small, running all the time | about $14 |
| Public IPv4 address (the Elastic IP) | about $3.60 |
| 20 GB disk (gp3) | about $2 |
| S3 backups, SES email (low volume) | cents |
| **Total** | **about $20** |

**Paid by card:** only the GoDaddy domain, about $12–22 for the first year. A `.com` renews at about $22 or more a year.

**Two things to watch:**

- **The account closes on its own** after 6 months, or earlier if the credits run out, whichever comes first. AWS deletes everything 90 days after that. At about $20 a month, $100 of credits lasts about 5 months, and $200 lasts past 6.
- **Before either limit, decide.** Upgrade to the Paid plan (step 14; the remaining credits carry over and are used first) or move elsewhere. Billing shows both the remaining credits and the days left.

## First-time setup, step by step

You do steps 1–10 in the AWS console, GoDaddy and the Mac's Terminal. Once `ssh event-planner` works (step 9), Claude can run the rest with your approval.

Choose the server's address and some names once and use them throughout:

| | Example | Yours |
|---|---|---|
| Domain | `myevents.com` | |
| AWS region | Europe (Frankfurt) `eu-central-1` | same |
| Backup bucket | `event-planner-backups-tomer-2026` (must be unique worldwide) | |

### Step 1: Create the AWS account

1. Go to https://aws.amazon.com and choose **Create an AWS account**. Use an email address that you check.
2. When asked for a plan, choose **Free plan**.
   - Enter a credit card. It is charged only for a Paid plan, or for paid services, which this guide doesn't use.
   - Then confirm by phone.
3. Sign in as the **root user** (the email you signed up with). Then protect the root user:
   1. Top right, click your account name, then **Security credentials**.
   2. Under **Multi-factor authentication (MFA)**, choose **Assign MFA device** and select **Authenticator app**.
   3. Scan the code with Google Authenticator, Microsoft Authenticator or 1Password.
4. Create a user for daily work, so the root user stays locked away:
   1. In the search bar, open **IAM**, then **Users → Create user**.
   2. User name `tomer-admin`. Tick **Provide user access to the AWS Management Console**, choose **I want to create an IAM user** and set a password. Click **Next**.
   3. Choose **Attach policies directly** and tick **AdministratorAccess**. Click **Next**, then **Create user**.
   4. Save the **Console sign-in URL** shown on the last page, and sign in there as `tomer-admin` from now on.
   5. Give this user MFA too: IAM → Users → `tomer-admin` → **Security credentials** → **Assign MFA device**.
5. Top right, next to your name, choose the region **Europe (Frankfurt) eu-central-1**. Check that it is still selected in every later step; S3 and IAM pages may say "Global", which is fine.

### Step 2: Billing alerts

1. Open **Billing and Cost Management**, then **Budgets → Create budget**.
2. Choose **Use a template**, then **Zero spend budget**. Enter your email and click **Create budget**. You'll get an email as soon as anything is charged beyond the credits.
3. Create a second one: **Create budget → Use a template → Monthly cost budget**. Set the amount to `1` (USD), enter your email and click **Create budget**.
4. On the **Billing and Cost Management** home page, find the panel showing the **Free plan credits remaining** and the **days left**. Step 14 tells you to look at it monthly.

### Step 3: Buy the domain at GoDaddy

1. At https://www.godaddy.com, search for the name you want and add the domain to the cart.
2. At checkout:
   - Choose **1 year**.
   - Keep the free **domain privacy**, if offered.
   - Decline the extras: email, Microsoft 365, website builder, SSL certificate, "full domain protection". The site gets a free certificate from Let's Encrypt, and email is sent through Amazon SES.
3. After paying, open **My Products**, choose the domain, and find **DNS** (also called **Manage DNS**). You'll add records there in steps 8 and 12.
4. **Auto-renew:** under the domain's settings, decide whether it renews automatically next year. Leaving it on avoids losing the name; the renewal price is higher than the first year.

### Step 4: S3 bucket for backups

1. Open **S3**, then **Create bucket**.
   - Bucket name: your backup bucket name (step 1's table). Region **eu-central-1**.
   - Keep **Block all public access** ticked. Leave the rest as it is.
   - Click **Create bucket**.
2. Open the bucket, then go to **Management → Create lifecycle rule**:
   - Name `expire-after-30-days`.
   - **Apply to all objects in the bucket**; tick the acknowledgement.
   - Tick **Expire current versions of objects**, with 30 days after creation.
   - Click **Create rule**.

### Step 5: A role that lets the server write backups

The server gets permission through this role, so no AWS keys are stored on it.

1. Open **IAM**, then **Roles → Create role**.
2. Trusted entity **AWS service**, use case **EC2**. Click **Next**. Skip the policy list with **Next**.
3. Role name `event-planner-server`, then **Create role**.
4. Open the role, then **Add permissions → Create inline policy → JSON**. Replace the text with the following, putting your bucket name in both places:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```

5. Click **Next**, name it `backup-bucket`, then **Create policy**.

### Step 6: Launch the server

Open **EC2** (region eu-central-1) and choose **Launch instance**.

| Setting | Value |
|---|---|
| Name | `event-planner` |
| Application and OS Images | **Ubuntu**, then **Ubuntu Server 24.04 LTS**. Architecture: **64-bit (Arm)** |
| Instance type | **t4g.small**. It should be marked "Free tier eligible"; if the Free plan doesn't offer it, take **t4g.micro** and tell Claude, who will lower the memory limits |
| Key pair | **Create new key pair**: name `event-planner`, type ED25519, format `.pem`. The browser downloads `event-planner.pem`; keep it, since it can't be downloaded again |
| Network settings → Edit | Keep "Create security group" and name it `event-planner`. Rules: **SSH**, port 22, source **My IP**. **Add security group rule**: **HTTP**, port 80, source **Anywhere**. **Add security group rule**: **HTTPS**, port 443, source **Anywhere** |
| Configure storage | **20** GiB, **gp3** |
| Advanced details → IAM instance profile | `event-planner-server` |

Click **Launch instance**.

### Step 7: A fixed address (Elastic IP)

Without this, the server's address changes whenever it is stopped.

1. In EC2, open **Elastic IPs**, then **Allocate Elastic IP address**, then **Allocate**.
2. Select the new address, then **Actions → Associate Elastic IP address**. Choose the instance `event-planner`, then **Associate**.
3. Write the address down (for example `3.120.45.67`). This guide calls it `SERVER-IP`.

An address that is allocated but not attached is still charged. If you ever delete the server, release the address too.

### Step 8: Point the domain at the server (GoDaddy DNS)

In GoDaddy's DNS page for the domain:

1. Find the **A** record whose Name is `@`. Its value may say "Parked" or "WebsiteBuilder Site".
   - **Edit** it: Value = `SERVER-IP`, TTL = the shortest offered (for example ½ hour).
   - If it can't be edited, delete it and **Add** a new record: Type **A**, Name `@`, Value `SERVER-IP`.
   - There must be only one A record for `@`.
2. Find the `www` record:
   - Usually it is a **CNAME** with Name `www` and Value `@` (meaning "same as the domain"). Keep it.
   - If there is none, add that CNAME.
3. Delete any **Forwarding** set up for the domain, if GoDaddy added one.
4. Wait 10–30 minutes, then check from the Mac's Terminal (replace the domain):

   ```sh
   dig +short myevents.com
   dig +short www.myevents.com
   ```

   Both must end with `SERVER-IP`. The `www` line may show the domain first.

### Step 9: Connect from the Mac (SSH)

In Terminal:

```sh
mkdir -p ~/.ssh
mv ~/Downloads/event-planner.pem ~/.ssh/
chmod 400 ~/.ssh/event-planner.pem
open -e ~/.ssh/config 2>/dev/null || (touch ~/.ssh/config && open -e ~/.ssh/config)
```

Add these lines to the file that opens, with your address, then save:

```text
Host event-planner
  HostName SERVER-IP
  User ubuntu
  IdentityFile ~/.ssh/event-planner.pem
```

Test it. The first time, answer `yes` to "Are you sure you want to continue connecting":

```sh
ssh event-planner
```

You're on the server when the prompt shows `ubuntu@ip-...`. Type `exit` to come back.

If SSH later stops answering, your home internet address has probably changed. In EC2, go to **Security Groups → event-planner → Edit inbound rules**, set the SSH rule's source to **My IP** again, and save.

### Step 10: Prepare the server

From the repository folder on the Mac:

```sh
scp deploy/scripts/server-setup.sh event-planner:
ssh event-planner 'bash server-setup.sh'
```

This takes a few minutes. It installs Docker and the AWS CLI, adds 2 GB of swap, turns on automatic security updates, creates `/opt/event-planner`, and schedules the nightly backup and the certificate renewal.

Then create the settings file:

```sh
scp deploy/.env.example event-planner:/opt/event-planner/.env
ssh event-planner
chmod 600 /opt/event-planner/.env
openssl rand -hex 24          # copy the output: the database password
nano /opt/event-planner/.env
```

In the editor, fill in:

- `DOMAIN`: your domain, without `https://` (e.g. `myevents.com`)
- `LETSENCRYPT_EMAIL`: your email
- `POSTGRES_PASSWORD`: the output of `openssl rand` (keep a copy in your password manager)
- `BACKUP_BUCKET`: your bucket name
- leave `EMAIL_MODE=off` for now, and `APP_VERSION` empty

Don't put quotes around values. Save with Ctrl+O and Enter, leave with Ctrl+X, then `exit`.

### Step 11: First deploy and HTTPS

From the repository folder on the Mac, with everything committed:

```sh
deploy/scripts/build-images.sh
deploy/scripts/deploy.sh event-planner
ssh event-planner /opt/event-planner/scripts/issue-cert.sh
```

- `build-images.sh` takes a few minutes the first time.
- The first `deploy.sh` sends about 220 MB; later deploys send only what changed.
- `issue-cert.sh` gets the certificate, so the domain must already point at the server (step 8).

Open `https://<your domain>`. The landing page should load with a padlock.

Until `issue-cert.sh` has run, the site answers "The HTTPS certificate is not issued yet."

Then sign up with your own email. Accounts made while email is off count as verified.

### Step 12: Email with Amazon SES

**12.1 Verify the domain.**

1. Open **Amazon SES** (region eu-central-1), then **Identities → Create identity**.
2. Choose **Domain** and enter your domain. Under **Advanced DKIM settings**, choose **Easy DKIM**, **RSA_2048_BIT**. Click **Create identity**.
3. SES shows **three CNAME records**. Add each one at GoDaddy with **DNS → Add**, Type **CNAME**:
   - **Name:** only the part before your domain. SES shows `abc123xyz._domainkey.myevents.com`; type `abc123xyz._domainkey`, because GoDaddy adds the domain itself.
   - **Value:** the full value SES shows, ending in `.dkim.amazonses.com`.
4. Add one more record, the DMARC policy that mail services expect:
   - Type **TXT**, Name `_dmarc`, Value `v=DMARC1; p=none;`
5. Within an hour or so, the identity shows **Verified** and DKIM **Successful**. SES also emails you.

**12.2 Leave the sandbox (production access).** A new SES account can only send to addresses you have verified.

1. In SES, open **Account dashboard → Request production access**.
2. Fill in:
   - Mail type **Transactional**
   - Website URL `https://<your domain>`
   - Use case description, which you can paste:

   > Event Planner is a web application for event organizers. We send only transactional emails that users trigger themselves: email address verification at sign-up, password reset, and a notice when an organizer shares an event with a collaborator. No marketing or bulk email, and no purchased lists. Volume is low (under 100 emails a day during the pilot). Every recipient has signed up or was invited by name by an organizer. Each email type is limited to 3 per address per hour. Bounces and complaints are handled by stopping sends to that address.

3. AWS answers within about a day. If it asks for more information or refuses (some Free-plan accounts are asked to upgrade first), forward the answer to Claude.
4. **Testing while you wait:** go to **Identities → Create identity → Email address**, enter your own email, and click the link AWS sends. SES can then send to it.

**12.3 SMTP credentials.**

1. In SES, open **SMTP settings → Create SMTP credentials**. Keep the suggested user name and click **Create user**.
2. The page shows the **SMTP user name** and **SMTP password** once. Download the file and keep it safe; this password isn't your AWS password.
3. Put them in the server's settings:

   ```sh
   ssh event-planner
   nano /opt/event-planner/.env
   ```

   Set:

   ```text
   EMAIL_MODE=smtp
   SMTP_USER=<SMTP user name>
   SMTP_PASSWORD=<SMTP password>
   EMAIL_FROM=Event Planner <no-reply@myevents.com>
   ```

   Keep `SMTP_HOST=email-smtp.eu-central-1.amazonaws.com` and `SMTP_PORT=587`. Then apply:

   ```sh
   cd /opt/event-planner && docker compose up -d backend
   ```

### Step 13: Make yourself the Super User, and send a test email

On the server, with the email you signed up with:

```sh
cd /opt/event-planner
docker compose exec backend npm run super-user -- you@example.com
```

Sign out and in again. In the app, open **System** (Super Users only) and choose **Send a Test Email**; it goes to your own address. It should arrive within a minute.

If it doesn't arrive:

- look in the spam folder
- run `docker compose logs --tail 50 backend` and look for the email error
- while still in the sandbox, the address you send to must be verified (12.2, step 4)

### Step 14: Monthly check, and the month-5 decision

**Once a month, on the Billing and Cost Management home page:**

- check the credits remaining and the days left on the Free plan
- check that no budget alert email has arrived

**In month 5, or as soon as the credits fall below about $25, whichever comes first, decide:**

- **Keep it on AWS:** upgrade the account to the **Paid plan**. On the Billing home page, the Free plan panel has **Upgrade plan**. Nothing on the server changes, and the remaining credits are used first. After that, about $20 a month is charged to the card.
- **Stop:**
  1. Download a backup. On the Mac, run `scp -r event-planner:/opt/event-planner/backups ~/event-planner-backups`.
  2. Let the account close, or close it under **Account**.
  3. Release the Elastic IP first.

**GoDaddy:** note the renewal date, a year after purchase.

## Day-to-day operations

All server commands run in `/opt/event-planner` (`ssh event-planner`, then `cd /opt/event-planner`).

### Deploy a new version

From the Mac, with the work committed:

```sh
deploy/scripts/build-images.sh
deploy/scripts/deploy.sh event-planner
```

The version is the commit's short id. `deploy.sh` does the following:

1. sends what changed
2. copies `docker-compose.yml` and the server scripts
3. sets `APP_VERSION` in `.env` (the previous file is kept as `.env.previous`)
4. applies migrations
5. waits until the API is healthy
6. keeps the three newest versions

Page addresses keep working across a deploy. A tab left open from the previous version reloads itself the first time it needs a page that no longer exists.

### Roll back

```sh
deploy/scripts/deploy.sh event-planner <older version>
```

On the server, `docker images event-planner-backend` lists the versions it has.

Migrations are not undone. A rollback works when the older version runs on the newer database, which is true for added columns and tables. If a migration has to be reversed, restore the backup taken before the deploy (below). Before a deploy with a risky migration, take one by hand.

### Logs

```sh
docker compose ps                        # what is running, and health
docker compose logs -f backend           # the API, live (Ctrl+C to stop)
docker compose logs --tail 100 web       # Nginx requests and errors
docker compose logs migrate              # the last migration run
```

Logs are plain text. Each service keeps at most 3 files of 10 MB.

### Certificate

- **Renewal:** `renew-cert.sh` runs twice a day from cron and renews within 30 days of expiry; Nginx then reloads. Its output is in `backups/renew.log`.
- **Expiry warnings:** Let's Encrypt emails `LETSENCRYPT_EMAIL` if the certificate is close to expiring.

### Backups

- **When:** every night at 02:30 UTC, `backup.sh` saves the database (`db-<time>.dump`) and the uploaded pictures (`uploads-<time>.tgz`).
- **Where:**
  - in `backups/`, kept for 7 days, with the log in `backups/backup.log`
  - in `s3://<bucket>/<time>/`, kept for 30 days
- **Backup by hand:** `scripts/backup.sh`

### Restore

This replaces all current data, and the site is down for the minute it takes. It asks you to type `RESTORE`.

From the server's own copies:

```sh
ls backups/
scripts/restore.sh backups/db-<time>.dump backups/uploads-<time>.tgz
```

From S3:

```sh
aws s3 ls s3://<bucket>/
scripts/restore.sh s3://<bucket>/<time>/db-<time>.dump s3://<bucket>/<time>/uploads-<time>.tgz
```

### Check a deployed site

From `frontend/` on the Mac, run the smoke tests. They take about a minute.

```sh
DEPLOY_URL=https://<your domain> npx playwright test -c playwright.deploy.config.ts
```

**What they cover, on desktop and phone:**
- the landing page, the demo and page addresses
- a throwaway account (an `@simulator.amazonses.com` address, which accepts and discards email)
- a guest, a stored picture, and an RSVP in English and Hebrew

The test events are deleted at the end; the throwaway accounts stay.

### Try the production stack on the Mac

The same stack runs at https://localhost:8443, with a self-signed certificate and data apart from development:

```sh
ALLOW_DIRTY=1 deploy/scripts/build-images.sh     # version "dev"
deploy/scripts/local-test.sh up
DEPLOY_URL=https://localhost:8443 npx playwright test -c playwright.deploy.config.ts   # from frontend/
deploy/scripts/local-test.sh down                # or wipe, to delete its data
```

`local-test.sh backup` and `local-test.sh restore <dump> <uploads>` rehearse a restore.

### Moving to a bigger machine

**The same server, more memory.** The data stays, and so does the Elastic IP:
1. In EC2, select the instance and choose **Instance state → Stop**.
2. Choose **Actions → Instance settings → Change instance type**, for example t4g.medium (4 GB) or t4g.large (8 GB).
3. Choose **Instance state → Start**.
4. Raise the `mem_limit` values in `deploy/docker-compose.yml`, along with Postgres's `shared_buffers` and the API's `--max-old-space-size`. Then deploy.

**A new server** (another region, provider or size):
1. Do steps 6, 7, 9 and 10 for the new server, and deploy to it.
2. Take a backup on the old server and restore it on the new one.
3. Change the GoDaddy A record to the new address.
4. Run `issue-cert.sh` on the new server.

## Google location suggestions (optional)

The Location fields can suggest places from Google Maps as the organizer types (D104). This covers Create Event, Event Settings and the calendar location on RSVP Settings. Without a key, the fields stay plain text boxes and everything else works.

**Cost:** Google charges per use and gives a free monthly allowance, about 10,000 suggestion requests at the time of writing; check Google's Maps Platform pricing page.
- A pause in typing sends one request; choosing a place sends nothing more.
- Above the allowance, it is about $3 per 1,000 requests.
- The daily cap below keeps a month inside the free allowance. A budget alert covers the rest.

### Step by step (about 15 minutes)

1. **Open Google Cloud.** Go to https://console.cloud.google.com and sign in with your Google account.
   - Accept the terms.
   - At the top, choose **Select a project → New project**, name it `event-planner` and create it.
2. **Billing.** Open **Billing** in the menu, then **Link a billing account**, and enter a card. Google requires one even for free use.
3. **Turn on the two services.** Open **APIs & Services → Library**, search for each of these and click **Enable**:
   - **Maps JavaScript API**
   - **Places API (New)**
4. **Create the key.** Open **APIs & Services → Credentials → Create credentials → API key**, then open the new key and set:
   - **Name:** `event-planner-web`
   - **Application restrictions:** **Websites**. Add one per line:
     - `http://localhost:5173/*`
     - `https://<your-netlify-name>.netlify.app/*`
     - `https://deploy-preview-*--<your-netlify-name>.netlify.app/*`
     - and later `https://<your domain>/*`
   - **API restrictions:** **Restrict key**, ticking **Maps JavaScript API** and **Places API (New)** only.
   - Save.
   - The restrictions are what protect the key. It is meant to be visible in the page, and only your sites can use it.
5. **Daily cap.** Open **APIs & Services → Places API (New) → Quotas**. Find the requests-per-day limit and set it to **300**. When it's reached, suggestions pause until the next day and the field keeps working as plain text.
6. **Budget alert.** Open **Billing → Budgets & alerts → Create budget**, with amount **$1** and email alerts at 50%, 90% and 100%.
7. **Use the key:**
   - **Netlify (demo site):** **Site configuration → Environment variables → Add a variable**. Key `VITE_GOOGLE_MAPS_KEY`, value the key. Then **Deploys → Trigger deploy**.
   - **AWS server:** build with the key set, by running `VITE_GOOGLE_MAPS_KEY=<the key> deploy/scripts/build-images.sh` on the Mac.
   - **On the Mac for development:** put `VITE_GOOGLE_MAPS_KEY=<the key>` in `frontend/.env.local`. That file is not committed.
8. **Check it.** Open Create Event and type a venue in **Location**: suggestions appear with "Google Maps" under them.

## Demo-only site (Netlify, free)

A public prototype with **only the demo** (D102), for showing the product before the AWS server exists, or alongside it. It needs no server:
- every visitor gets their own demo, kept in their browser and ending on its own after 3 days (D99)
- a demo event's RSVP link opens on any phone
- Sign In and Sign Up are not shown

`netlify.toml` at the top of the repository holds every setting. It builds `frontend/` with `VITE_ACCOUNTS_ENABLED=false`, sends page addresses to the application, and adds caching and security headers.

**Cost:** $0 on Netlify's free plan, which needs no credit card. Each deploy uses some of the plan's monthly build allowance; a demo deployed a few times a month stays well inside it.

### Setting it up (about 10 minutes)

1. Go to https://www.netlify.com and choose **Sign up**, then **Sign up with GitHub**. Choose the free plan.
2. Choose **Add new project → Import an existing project → GitHub**. Allow Netlify to see the repository `Tomerk87/event-planner` (all repositories, or only this one).
3. Pick `event-planner`.
   - **Branch to deploy:** `main`. The demo build is on `main` once the branch `phase_19_demo_site` is merged; until then you can pick that branch here.
   - Leave the other fields empty; Netlify reads them from `netlify.toml`.
   - Click **Deploy**.
4. After a minute or two, Netlify shows the address, something like `https://jolly-otter-123abc.netlify.app`. To get a nicer one, go to **Project configuration → Change project name**, for example `event-planner-demo`, giving `https://event-planner-demo.netlify.app`.

**Optional:**
- **Save build allowance:** under **Project configuration → Build & deploy → Deploy Previews**, choose **Don't deploy pull requests**.
- **Your own address later:** for example `demo.<your domain>`. In Netlify, open **Domain management → Add a domain**. At GoDaddy, add a **CNAME** with Name `demo` and Value `<name>.netlify.app`. Netlify sets up HTTPS for it on its own.

From then on, every merge to `main` updates the site.

### Checking it

From `frontend/` on the Mac:

```sh
DEPLOY_URL=https://event-planner-demo.netlify.app DEPLOY_DEMO_ONLY=1 npx playwright test -c playwright.deploy.config.ts
```

The test does the following, on desktop and phone:
1. opens the landing page and the demo
2. opens a page by its address and reloads it
3. checks that the account pages lead back to the landing page
4. opens a demo RSVP link in a fresh browser
5. checks that not one request goes to `/api`

To try the same build on the Mac:

```sh
VITE_ACCOUNTS_ENABLED=false npx vite build && npx vite preview     # from frontend/, at http://localhost:4173
```

## Measurements

- **Locally (arm64 Mac, Docker), idle after start:**
  - web 10 MB
  - backend 104 MB
  - postgres 27 MB
- **Image sizes, as sent:**
  - backend about 195 MB
  - web about 24 MB

The server's figures are added after the first deploy:
- idle and peak memory
- disk
- a 3,000-guest import and export
- about 50 simultaneous RSVPs
