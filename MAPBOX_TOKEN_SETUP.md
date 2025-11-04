# 🗺️ Mapbox Access Token Setup Guide

## ✅ Quick Steps to Get Your Free Token

### Step 1: Create Mapbox Account
1. Go to: **https://account.mapbox.com/**
2. Click **"Sign up"** (or log in if you already have an account)
3. Sign up with your email or GitHub account (free)

### Step 2: Get Your Access Token
1. After signing up, you'll be redirected to your account
2. Go to: **https://account.mapbox.com/access-tokens/**
3. You'll see your **Default Public Token** (starts with `pk.`)
4. **Click "Copy"** to copy the token

### Step 3: Add Token to Your Project

**Option A: Using .env file (Recommended)**
1. Open the file: `.env` in the project root
2. Replace `your_mapbox_access_token_here` with your actual token:
   ```
   VITE_MAPBOX_ACCESS_TOKEN=pk.your_actual_token_here
   ```
3. Save the file
4. **Restart your dev server** (stop and run `npm run dev` again)

**Option B: Direct in Code (Quick Test)**
1. Open: `src/services/mapboxService.ts`
2. Find line 4:
   ```typescript
   const MAPBOX_API_KEY = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN';
   ```
3. Replace with:
   ```typescript
   const MAPBOX_API_KEY = 'pk.your_actual_token_here';
   ```
4. Save and refresh browser

### Step 4: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 5: Test!
- Navigate to a product details page
- The map should load with Mapbox
- You should see yellow markers and route line

---

## 🎯 What Your Token Looks Like

Your Mapbox access token will look like:
```
pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsb3h4eHh4eHgiLCJhIjoiY2xveHh4eHh4eCJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

It starts with `pk.` followed by a long string.

---

## 🔒 Security Notes

**For Development:**
- ✅ Safe to use in `.env` file (just don't commit it to git)
- ✅ The `.env` file should already be in `.gitignore`

**For Production:**
- ✅ Use environment variables in your hosting platform
- ✅ Never commit tokens to git
- ✅ Use different tokens for development and production

---

## 📊 Free Tier Limits

**Mapbox Free Tier Includes:**
- ✅ **50,000 map loads** per month
- ✅ **100,000 geocoding requests** per month  
- ✅ **100,000 directions requests** per month
- ✅ Perfect for development and small projects!

---

## ❓ Troubleshooting

### Token not working?
1. Make sure you copied the **entire token** (it's long!)
2. Check there are **no spaces** before/after the token
3. Make sure you **restarted the dev server** after adding the token
4. Check the browser console for error messages

### Still seeing "Mapbox access token не настроен"?
1. Check that `.env` file exists in project root
2. Check that token starts with `pk.`
3. Restart dev server completely
4. Hard refresh browser (Ctrl+Shift+R)

### Need to create a new token?
1. Go to: https://account.mapbox.com/access-tokens/
2. Click **"Create a token"**
3. Give it a name (e.g., "Rosneft Site")
4. Set scopes (defaults are usually fine):
   - ✅ Maps:Read
   - ✅ Geocoding:Read
   - ✅ Directions:Read
5. Click **"Create token"**
6. Copy the new token
7. Update your `.env` file

---

## 🎉 You're Done!

Once you've added your token and restarted the server, your Mapbox maps will work perfectly!

Need help? Check the browser console for any error messages.

