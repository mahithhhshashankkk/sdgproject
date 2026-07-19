# SuryaSetu — Solar Pump Service Ecosystem

India's Smart Solar Pump Service platform connecting farmers, technicians, vendors, and admins.

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # outputs to dist/
npm run typecheck  # TypeScript check
```

The build is a static SPA in `dist/` — deploy it to any static host.

## Environment variables

Two variables are required at **build time** (Vite inlines them into the JS bundle):

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Copy `.env.example` to `.env` for local dev. For hosting platforms (Vercel, Netlify, etc.), add both as environment variables in the dashboard **before deploying** — the `.env` file is gitignored and will not be deployed.

If these are missing, the app shows a "Configuration missing" screen instead of a blank page.

## Deploy

### Vercel
1. Import the repo
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
3. Deploy — `vercel.json` is already configured

### Netlify
1. New site from Git
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
3. Deploy — `netlify.toml` is already configured

### Any static host
Run `npm run build` and serve the `dist/` folder. Ensure env vars are set before building.
