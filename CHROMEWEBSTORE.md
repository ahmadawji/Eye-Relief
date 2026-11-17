# Chrome Web Store Listing — Eye Relief — 20-20-20 Green Overlay

> Last Updated: 2026-11-17

## Store Listing

**Extension Name** [REQUIRED]
Eye Relief — 20-20-20 Green Overlay

**Short Description** [REQUIRED]
Enforces the 20-20-20 eye-care rule with a full-screen soothing green overlay every 20 minutes until your 20-second break finishes.

**Detailed Description** [REQUIRED]
Eye Relief helps prevent digital eye strain by enforcing the 20-20-20 rule while you browse: every 20 minutes of screen time, look at something 20 feet away for 20 seconds.

Key Features
- Automatic 20-minute countdown timer with a live minutes indicator on your toolbar icon
- Full-screen soothing green break overlay that appears across open web pages when screen time expires
- Strict enforcement mode by default so the green screen stays locked until the 20-second countdown completes automatically
- Optional flexible mode with an emergency skip button if you need to override a break
- Customizable screen time limits (1–120 minutes) and break lengths (5–300 seconds)
- Immediate "Force Green Overlay Now" button to test or start an eye break anytime
- Daily break counter to help you build a healthy viewing habit

How to Use It
1. Install Eye Relief and pin it to your browser toolbar so you can see your remaining screen time at a glance.
2. Browse normally while the timer counts down from 20 minutes (or your custom interval).
3. When your screen time reaches zero, a calming green overlay covers your web pages for 20 seconds while you rest your eyes and look into the distance.
4. Once the 20-second countdown reaches zero, the overlay disappears automatically and your next 20-minute cycle begins.

Privacy Note
Eye Relief works completely offline on your device. It does not read page content, track browsing history, or transmit any data to external servers.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Reminds and enforces periodic 20-second eye breaks with a full-screen green overlay based on the 20-20-20 rule.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Capture the full-screen green 20-20-20 overlay active over a webpage showing the 20-second countdown ring and strict lock badge.
- Screenshot 2: Capture the toolbar popup open showing the live circular countdown timer, Pause/Reset/Force Overlay controls, and custom duration settings.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Stores user preferences (work interval, break duration, strict mode, enabled state), active timer timestamps, and the local count of breaks completed today so settings and timer progress persist across browser sessions. |
| `alarms` | permissions | Schedules reliable background timer events to trigger the 20-minute screen time expiration and 20-second break completion transitions as well as periodic toolbar badge updates. |
| `scripting` | permissions | Injects the green break overlay script into already-open web tabs immediately upon extension installation or update so users do not need to reload existing tabs for protection to take effect. |
| `notifications` | permissions | Displays a desktop notification when the screen timer expires so the user is alerted even if they are viewing a non-web tab or another application. |
| `offscreen` | permissions | Plays the custom break notification chime cleanly in the background when the user has notification sounds enabled. |
| `<all_urls>` | host_permissions | Allows the extension to display the full-screen green 20-20-20 break overlay on whichever website the user is actively viewing when their screen time limit is exceeded. No page content is collected or modified beyond rendering the temporary break overlay. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
<!-- Host a plain-English privacy policy stating that Eye Relief stores timer preferences locally and collects/transmits zero user data. -->

## Distribution

**Visibility**: Public
**Regions**: All regions

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-11-17 | Initial release implementing the 20-20-20 forced green overlay, popup timer controls, customizable intervals, and strict enforcement mode. | Draft |
