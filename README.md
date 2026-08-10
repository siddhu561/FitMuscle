# FitTrack v3

A polished, privacy-first installable mobile web app for simple daily wellness tracking.

## Included
- Daily weight, calories, water, exercise and optional notes
- Optional daily progress photo
- 7-day weight trend chart
- Daily target progress bars
- Streak based on actual check-ins
- Weekly review with averages and practical observations
- Progress-photo timeline
- Full history with edit/delete
- Local-only data storage
- Offline-ready PWA
- Home-screen install prompt
- Weekly text export
- Safer coaching language: no diagnosis, body-fat claims, or aggressive diet instructions

## Important implementation notes
- Data is stored locally in the browser using localStorage.
- Photos are compressed before storage to reduce storage usage.
- No API key or backend is included.
- Browser notification permission is requested only when the user taps Enable notifications.
- The calorie/water targets are user-entered tracking targets, not medical recommendations.

## Install on a phone
1. Host the folder on HTTPS (GitHub Pages, Netlify, Vercel, etc.).
2. Open the site on your phone.
3. Tap Install when the banner appears, or use the browser's Add to Home Screen option.
4. The service worker enables offline use after the first successful load.

## Data compatibility
FitTrack v3 keeps the existing v2 localStorage keys so existing v2 entries can be loaded automatically.
