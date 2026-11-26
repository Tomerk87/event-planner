# Hosting plan: where and how to run Event Planner

**Date:** 2026-11-26 · **Status:** reference — **no decision yet** (owner, 2026-11-26). These options are kept to come back to.

Development is local for now. The demo stays on Netlify. Hosting and the email provider must be chosen before the V2.2 pilot (implementation plan, Phase 10).

Prices were checked on 2026-11-26 and change often, so confirm them on each provider's page before paying.

---

## 1. What the product needs in order to run

| Part | What it is today | Needs |
|---|---|---|
| Frontend | React build (static files) | Any static host |
| Backend | NestJS (Node), one Docker image (`backend/Dockerfile`) | Something that runs a Node server **all the time** |
| Database | PostgreSQL 17, Prisma migrations | A Postgres database with backups |
| Pictures | Cover photos and floor pictures, saved **to the server's disk** (`backend/src/storage/image-storage.ts`, `UPLOAD_DIR`) | A disk that survives restarts, or object storage (S3/R2) |
| Email | Sent over **SMTP** to any provider (`EMAIL_MODE=smtp`, `SMTP_HOST`…) | An email-sending provider and DNS records for the domain |
| Domain + HTTPS | Let's Encrypt in the Nginx container | A domain you own |
| Demo | A frontend-only build; it needs no server (`netlify.toml`) | Any static host (it runs on Netlify today) |

**Already in the repository:** a complete, tested deployment for one server, decision **D101**, step-by-step guide in `docs/DEPLOYMENT.md`. It has:
- Docker Compose (Nginx + API + Postgres) with memory limits and health checks;
- build and deploy scripts, and rollback to the last 3 versions;
- nightly backups to S3, plus a restore script;
- smoke tests for a deployed site (`frontend/e2e-deploy/`).

It was written for AWS. It runs unchanged on **any** Linux server with Docker.

## 2. Can Cloudflare run it?

**Yes, but not for free, and not without changes.**

| Need | Cloudflare product | Free? | Fit |
|---|---|---|---|
| Frontend | Workers static assets / Pages | ✅ Free | Perfect |
| Backend (NestJS) | **Containers** (runs our Docker image) | ❌ Needs the **Workers Paid plan, $5/month**. Usage is included up to a limit (memory 25 GiB-h, CPU 375 vCPU-min, disk 200 GB-h per month) | Works. Containers **go to sleep when idle**, so the first visitor after a quiet period waits a few seconds |
| Database | D1 is SQLite, **not Postgres**, so it would mean rewriting the data layer ❌. Use an external Postgres instead (Neon) through **Hyperdrive** (included in Workers Paid) | Neon has a free plan | Works |
| Pictures | **R2** (S3-compatible) | ✅ Free up to 10 GB | We would have to write an R2 adapter for picture storage, because a container's disk is not kept |
| Email | **Email Service** (sending is in beta) | ❌ Sending to any address needs Workers Paid; about $0.35 per 1,000 emails | Works over SMTP, with no code change |
| Domain, HTTPS, protection | DNS + proxy | ✅ Free | Excellent |

**About "Cloudflare's own email" on your website:** on the free plan this is most likely **Email Routing**, which *receives and forwards* mail to your inbox. It cannot send invitation or verification emails to other people. Sending needs Email Service on the paid plan.

**Work needed to move the product onto Cloudflare:** about **4–5 days**. This covers:
- an R2 storage adapter;
- a Worker that routes `/api` to the container;
- connecting to Neon through Hyperdrive;
- a new deploy pipeline with `wrangler`, and running migrations from it;
- nightly database backups to R2;
- dealing with container cold starts.

## 3. Options compared

