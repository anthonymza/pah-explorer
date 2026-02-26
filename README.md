# PAH Vapor Pressure Explorer

Interactive vapor pressure vs temperature explorer for polyaromatic hydrocarbons, using the Antoine equation. Works as a responsive web app and can be added to your iPhone home screen as a PWA.

## Features
- 14 PAH compounds with Antoine equation constants
- Interactive temperature & reference pressure sliders
- Log/linear y-axis toggle
- Live data table with boiling point estimates
- Responsive: full desktop layout + mobile tab navigation
- iOS PWA support (add to home screen)

---

## Running Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Deploy to Vercel (Recommended — Free)

### Option A: Vercel CLI
```bash
npm install -g vercel
vercel
```
Follow the prompts. Your app will be live at a `*.vercel.app` URL in ~60 seconds.

### Option B: Vercel Web UI (no CLI needed)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → "Add New Project"
3. Import your repo → click Deploy
4. Done — auto-deploys on every push

---

## Deploy to Netlify (Alternative — also Free)

### Option A: Drag & Drop
```bash
npm run build
```
Then drag the `dist/` folder to https://app.netlify.com/drop

### Option B: Netlify CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir dist
```

---

## Add to iPhone Home Screen (PWA)

1. Open your deployed URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Scroll down → tap **"Add to Home Screen"**
4. Tap **Add**

The app will launch fullscreen from your home screen, just like a native app. Works offline after first load.

---

## Project Structure

```
pah-explorer/
├── index.html          # Entry point with PWA meta tags
├── vite.config.js      # Vite build config
├── package.json
└── src/
    ├── main.jsx        # React root
    ├── App.jsx         # Main application
    └── index.css       # Global reset + base styles
```

---

## Customizing Antoine Constants

Edit the `PAH_DATA` object in `src/App.jsx`. Each entry takes:
```js
"Compound Name": { A, B, C, Tm, Tb, MW }
```
Where `A`, `B`, `C` are Antoine constants for `log10(P/mmHg) = A - B/(C + T°C)`.
