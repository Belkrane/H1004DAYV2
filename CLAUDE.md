# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**H1004DAY** — A static mobile wedding invitation website hosted on GitHub Pages.

- **Stack:** Pure HTML5 / CSS3 / Vanilla JS (no frameworks, no build step)
- **Hosting:** GitHub Pages (push to `main` branch → live at `https://<user>.github.io/H1004DAY/`)
- **Entry point:** `index.html`

## File Structure

```
index.html   — All page sections (hero, greeting, calendar, map, bus, guestbook, RSVP)
style.css    — Mobile-first responsive styles, CSS variables for theme
script.js    — Calendar rendering, guestbook (localStorage), RSVP form, map buttons
```

## Design System

CSS custom properties are defined in `:root` inside `style.css`. Change colors/fonts there — don't scatter raw values.

| Variable | Purpose |
|---|---|
| `--color-primary` | Cream/ivory background |
| `--color-accent` | Dusty rose (buttons, highlights) |
| `--color-secondary` | Soft blue (accents) |
| `--font-korean` | Noto Serif KR (Google Fonts) |

## Key Customization Points

**Wedding details** — all concentrated in the `CONFIG` object at the top of `script.js`:
```js
const CONFIG = {
  groomName, brideName, weddingDate, weddingTime, venueName, venueAddress, ...
}
```

**Map links** — Update `kakaoMapUrl` and `naverMapUrl` in the CONFIG with real coordinates.

**RSVP form** — Form action points to a Formspree endpoint. Replace `YOUR_FORM_ID` in `index.html` with the actual Formspree form ID.

**Guestbook** — Stored in `localStorage` (device-local). For cross-device persistence, replace the `saveGuestbookEntry()` / `loadGuestbookEntries()` functions in `script.js` with calls to a backend (e.g., Firebase Firestore, Supabase).

## GitHub Pages Deployment

```bash
git add .
git commit -m "Update wedding details"
git push origin main
```

Then enable Pages: Repository → Settings → Pages → Source: `main` branch, `/ (root)`.
