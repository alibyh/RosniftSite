# 🔑 Fix: Create Correct Yandex Maps API Key

## 🎯 The Problem

Your current API key (`b1cd8291-371b-4ada-a3ee-9aa82626d128`) has:
- ✅ Correct HTTP Referer settings (`localhost`)
- ✅ API is working (52 calls, 196 geocoder calls, 63 router calls)
- ❌ **But tiles aren't loading (0 custom map downloads)**

**Root Cause:** Your API key is likely created for the **wrong service** (possibly Static API or Geocoder-only instead of JavaScript API).

---

## ✅ Solution: Create New API Key with Correct Service

### Step 1: Go to Yandex Developer Console
URL: https://developer.tech.yandex.ru/services/

### Step 2: Create New API Key

1. Look for button **"Подключить API"** or **"Создать ключ"** and click it

2. **CRITICAL:** You will see a list of services. Select:
   ```
   ✅ JavaScript API и HTTP Геокодер
   ```
   
   **DO NOT select:**
   - ❌ "Static API"
   - ❌ "HTTP Геокодер" (alone)
   - ❌ Any other service
   
3. Click **"Создать"** or **"Подключить"**

### Step 3: Configure the New API Key

After creating the key, you'll see settings:

#### HTTP Referer Settings:
In **"Ограничение по HTTP Referer"** field, add (one per line):
```
localhost
127.0.0.1
```

#### IP Address Settings (Optional):
You can either:
- **Option A:** Leave **"Ограничение по IP-адресам"** empty (more flexible)
- **Option B:** Keep `127.0.0.1` if you want to restrict to localhost only

**Recommendation:** Leave it empty for easier development.

### Step 4: Copy Your New API Key
The new key will look something like:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Copy it to your clipboard.

### Step 5: Update Your Code

You need to replace the old API key in **TWO places**:

#### Place 1: index.html (line 11)
**File:** `/Users/alibyh/.cursor/worktrees/Rosnefti_site/Vx8Hv/index.html`

Change line 11 from:
```html
src="https://api-maps.yandex.ru/2.1/?apikey=b1cd8291-371b-4ada-a3ee-9aa82626d128&lang=ru_RU&load=package.full"
```

To:
```html
src="https://api-maps.yandex.ru/2.1/?apikey=YOUR_NEW_API_KEY_HERE&lang=ru_RU&load=package.full"
```

#### Place 2: ProductDetails.tsx (line 40)
**File:** `/Users/alibyh/.cursor/worktrees/Rosnefti_site/Vx8Hv/src/components/ProductDetails.tsx`

Change line 40 from:
```typescript
const API_KEY = 'b1cd8291-371b-4ada-a3ee-9aa82626d128';
```

To:
```typescript
const API_KEY = 'YOUR_NEW_API_KEY_HERE';
```

**Important:** Use the **SAME** API key in both places!

### Step 6: Update test-map.html (Optional)
**File:** `/Users/alibyh/.cursor/worktrees/Rosnefti_site/Vx8Hv/test-map.html`

Change line 11 to use your new API key as well.

### Step 7: Test!

1. **Save all files**

2. **Restart your dev server:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

3. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   - Or just use Incognito mode

4. **Test with test-map.html:**
   Open: `http://localhost:3000/test-map.html`
   
   You should see:
   - ✅ Map with tiles visible
   - ✅ Console: "✅ Map tiles loaded successfully"
   - ✅ Network tab: Successful requests to `vec*.maps.yandex.net`

5. **Test your main app:**
   - Login to your app
   - Go to Marketplace
   - Click on a product
   - **You should see the map with route!** 🎉

---

## 📊 How to Verify Correct Service

After creating the new key, check your API key page in Yandex Developer Console.

You should see the service name at the top:
```
✅ JavaScript API и HTTP Геокодер
```

If you see anything else, you created the key for the wrong service.

---

## 🔍 Why Your Old Key Doesn't Work

