# SSS Payroll Web — Deployment Guide

## One-time setup (5 minutes)

### Step 1 — Install dependencies locally
Open this folder in a terminal and run:
```
npm install
npm run dev
```
Open http://localhost:5173 to test locally.

### Step 2 — Push to GitHub
1. Go to https://github.com and create a free account (if you don't have one)
2. Click "New repository" → name it `sss-payroll` → Create
3. Run in terminal (inside the sss-payroll-web folder):
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sss-payroll.git
git push -u origin main
```

### Step 3 — Deploy on Vercel (free HTTPS hosting)
1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project" → Import your `sss-payroll` repository
3. Framework: **Vite** (auto-detected)
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = `https://cjbelvyshgaqagrqmiym.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (copy from your .env file)
5. Click **Deploy**

Your live URL will be: `https://sss-payroll.vercel.app` (or similar)

### Step 4 — Add user accounts
1. Open your live URL
2. Click "Sign up" to create accounts for each team member
3. Share the URL with your colleagues — they sign in with their own email/password

## What's secured
- All data requires login (Supabase Row Level Security)
- HTTPS enforced by Vercel
- Each save is tagged with the user's email
- Real-time sync: all users see changes instantly

## Updating the app
Just push changes to GitHub — Vercel auto-deploys in ~30 seconds.
