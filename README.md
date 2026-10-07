# Kairos

Kairos is a personal memory app. You capture notes, files, images, and voice, and Kairos keeps them searchable. Ask questions in plain language, or turn on Recall to use screen memory across what you have already saved.

Recall is **Kairos Pro**. Access is the RevenueCat entitlement `recall`. Development builds purchase it through the RevenueCat Test Store. Store submission is not required for that path.

## Repository

| Path | What it is |
| --- | --- |
| `apps/mobile` | Expo / React Native app (`com.kairos.mobile`) |
| `backend` | NestJS API, Prisma, Postgres |
| `docs/REVENUECAT_SUBSCRIPTIONS.md` | How Test Store, webhooks, and the `recall` entitlement fit together |
| `docs/SHIPATON_NEXT_GEN.md` | Devpost copy, checklist, and the two-minute demo script |

The app icon used for submission is `apps/mobile/assets/icon.png` (1024×1024), also copied to `docs/shipaton-assets/icon-1024.png`.

## Run the backend

Requires Node 20.

```bash
npm install
cp backend/.env.example backend/.env
```

Fill `backend/.env` with Postgres (`DATABASE_URL`, `DIRECT_URL`), `CLERK_SECRET_KEY`, and `REVENUECAT_SECRET_API_KEY` plus `REVENUECAT_WEBHOOK_AUTHORIZATION` if you want purchase events written to the database. Then:

```bash
npm run prisma:migrate --prefix backend
npm run backend
```

The API listens on `PORT` (default 3000).

## Run with Docker

This starts Postgres (with pgvector), the API on port 3000, and the web app on port 3001. Uploads stay on a local volume. The database URL inside Compose replaces whatever `DATABASE_URL` is in `backend/.env`.

```bash
cp backend/.env.example backend/.env
cp .env.example .env
```

Fill `CLERK_SECRET_KEY` in both files, and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the root `.env`. Add `AI_API_KEY` to `backend/.env` when you want Ask, capture analysis, and embeddings. Then:

```bash
docker compose up --build
```

The API is at `http://localhost:3000`. The web app is at `http://localhost:3001`.

The phone app still runs on the host. Point `EXPO_PUBLIC_API_URL` at `http://10.0.2.2:3000` for the Android emulator, or at your machine's LAN address for a physical device.

## Run the mobile app

RevenueCat’s native SDK does not run in Expo Go. Use a development build.

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Set at least:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL` (Android emulator: `http://10.0.2.2:3000` if the API is on your machine)
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` — the **Test Store public SDK key** from RevenueCat, not a secret key

`__DEV__` builds use that Test Store key on both iOS and Android. Release builds look for `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` instead.

```bash
npm install --prefix apps/mobile
npm run mobile:android
```

`npm run mobile:ios` is the same flow on a Mac. `npm run mobile` only starts Metro.

## RevenueCat Test Store

In the RevenueCat project, attach one Kairos Pro subscription to the `recall` entitlement and put that product on the current offering. Sandbox testing must allow Test Store purchases. Details and the webhook URL are in [docs/REVENUECAT_SUBSCRIPTIONS.md](docs/REVENUECAT_SUBSCRIPTIONS.md).

To show the paywall: sign in, open **Recall** from Today (or Capture, or Profile). Without an active `recall` entitlement, `RecallPaywall` is the whole screen. **Start Kairos Pro** buys the Test Store package through `react-native-purchases`. The app then calls `POST /billing/sync`, and the API records Pro from RevenueCat.

## Shipaton Next Gen

This track does not need an App Store or Play listing. The description, screenshot export steps, and demo script are in [docs/SHIPATON_NEXT_GEN.md](docs/SHIPATON_NEXT_GEN.md).

## License

[MIT](LICENSE). Copyright (c) 2026 UditAwasthi.