| | **A. All on Cloudflare** | **B. One small server + Cloudflare in front** | **C. AWS, as already documented** |
|---|---|---|---|
| How | Frontend on Cloudflare; API in Cloudflare Containers; DB on Neon; pictures on R2; email via Cloudflare | The existing Docker Compose on one rented Linux server (Hetzner, DigitalOcean, Vultr…). Cloudflare provides DNS, HTTPS proxy and DDoS protection for free | The existing guide: EC2 t4g.small + SES + S3 backups |
| Monthly cost | ~$5 (Workers Paid), until usage outgrows the included amounts or the 1 GB Neon free database | ~€6–7 (e.g. Hetzner CAX11 €5.99 + VAT + IPv4; Hetzner has had availability problems in 2026, and DigitalOcean/Vultr are ~$6) | **$0 for ~5 months** (new-account credits), then ~$20/month. The account closes at 6 months unless upgraded |
| Code changes | 4–5 days (see above) | ~0.5 day: trust Cloudflare's visitor IP in Nginx, because RSVP rate limiting otherwise sees every visitor as Cloudflare; small guide updates | None |
| Always on | No, it sleeps when idle (cold starts) | Yes | Yes |
| You maintain a server | No | Yes: security updates, done by the scripts plus a monthly check | Yes, the same |
| Vendors | Cloudflare + Neon | Server host + Cloudflare + email provider | AWS (+ GoDaddy domain in the guide) |
| Risk | Newer products, several moving parts, an untested deployment | Low: the tested setup | Low, but the 6-month deadline forces a move or an upgrade |

## 4. Recommendation (not decided yet)

Other single-server hosts, for comparison when deciding: DigitalOcean, Vultr, Linode (Akamai) and OVH all offer small Linux servers for about $5–7/month. Oracle Cloud's "Always Free" ARM server is free but has a reputation for hard sign-ups and reclaiming idle machines. Fly.io, Railway and Render run the Docker image without a server to maintain; check their current pricing, and note that they need a separate Postgres (their own, or Neon).

**Run the tested Docker setup on one server (B), with Cloudflare in front for the domain, DNS and protection. Use Resend for email.**

Steps:
1. **Now → about 5 months:** start the server on **AWS with the free credits** by following the existing guide. Swap in two things:
   - Cloudflare DNS instead of GoDaddy (you already use Cloudflare);
   - Resend instead of SES.

   It costs nothing during the pilot, and everything is already scripted.
2. **Before month 5:** if the pilot continues, move to a **Hetzner** server (about €7/month) or upgrade AWS (about $20/month). Moving means a backup → restore onto the new server and a DNS switch, about half a day, because the stack is identical.
3. **Revisit Cloudflare-only (A)** once there are paying venues and more traffic, if keeping no server at all becomes worth the 4–5 days of work.

**Why not Cloudflare-only now:**
- it isn't free either ($5);
- it needs about a week of engineering that would delay V2.2;
- cold starts make the first page load slow for a client opening an invitation link.

Option B gives you the same Cloudflare benefits (free DNS, HTTPS, protection) without those costs.

## 5. Email

