# Eye Relief — 20-20-20 Green Overlay

A lightweight Manifest V3 Chrome extension that helps protect your eyes using the **20-20-20 rule**: every **20 minutes** of screen time, a soothing full-screen green overlay appears over your active web pages for **20 seconds**, prompting you to look 20 feet away until the countdown completes.

## Features

- **Automatic 20-20-20 Timer**: Tracks screen time continuously in the background with a live badge countdown (`20m`, `BRK`, `OFF`).
- **Forced Green Overlay**: Displays an isolated, full-viewport emerald overlay across web pages (`strictMode` enabled by default so there is no skip button on the page until the 20-second countdown reaches `0s`).
- **Desktop Notification & Optional Chime**: Shows a desktop notification when the screen timer finishes and plays your notification chime (can be muted anytime with the **Notification Sound** toggle in the popup).
- **Custom Durations & Strict Mode Toggle**: Configure screen time limits (`1–120` minutes), break duration (`5–300` seconds), notification sound, and whether an emergency skip button is allowed on the overlay.
- **Instant Test Button**: Click **Force Green Overlay Now** in the popup to trigger the green break overlay immediately.
- **Daily Break Counter**: Tracks how many 20-second eye breaks you have completed today locally in browser storage.

## Installation (Unpacked in Chrome / Edge / Brave)

1. Open `chrome://extensions` in your browser.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`c:\Users\admin\Desktop\Projects\Eye Relief`).
5. Pin **Eye Relief — 20-20-20 Green Overlay** to your toolbar to watch the badge timer and open controls.

## Testing Immediately

1. Open any regular website (e.g., `https://example.com` — note that browser internal pages like `chrome://` do not allow extension overlays).
2. Click the **Eye Relief** toolbar icon.
3. Click **Force Green Overlay Now** (or temporarily set **Screen Time Limit** to `1` min) to see the full-screen green overlay and 20-second countdown in action.

## Project Structure

- `manifest.json` — Extension manifest (Manifest V3)
- `background/service-worker.js` — Alarm-backed timer and storage state management
- `content/overlay.js` — Isolated Shadow DOM top-layer green break overlay
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js` — Toolbar popup UI and settings
- `icons/` — `16x16`, `48x48`, and `128x128` PNG icons
- `CHROMEWEBSTORE.md` — Chrome Web Store listing, permission justifications, and privacy notes
