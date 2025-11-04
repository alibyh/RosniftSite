# 🗺️ Mapbox Setup Guide

## Quick Start

1. **Get a free Mapbox Access Token:**
   - Go to: https://account.mapbox.com/
   - Sign up (free account includes 50,000 map loads per month)
   - Go to: https://account.mapbox.com/access-tokens/
   - Copy your default public token (or create a new one)

2. **Add your token to the project:**

   **Option A: Environment Variable (Recommended)**
   - Create a `.env` file in the project root:
   ```
   VITE_MAPBOX_ACCESS_TOKEN=your_token_here
   ```
   - Restart your dev server after adding the token

   **Option B: Direct in Code (Quick Test)**
   - Edit `src/services/mapboxService.ts`
   - Replace `YOUR_MAPBOX_ACCESS_TOKEN` with your actual token:
   ```typescript
   const MAPBOX_API_KEY = 'pk.your_actual_token_here';
   ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

4. **That's it!** Your map should now work.

---

## Mapbox Features

✅ **Free Tier Includes:**
- 50,000 map loads per month
- Geocoding API (100,000 requests/month)
- Directions API (100,000 requests/month)
- Beautiful, modern maps
- Works worldwide (including Russia)

✅ **No HTTP Referer restrictions needed**
✅ **No complex API key configuration**
✅ **Simple setup process**

---

## Troubleshooting

### Map not loading?
- Check that your access token is correct
- Make sure you added `VITE_MAPBOX_ACCESS_TOKEN` to `.env` file
- Restart dev server after adding token
- Check browser console for errors

### Route not showing?
- Check that both addresses are geocoded successfully (check console logs)
- Verify your token has Directions API enabled (it should by default)

### Geocoding not working?
- Check that your token has Geocoding API enabled
- Verify addresses are in correct format
- Check console for error messages

---

## Map Styles

You can change the map style in `ProductDetails.tsx`:

```typescript
// Current style (line 50):
style: 'mapbox://styles/mapbox/streets-v12'

// Other available styles:
'mapbox://styles/mapbox/light-v11'      // Light theme
'mapbox://styles/mapbox/dark-v11'        // Dark theme
'mapbox://styles/mapbox/satellite-v9'    // Satellite imagery
'mapbox://styles/mapbox/navigation-day-v1' // Navigation style
'mapbox://styles/mapbox/navigation-night-v1'
```

---

## API Limits

**Free Tier:**
- Map loads: 50,000/month
- Geocoding: 100,000 requests/month
- Directions: 100,000 requests/month

If you exceed limits, you'll need to upgrade to a paid plan.

---

## Security Note

**For Production:**
- Never commit your `.env` file to git
- Add `.env` to `.gitignore`
- Use environment variables in your CI/CD pipeline
- For GitHub Pages, use repository secrets or environment variables

---

## Need Help?

- Mapbox Documentation: https://docs.mapbox.com/
- Mapbox GL JS Docs: https://docs.mapbox.com/mapbox-gl-js/
- Support: https://support.mapbox.com/

---

## Migration from Yandex

✅ **What's Different:**
- No more API key configuration issues
- No HTTP Referer restrictions
- Simpler setup
- Better international support
- Modern, beautiful maps

✅ **What's the Same:**
- Same functionality (geocoding, routing, markers)
- Same UI/UX
- Same features

---

Enjoy your new Mapbox integration! 🎉

