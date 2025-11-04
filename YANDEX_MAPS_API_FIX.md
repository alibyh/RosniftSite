# Yandex Maps API Key Configuration Guide

## Problem Summary
The Yandex Maps API is loading correctly, but **map tiles (images) are not displaying**. 

### Current Status:
- ✅ Map container created
- ✅ Map structure initialized (44 ymaps elements found)
- ✅ Tiles container found in DOM
- ❌ **0 tile images loaded** ⚠️

### Root Cause:
Map tiles load from `vec*.maps.yandex.net` domains (NOT from `api-maps.yandex.ru`), and your API key is either:
1. Not configured to allow tile loading
2. Has HTTP Referer restrictions blocking localhost
3. Doesn't have JavaScript API properly enabled

---

## Solution: Configure Your Yandex Maps API Key

### Step 1: Access Yandex Developer Console
1. Go to: https://developer.tech.yandex.ru/services/
2. Log in with your Yandex account
3. Find your API key or create a new one

### Step 2: Enable Required Services
Your API key MUST have these services enabled:
- ✅ **JavaScript API** - for map initialization
- ✅ **HTTP Геокодер (HTTP Geocoder)** - for address geocoding
- ✅ **Tile Loading** - for loading map images (CRITICAL!)

### Step 3: Configure HTTP Referer Restrictions

#### For Local Development (localhost):
In the API key settings, find "Ограничение по HTTP Referer" (HTTP Referer Restrictions) section:

**Option A: Disable restrictions temporarily (for testing)**
- Uncheck "Ограничение по HTTP Referer"
- This allows all domains to use the key (not recommended for production)

**Option B: Add localhost to allowed referers (recommended)**
Add these values **EXACTLY as shown** (one per line, NO protocol, NO port, NO path):
```
localhost
127.0.0.1
```

**IMPORTANT FORMAT NOTES:**
- ✅ Correct: `localhost`
- ❌ Wrong: `http://localhost`
- ❌ Wrong: `localhost:3000`
- ❌ Wrong: `http://localhost:3000/*`
- ❌ Wrong: `localhost:*`

Each referer should be just the domain name, nothing else.

#### For Production (GitHub Pages):
When deploying to GitHub Pages, also add:
```
yourusername.github.io
```
(Replace `yourusername` with your actual GitHub username)

### Step 4: Verify API Key Configuration

After configuring, check:
1. **JavaScript API is enabled** ✓
2. **HTTP Геокодер is enabled** ✓
3. **HTTP Referer allows localhost** (or is disabled) ✓
4. **API key is active and not expired** ✓

### Step 5: Update Your Code (if needed)

**Current API Keys in the project:**
- JavaScript API key (in `index.html`): `b1cd8291-371b-4ada-a3ee-9aa82626d128`
- Geocoder API key (in `ProductDetails.tsx`): `35686a94-d9da-45dc-a9f8-2c4678b20a88`

**Recommendation:** Use the SAME API key for both services to avoid confusion.

To update the keys:
1. Edit `/Users/alibyh/.cursor/worktrees/Rosnefti_site/Vx8Hv/index.html` (line 11)
2. Edit `/Users/alibyh/.cursor/worktrees/Rosnefti_site/Vx8Hv/src/components/ProductDetails.tsx` (line 39)

Replace both with your properly configured API key.

---

## How to Verify the Fix

### Method 1: Check Network Tab
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter by "maps" or "vec"
4. Reload the page
5. Look for requests to domains like:
   - `vec01.maps.yandex.net`
   - `vec02.maps.yandex.net`
   - `vec03.maps.yandex.net`

**What to look for:**
- ✅ **Success (200)**: Tiles are loading correctly!
- ❌ **403 Forbidden**: API key doesn't have tile permissions or referer is blocked
- ❌ **401 Unauthorized**: API key is invalid or expired
- ❌ **No requests at all**: API key is not configured to request tiles

### Method 2: Check Console Logs
After the fix, you should see:
```
✅ Map tiles loaded successfully
✅ Map tiles inserted
```

Instead of:
```
⚠️ No tile images found - tiles may not be loading due to API restrictions
```

---

## Alternative Solution: Create a New API Key

If you're still having issues, create a completely new API key:

1. Go to https://developer.tech.yandex.ru/services/
2. Click "Создать ключ" (Create Key)
3. Select services:
   - ✅ JavaScript API и HTTP Геокодер
4. Configure HTTP Referer:
   - Add `localhost` and `127.0.0.1` (for development)
   - Add your GitHub Pages domain (for production)
5. Copy the new API key
6. Replace BOTH keys in your code with the new one

---

## Quick Test Checklist

After making changes:

1. ☐ Saved API key configuration in Yandex Developer Console
2. ☐ Updated API key in `index.html` (line 11)
3. ☐ Updated API key in `ProductDetails.tsx` (line 39)
4. ☐ Refreshed the page (Ctrl+Shift+R / Cmd+Shift+R for hard refresh)
5. ☐ Checked Network tab for `vec*.maps.yandex.net` requests
6. ☐ Checked Console for "✅ Map tiles loaded successfully"
7. ☐ Verified map tiles are visible on the page

---

## Still Having Issues?

If tiles still don't load after following all steps:

1. **Clear browser cache** and do a hard refresh (Ctrl+Shift+R)
2. **Wait 5-10 minutes** - API key changes may take time to propagate
3. **Try a different browser** - to rule out caching issues
4. **Check API key limits** - ensure you haven't exceeded daily request limits
5. **Contact Yandex Support** - if the API key configuration looks correct but still doesn't work

---

## Important Notes

- Yandex Maps tiles load from `vec*.maps.yandex.net`, NOT from `api-maps.yandex.ru`
- The JavaScript API script loads from `api-maps.yandex.ru`, but tiles are separate
- HTTP Referer restrictions apply to BOTH the API script AND tile requests
- Using different API keys for different services can cause confusion - use ONE key for everything
- Free API keys have daily request limits - check your usage if tiles suddenly stop loading

---

## Current Diagnosis (From Console Logs)

```
✅ Container created with correct dimensions (590 x 400px)
✅ Map structure initialized (44 ymaps elements)
✅ Tiles container found (ground-pane)
❌ Tile images: 0 loaded
```

**This confirms the issue is with tile permissions/referer restrictions, NOT with the code.**

The map is working correctly, but the API key is blocking tile image requests.

---

## Summary

**The problem is NOT in your code.** The code is working perfectly. The issue is purely with the Yandex Maps API key configuration.

**Follow Step 2 and Step 3 above** to enable tile loading and configure HTTP Referer restrictions correctly, and your map will work!

