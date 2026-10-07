# Kairos — RevenueCat Shipaton 2026, Next Gen

Paste the sections below into Devpost. Do not invent an App Store or Play URL. Next Gen accepts a RevenueCat **Test Store** purchase in the demo video.

Deadline: Wednesday 30 September 2026, 11:45pm PDT.

## Devpost description

### The problem

People save notes, screenshots, voice memos, and files, then cannot find the one detail they need later. Search boxes want the exact words. Memory does not work that way.

### What Kairos does

Kairos is a personal memory app. You capture text, files, images, and voice. Kairos stores them, embeds them, and lets you ask ordinary questions. Recall is the screen-memory feature: it is how Kairos Pro stays with you while you work.

### How RevenueCat is used

Kairos Pro is the entitlement `recall` in RevenueCat. The Expo app uses `react-native-purchases`. In a development build, `__DEV__` selects the Test Store public SDK key (`EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`) on both iOS and Android.

Opening Recall without that entitlement shows `RecallPaywall` (`Start Kairos Pro` / Restore Purchases). Purchase and restore go through the RevenueCat SDK. The app then calls `POST /billing/sync`. The NestJS API reads the subscriber from RevenueCat with the secret key and writes `isPro` in Postgres. Webhooks at `/webhooks/revenuecat` update the same row so an older event cannot overwrite a newer one. The phone never sends its own Pro flag.

The Test Store product is attached to `recall` and to the current offering. Product ids live in the RevenueCat project, not in the app.

### Monetization

One subscription: Kairos Pro. Free use covers capture, library, and Ask. Recall stays behind `recall`. Test Store is the Next Gen demo path. App Store and Play products can use the same entitlement later. They are not part of this submission.

### What is different

Kairos is not a generic chat wrapper. Answers are grounded in the user’s own memories, with citations back to the source note. Pro is a specific capability (Recall), checked on the server from RevenueCat, not a client-side flag.

## Submission checklist

- [ ] Devpost project is entered in **Next Gen** only
- [ ] Confirm you are an active student on that entry
- [ ] GitHub repo is **public**
- [ ] GitHub About shows **MIT** (root `LICENSE`, copyright UditAwasthi)
- [ ] Repo URL pasted into Devpost
- [ ] Upload `docs/shipaton-assets/icon-1024.png` (1024×1024)
- [ ] Upload at least `docs/shipaton-assets/05-paywall.png` at 1179×2556 with no device frame (see `docs/shipaton-assets/README.md`)
- [ ] Optional gallery: `01-today.png`, `02-capture.png`, `03-library.png`, `04-ask.png`, same size, no frames
- [ ] Demo video is public or unlisted on YouTube or Vimeo, **2 minutes or less**, shot on a device or simulator
- [ ] Video shows the real app and a Test Store purchase from the Recall paywall
- [ ] Paste the video URL
- [ ] Paste the **RevenueCat project id** from the RevenueCat dashboard (Project settings). This is not the Expo `projectId` in `apps/mobile/app.json`
- [ ] Paste the description above
- [ ] Do not add store listing URLs
- [ ] Submit before 30 September 2026, 11:45pm PDT

## Demo script (about 1 minute 45 seconds)

Film in one take on a development build that has the Test Store key. Sign in as a user who does **not** already have Kairos Pro. Have one saved memory so Ask is not empty. Record the whole phone or simulator, with no device frame in post.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00–0:12 | Launch into **Today**. Show the greeting and one saved memory. | “Kairos keeps what I capture, then lets me ask it back in plain language.” |
| 0:12–0:28 | Open **Capture**, save a short note, return to Today or Library so it appears. | “A note, a file, or a voice memo lands in my library and becomes part of memory.” |
| 0:28–0:48 | Open **Ask**. Send one question. Show the answer. | “Ask is grounded in those memories, not a blank chatbot.” |
| 0:48–1:05 | Open **Library** and show the new note next to older ones. | “Everything I saved stays browsable, by time and by topic.” |
| 1:05–1:35 | From Today, tap **Recall**. The paywall fills the screen: Kairos Pro, price, **Start Kairos Pro**. Tap it. Complete the RevenueCat **Test Store** purchase until it succeeds. | “Recall is Kairos Pro. RevenueCat’s Test Store sells the recall entitlement. The purchase is a real RevenueCat flow, and the server records Pro from RevenueCat, not from the phone.” |
| 1:35–1:50 | After unlock, show Recall no longer blocked. End on that screen. | “That’s Kairos. Memory you can ask, and Recall when you need it.” |

Stop before 2:00. If the Test Store sheet is slow, cut the Capture shot shorter. Do not cut the paywall or the purchase confirmation.

### If the paywall does not appear

Recall only paywalls when `recall` is inactive. Use another Test Store user, or expire the entitlement in RevenueCat. Confirm `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` is the Test Store **public** key and the binary is a dev build (`__DEV__`). Expo Go will not load the purchases SDK.
