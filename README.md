# Uwezo Fund App

Mobile-first **PWA** (Vite + React + TypeScript) with **Capacitor** Android packaging.
Home screen: Uwezo Fund branding + links to Wezesha Majuu, loan application, and the official website, plus account sign-in, notifications, and App QR login.

## Project location

`/home/uwezoict/work/assistive-ai-eight/uwezo-fund-app`

## Download the APK (ready to install)

| File | Path |
| --- | --- |
| **Install this** | `/home/uwezoict/work/assistive-ai-eight/uwezo-fund-app/dist-apk/UwezoFund.apk` |
| Debug alias | `/home/uwezoict/work/assistive-ai-eight/uwezo-fund-app/dist-apk/UwezoFund-debug.apk` |
| Gradle output | `/home/uwezoict/work/assistive-ai-eight/uwezo-fund-app/android/app/build/outputs/apk/debug/app-debug.apk` |

This is an **installable debug APK** (debug-signed). Size ≈ **5.7 MB**. Package id: `ke.go.uwezo.fundapp`. Version **1.1.7** (`versionCode` 9).

### Install on an Android phone (sideload)

1. Copy `UwezoFund.apk` to the phone (USB, Google Drive, email, Nearby Share, or internal file share).
2. On the phone: open the file with **Files** / **Downloads**.
3. If prompted, allow **Install unknown apps** for that source (Chrome, Files, Drive, etc.).
4. Tap **Install** → **Open**.
5. If Uwezo Fund is already installed from an earlier APK with the same package id, this build **updates in place**. You do not uninstall first.
6. Icon uses the official Uwezo Fund crest.

No Play Store listing is required for this sideload build.

### Later updates (no uninstall)

Keep the same package id and a **higher `versionCode`**. The phone then offers **Update** instead of a conflict.

From 1.1.2 onward the app:

- Checks GitHub (`dist-apk/version.json`) shortly after opening the home screen.
- Shows **Checking / Downloading / Installing** on screen.
- Downloads the APK and starts the system installer so it replaces the existing app.
- **Check for app update** runs the same download-and-install flow.

Android still shows a one-tap Install/Update confirmation. Fully silent Play Store auto-update is not possible for a sideloaded APK. Allow **Install unknown apps** for Uwezo Fund when asked.

### Rebuild the APK (this machine)

Needs **JDK 21** and Android SDK (user-local installs used here):

```bash
export JAVA_HOME="$HOME/.local/jdk-21/jdk-21.0.12.1+1"
export ANDROID_HOME="$HOME/.local/android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$HOME/.local/node/bin:$PATH"

cd /home/uwezoict/work/assistive-ai-eight/uwezo-fund-app
npm run build
npx cap sync android
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleDebug --no-daemon
cd ..
mkdir -p dist-apk
cp -f android/app/build/outputs/apk/debug/app-debug.apk dist-apk/UwezoFund.apk
```

Or: `npm run apk:debug` (same steps via package script).

### Signed release APK (optional, for production)

```bash
# Create a keystore once (keep private — do not commit)
keytool -genkey -v -keystore uwezo-fund-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias uwezo

# Configure android/keystore.properties (gitignored) then:
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

Wire `signingConfigs` in `android/app/build.gradle` to that keystore before shipping to Play Store / wide distribution.

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Installable | PWA + **debug APK** via Capacitor |
| Native | Capacitor 8 (`appId`: `ke.go.uwezo.fundapp`) |
| Icon | Real Uwezo Fund crest from Majuu LMS branding assets |

## Links

| Label | URL |
| --- | --- |
| Wezesha Majuu | https://majuu.uwezo.go.ke |
| Loan application | https://loans.uwezo.go.ke |
| Website | https://www.uwezo.go.ke (from portal `site-config`) |
| Loans staging (opt-in) | Set `VITE_SHOW_LOANS_STAGING=true` + `VITE_LOANS_STAGING_URL` |

## OTP on this phone (background)

Stay signed in once. A native listener keeps polling Loans and Wezesha Majuu for OTP inbox items even if you leave or swipe the app away (a small “Listening for OTP” status notification stays visible).

When a code arrives:

1. A heads-up notification shows the OTP.
2. Tap **Copy OTP** on that notification (the app does not need to be open).
3. Paste the 6-digit code on the website, Help chat, or wherever you were asked.

Battery optimization: Android may ask to ignore battery restrictions so listening can continue after reboot.

Phone login on the website (Help chat) is unchanged. This app no longer has an **OTP Chat** button — use **Create account / Sign in** or **Scan App QR**.

## Requirements

- **Node.js 20+** (22 recommended).
- **JDK 21** + Android SDK for APK builds (Capacitor 8).

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd /home/uwezoict/work/assistive-ai-eight/uwezo-fund-app
cp .env.example .env   # optional
npm install
```

## Run (dev / PWA)

```bash
npm run dev
# → http://localhost:5175
```

```bash
npm run build && npm run preview
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run cap:sync` | `build` + `cap sync` |
| `npm run apk:debug` | Build web, sync, Gradle `assembleDebug`, copy to `dist-apk/UwezoFund.apk` |

## Secrets

Do **not** commit `.env`, keystores, or SMS credentials. The client only needs a public OTP API base URL.

## Repo / commit

Local git on `main` under this folder. Confirm before creating/pushing a GitHub remote.
