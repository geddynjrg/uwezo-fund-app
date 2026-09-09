# Uwezo Fund App

Mobile-first **PWA** (Vite + React + TypeScript) with **Capacitor** ready for Android APK.
Home screen: Uwezo Fund branding + links to Wezesha Majuu, loan application, and the official website, plus an in-app **OTP Chat** for phone login.

## Project location

`/home/uwezoict/work/assistive-ai-eight/uwezo-fund-app`

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Installable | PWA (`vite-plugin-pwa`) — Add to Home Screen |
| Native | Capacitor 8 (`appId`: `ke.go.uwezo.fundapp`) |
| Icon | Real Uwezo Fund crest from Majuu LMS branding assets |

## Links

| Label | URL |
| --- | --- |
| Wezesha Majuu | https://majuu.uwezo.go.ke |
| Loan application | https://loans.uwezo.go.ke |
| Website | https://www.uwezo.go.ke (from portal `site-config`) |
| Loans staging (dev / opt-in) | https://loans-staging.uwezo.go.ke |

## OTP Chat — what it does

WhatsApp-style thread that mirrors Majuu / loans **Help chat** phone OTP:

1. User enters Kenyan mobile (`07…` / `+2547…`)
2. App `POST`s `{ method: "phone_send", phone }` to  
   `{VITE_OTP_API_BASE}/api/assistive-chat/login`
3. User enters 6-digit code → `{ method: "phone_verify", requestId, otp }`
4. On success, shows a short session note (user id when returned)

**Default API base:** `https://majuu.uwezo.go.ke`  
Override with `VITE_OTP_API_BASE` (e.g. `https://loans.uwezo.go.ke`).

### Wired vs fallback

- **Wired:** Same assistive-chat login contract as Majuu portal (`phone_send` / `phone_verify`).
- **CORS / network failure:** Chat UI stays usable; messages explain the failure and offer **Open Majuu Help** (`https://majuu.uwezo.go.ke`) so users can finish OTP in the portal Help widget.
- Cookies/session from cross-origin browser apps may be limited by the host’s CORS/`SameSite` settings — native Capacitor WebView or same-origin hosting works best for a durable session.
- Meta WhatsApp OTP is **not** required for this v1 (email failover on the server side remains as implemented in Majuu).

## Requirements

- **Node.js 20+** (22 recommended). System Node 12 is too old; use a modern Node on `PATH`.
- For Android APK: Android Studio / SDK + JDK 17+.

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # if you installed Node under ~/.local/node
cd /home/uwezoict/work/assistive-ai-eight/uwezo-fund-app
cp .env.example .env   # optional
npm install
```

## Run (dev / PWA)

```bash
npm run dev
# → http://localhost:5175
```

Preview production build:

```bash
npm run build
npm run preview
```

Install as PWA: open the preview/deployed HTTPS URL in Chrome/Safari → **Install app** / **Add to Home Screen**. Icon is the Uwezo Fund logo.

## Android (Capacitor)

```bash
npm run build
npx cap add android          # once
npx cap sync android
npx cap open android         # open Android Studio → Build APK/AAB
# or: npx cap run android
```

Assets live in `public/icons/` and `src/assets/` (copied from Majuu LMS `uwezo_fund_logo.png`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run cap:sync` | `build` + `cap sync` |

## Secrets

Do **not** commit `.env` with credentials. This app only needs a public OTP API base URL — no SMS provider keys in the client.

## Repo / commit

Local project under the assistive-ai-eight workspace. Confirm with the team before creating a new GitHub repository (none named `uwezo-fund-app` existed under the usual org pattern at creation time).
