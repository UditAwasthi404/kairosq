# Shipaton asset export

Judges need a 1024×1024 icon and at least one frameless screenshot at **1179×2556**. Do not put a device frame, status-bar mock, or marketing border around the screenshot.

## Icon (ready)

`icon-1024.png` in this folder is a copy of `apps/mobile/assets/icon.png`. Both files are 1024×1024. Upload `icon-1024.png` as the Devpost app icon.

## Screenshots (you still capture these)

Save frameless PNGs here:

| File | Screen |
| --- | --- |
| `01-today.png` | Today |
| `02-capture.png` | Capture |
| `03-library.png` | Library |
| `04-ask.png` | Ask, with a real answer if you have memories |
| `05-paywall.png` | Recall paywall (**Start Kairos Pro** visible) |

`05-paywall.png` is the one that must be in the submission. The others make the gallery obvious.

### iOS Simulator (exact size)

1. Boot an **iPhone 14 Pro** or **iPhone 15 Pro** simulator. That display is 1179×2556.
2. From `apps/mobile`, run the development build (`npm run ios` at the repo root on a Mac).
3. Sign in. Capture one memory so Ask and Library are not empty.
4. Open Recall before purchasing so the paywall is on screen.
5. Save a simulator screenshot with no frame: **File → Save Screen**, or `xcrun simctl io booted screenshot docs/shipaton-assets/05-paywall.png`.
6. Confirm the file is 1179×2556. Do not run it through a framing tool.

Repeat for Today, Capture, Library, and Ask.

### Android only

A phone or emulator screenshot will not already be 1179×2556. Capture the screen with the system screenshot (no bezels), then scale and crop the PNG to exactly 1179×2556. Do not add a device frame. Check the pixel size before uploading. The iOS simulator path above is the one that matches the size without resampling.

The paywall only appears when the signed-in user does not have the `recall` entitlement. Use a fresh Test Store user, or a user who has not bought Kairos Pro yet.