**Do we have an email service today?**
- The **code** is complete. Sign-up verification, password reset and invitation emails are built and sent over SMTP, in three languages.
- What's missing is a **provider account**. As far as I can tell only the demo is live, so no email is being sent; without a provider, email stays off (`EMAIL_MODE=off`). The guide planned Amazon SES.
- Switching provider is **only settings** (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`). No code changes.

| Provider | Free | Paid | Notes |
|---|---|---|---|
| **Resend** (recommended for the pilot) | 3,000/month, **max 100/day**, 1 domain | $20/month for 50,000 | The easiest setup. It works with any host, so it survives a move from AWS to Hetzner |
| Amazon SES | — | ~$0.10 per 1,000 | The cheapest at scale. A new account starts in a "sandbox" and you must request production access, which AWS can refuse or delay |
| Cloudflare Email Service | Only to verified addresses | Workers Paid $5 + ~$0.35 per 1,000 | Sending is in beta. Makes sense only with option A |
| Brevo (formerly Sendinblue) | A free plan with a daily limit (check the current figure) | Monthly plans | A European company (GDPR-friendly). SMTP relay available. Also does marketing email, which we don't need |
| Postmark | A small free developer allowance | From about $15/month | Known for very good delivery of transactional email; SMTP available |
| Mailgun | A small free allowance (check) | Monthly plans | Mature, SMTP available |
| SMTP2GO / Mailjet / SendGrid | Check current plans (SendGrid's long-standing free plan has been changed) | Monthly plans | All support SMTP, so all fit with no code change |

**Whichever provider is chosen, the work is the same:**
1. create the account;
2. add the provider's SPF/DKIM records and a DMARC record to the domain's DNS;
3. put four settings in the server's `.env`;
4. send a test email.

That takes about 30–60 minutes and needs no code. In local development, Mailpit (`backend/docker-compose.dev.yml`) catches every email, so no provider is needed until the site goes online.

**What to weigh when choosing:**
- the free daily/monthly limit compared with expected sends;
- delivery quality to Gmail/Outlook, since invitations must not land in spam;
- whether the provider stays usable if the host changes;
- whether it's EU or US based (the privacy review for Israel and Brazil);
- how hard the sign-up is (SES's sandbox approval).

The 100/day limit is fine for a pilot: a few venues, each inviting one client, plus sign-ups and password resets. Move to a paid Resend plan or SES once venues send more than that.

Email must be **on** before V2.2 goes live, because client invitations depend on verified email (see the implementation plan, §1 point 5).

## 6. The demo

- **Decided (2026-11-26): the demo stays on Netlify** while we work locally. It is a free, frontend-only site with no server. The V2.2 venue demo is published to the same Netlify site.
- A later option, not planned: move it to Cloudflare Pages (free, about 30 minutes) to keep everything with one vendor.
- The full site also contains the demo (`VITE_DEMO_ENABLED=true`), so a separate demo site is optional once the real site is live.

## 7. Step-by-step hosting plan

About **2 working days**: roughly 1 day of your clicking in web consoles, and 1 day of my work in the repository.

| Step | What | Who | Time |
|---|---|---|---|
| H1 | Choose the domain. Either a subdomain of your Cloudflare domain (e.g. `events.<your-domain>`) or a new domain bought through Cloudflare Registrar (sold at cost) | You | 15 min |
| H2 | Repository changes:<br>• `docs/DEPLOYMENT.md` uses Cloudflare DNS instead of GoDaddy, and Resend instead of SES;<br>• Nginx trusts Cloudflare's `CF-Connecting-IP` from Cloudflare's address ranges only (RSVP rate limits);<br>• `.env.example` gets Resend values;<br>• decision D111 is recorded | Me | 0.5–1 day |
| H3 | Create accounts: AWS (free plan, billing alerts), Resend | You | 1 h |
| H4 | Follow the guide: launch the server, fixed IP, SSH, `server-setup.sh` | You (guided) | 2–3 h |
| H5 | In Cloudflare DNS:<br>• an `A` record to the server (first "DNS only" for the certificate, then "Proxied");<br>• Resend's SPF/DKIM records;<br>• a DMARC record | You | 30 min |
| H6 | First deploy (`build-images.sh`, `deploy.sh`), HTTPS. Set Cloudflare SSL to **Full (strict)**, and add a cache rule so `/api/*` is never cached | You + me | 1 h |
| H7 | Turn on `EMAIL_MODE=smtp`, make yourself Super User, send a test email, run the `e2e-deploy` smoke tests against the live site | You + me | 1 h |
| H8 | Backups: check the nightly job, then **do one restore drill** onto a test database | You + me | 1 h |
| H9 | Monitoring (free): Cloudflare or UptimeRobot health check on `/api/health`, and the AWS budget alert | You | 30 min |
| H10 | Calendar reminder for month 5: decide whether to upgrade AWS or move to Hetzner | You | — |

**When:** do this **in parallel with V2.2 Phases 0–2**, not at the end. A live site lets you show the current product to pilot venues early. When V2.2 is ready, its release (Phase 10) is a normal deploy onto the existing server: backup → migrate → deploy with `VENUES_ENABLED=false` → turn on for the pilot venue.

## 8. Decisions for you

| # | Decision | Status |
|---|---|---|
| 1 | Hosting: **B** (one server + Cloudflare in front), **A** (all Cloudflare), **C** (AWS as written), or another host from §4 | Open |
| 2 | Domain: a subdomain of the existing Cloudflare domain, or a new domain | Open |
| 3 | Email provider: Resend, SES, Cloudflare, or another from §5 | Open |
| 4 | Demo hosting | **Decided: stays on Netlify** (2026-11-26) |

Decisions 1–3 are needed before the V2.2 pilot. Setup takes about 2 days once they are made (§7).

## Sources (checked 2026-11-26)

- Cloudflare Containers pricing: https://developers.cloudflare.com/containers/pricing/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Email Service: https://developers.cloudflare.com/email-service/ and pricing https://developers.cloudflare.com/email-service/platform/pricing/
- Cloudflare rates: https://www.cloudflare.com/rates/
- Resend pricing: https://resend.com/pricing and https://resend.com/blog/new-free-tier
- Neon free plan: https://neon.com/faqs/free-plan-limits-and-quotas
- Hetzner price adjustment 2026: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