Your statistics show:
- ✅ API calls: 52 (map initialization works)
- ✅ Geocoder calls: 196 (address geocoding works)
- ✅ Router calls: 63 (route calculation works)
- ❌ **Map downloads: 0** (tiles not loading!)

This pattern indicates:
- The JavaScript API is loading
- Geocoding is working
- Route calculation is working
- **BUT** the tile rendering service is not available

This happens when:
1. The API key is created for the wrong service type
2. OR the key doesn't have tile loading permissions
3. OR there's a billing issue (but unlikely since other services work)

**Solution:** Create a fresh API key with the **"JavaScript API и HTTP Геокодер"** service.

---

## 🎯 Checklist

Before testing, make sure:

- ☐ Created new API key from **"JavaScript API и HTTP Геокодер"** service
- ☐ Added `localhost` and `127.0.0.1` to HTTP Referer restrictions
- ☐ Copied the new API key
- ☐ Updated `index.html` (line 11)
- ☐ Updated `ProductDetails.tsx` (line 40)
- ☐ Updated `test-map.html` (line 11) - optional but recommended
- ☐ Saved all files
- ☐ Restarted dev server
- ☐ Cleared browser cache or used incognito mode
- ☐ Tested with `test-map.html` first
- ☐ Tested main app

---

## 🚨 Common Mistakes to Avoid

1. **Wrong Service Selected**
   - ❌ Selecting "Static API" or "HTTP Геокодер" alone
   - ✅ Must select "JavaScript API и HTTP Геокодер"

2. **Wrong HTTP Referer Format**
   - ❌ `http://localhost:3000`
   - ❌ `localhost:3000`
   - ✅ `localhost` (just the domain)

3. **Not Updating Both Files**
   - Must update API key in BOTH `index.html` AND `ProductDetails.tsx`

4. **Not Restarting Dev Server**
   - Changes to `index.html` require restart

5. **Browser Cache**
   - Old map data might be cached, use incognito or clear cache

---

## 💡 Pro Tips

1. **Keep your old key:** Don't delete the old API key immediately. Test the new one first.

2. **Use environment variables (optional):** For production, consider moving API keys to environment variables:
   ```typescript
   const API_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY || 'fallback-key';
   ```

3. **Add your production domain:** When deploying to GitHub Pages, add to HTTP Referer:
   ```
   localhost
   127.0.0.1
   yourusername.github.io
   ```

4. **Monitor usage:** Check your API key statistics regularly to ensure you're not hitting limits.

---

## ❓ Still Not Working?

If tiles still don't load after creating a new key:

1. **Wait 5-10 minutes:** API key changes can take time to propagate

2. **Double-check the service:** Make sure you selected "JavaScript API и HTTP Геокодер"

3. **Check Network tab:**
   - Look for requests to `vec*.maps.yandex.net`
   - Check response codes (should be 200)
   - If 403: Referer issue
   - If 401: Key issue
   - If no requests: Service issue

4. **Try without restrictions:**
   - Temporarily disable both IP and Referer restrictions
   - If it works, add restrictions back one at a time

5. **Create another key:**
   - Sometimes keys just don't work, create a fresh one

6. **Contact Yandex Support:**
   - If nothing works, there might be an account issue

---

## 🎉 Expected Result

After following these steps, you should see:

### In test-map.html:
- A beautiful map of Moscow with streets and buildings visible
- Yellow marker in the center
- No errors in console

### In your app:
- Product details page shows a map
- Yellow markers on both addresses
- Yellow route line connecting them
- Distance displayed: "Расстояние: X.X км"

### In Network tab:
- Multiple successful (200) requests to:
  - `vec01.maps.yandex.net/tiles/...`
  - `vec02.maps.yandex.net/tiles/...`
  - `vec03.maps.yandex.net/tiles/...`

### In Console:
```
✅ Map tiles loaded successfully
✅ Map tiles inserted
✅ Route distance: 15.3 km
```

---

Good luck! This should definitely fix your issue. 🚀

