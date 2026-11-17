# Eye Relief — 20-20-20 Green Overlay

Give your eyes a break while you browse. **Eye Relief** follows the **20-20-20 rule**: every **20 minutes** of screen time, a soothing full-screen green overlay appears over your open web pages for **20 seconds**, reminding you to look at something 20 feet away until the countdown finishes.

## What You Get

- **Automatic 20-20-20 Timer**: Runs quietly in the background and shows your remaining minutes right on the toolbar icon (`20m`, `BRK`, `OFF`).
- **Forced Green Break Overlay**: Covers your web pages with a calming emerald screen so you actually rest your eyes. Strict Mode is on by default (no skip button until the 20-second countdown reaches `0s`).
- **Break Start & End Alerts**: Displays a desktop notification and plays gentle audio chimes when your break begins and when it finishes—with a **Notification Sound** toggle in the popup if you prefer silence.
- **Customizable Schedule**: Adjust your screen time limit (`1–120` min), break duration (`5–300` sec), Strict Mode, and sound preferences anytime.
- **Instant Break Button**: Need a break right now or want to try it out? Click **Force Green Overlay Now** in the popup.
- **Private & Offline**: Your settings and daily break count stay in your browser. Nothing is tracked or sent anywhere.

## How to Install from GitHub

Chrome, Edge, and Brave cannot load extensions directly from a GitHub URL, so you will download or clone the folder first and load it in Developer mode.

### Option 1: Download ZIP (No Git Required)

1. Open [github.com/ahmadawji/Eye-Relief](https://github.com/ahmadawji/Eye-Relief).
2. Click the green **Code** button → **Download ZIP**.
3. Extract the downloaded `.zip` file to a folder you won't accidentally delete (for example, `Documents/Eye-Relief`).
4. Open `chrome://extensions` in Chrome (or `edge://extensions` / `brave://extensions`).
5. Turn on **Developer mode** using the toggle in the top-right corner.
6. Click **Load unpacked** and select the extracted folder (the one containing `manifest.json`).
7. Pin **Eye Relief — 20-20-20 Green Overlay** to your toolbar so you can see the countdown badge and open settings.

### Option 2: Clone with Git (Easy Updates)

1. Clone the repository to your computer:
   ```bash
   git clone https://github.com/ahmadawji/Eye-Relief.git
   ```
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `Eye-Relief` folder.
3. To get future updates, run `git pull` inside the folder and click the **Reload** icon on Eye Relief in `chrome://extensions`.

## Try It Right Away

1. Open any regular website (such as `https://example.com` — browser system pages like `chrome://` do not allow overlays).
2. Click the **Eye Relief** icon in your browser toolbar.
3. Click **Force Green Overlay Now** to see the green overlay, countdown ring, notification, and chimes in action.
