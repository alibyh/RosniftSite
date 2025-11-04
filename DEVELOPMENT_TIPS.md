# 🔥 Development Tips - Hot Reload & Instant Updates

## ✅ How Vite Hot Module Replacement (HMR) Works

When you run `npm run dev`, Vite automatically:
- ✅ Watches all files in `src/` directory
- ✅ Detects changes instantly
- ✅ Updates the browser automatically (no manual refresh needed!)

## 🚀 Quick Workflow

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Make Changes
- Edit any file in `src/`
- Save the file (Ctrl+S / Cmd+S)
- **Changes appear automatically in browser!**

### 3. No Manual Refresh Needed
- Vite updates the page automatically
- You should see "page reloaded" or component updates instantly

---

## 🐛 Troubleshooting: Changes Not Appearing

### Issue 1: Browser Cache
**Solution:**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox
4. Keep DevTools open while developing

**Or use Hard Refresh:**
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

### Issue 2: File Not Saving
**Solution:**
- Make sure you **save the file** (Ctrl+S / Cmd+S)
- Check the terminal - Vite should show: `[vite] hmr update`

### Issue 3: HMR Not Working
**Solution:**
1. **Check terminal** - You should see:
   ```
   VITE v5.x.x  ready in xxx ms
   
   ➜  Local:   http://localhost:3000/
   ➜  Network: use --host to expose
   ```

2. **If you see errors**, restart dev server:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Issue 4: Changes to .env File
**Solution:**
- `.env` changes require **full restart** (not just HMR)
- Stop server (Ctrl+C)
- Restart: `npm run dev`

### Issue 5: Changes to index.html
**Solution:**
- `index.html` changes also require **full restart**
- Stop and restart dev server

### Issue 6: Changes Not Detected
**Solution:**
1. **Check file path** - Make sure you're editing files in `src/` directory
2. **Check terminal** - Look for file watching errors
3. **Restart dev server**:
   ```bash
   # Stop server
   Ctrl+C
   
   # Clear cache and restart
   rm -rf node_modules/.vite
   npm run dev
   ```

---

## 📝 What Updates Automatically (HMR)

✅ **These update instantly:**
- `src/**/*.tsx` - React components
- `src/**/*.ts` - TypeScript files
- `src/**/*.css` - CSS files
- `src/**/*.js` - JavaScript files

❌ **These require restart:**
- `index.html` - Need full restart
- `.env` - Need full restart
- `vite.config.ts` - Need full restart
- `package.json` - Need full restart

---

## 🎯 Best Practices

### 1. Keep DevTools Open
- Open DevTools (F12) and keep it open
- Check **"Disable cache"** in Network tab
- Watch for errors in Console

### 2. Watch the Terminal
- Vite shows file changes in terminal
- Look for: `[vite] hmr update /src/...`

### 3. Save Files Frequently
- Auto-save can sometimes miss changes
- Manually save (Ctrl+S) to ensure changes are detected

### 4. Check Browser Console
- If changes don't appear, check console for errors
- HMR errors will show in console

---

## 🔍 Verify HMR is Working

### Test It:
1. Open `src/components/ProductDetails.tsx`
2. Change a string (e.g., "Маршрут доставки" → "Маршрут доставки TEST")
3. Save the file
4. **Browser should update instantly** without refresh!

### If it doesn't update:
1. Check terminal for errors
2. Check browser console for errors
3. Try hard refresh (Ctrl+Shift+R)
4. Restart dev server

---

## 💡 Pro Tips

### Tip 1: Use Browser DevTools
- Keep DevTools open with "Disable cache" checked
- This ensures you always see latest changes

### Tip 2: Watch Terminal Output
- Vite shows what files changed
- Look for: `[vite] hmr update`

### Tip 3: Multiple Browser Windows
- If you have multiple browser windows open
- They all update automatically!

### Tip 4: React Fast Refresh
- React components update instantly
- State is preserved (if component doesn't unmount)
- Very fast development!

---

## 🚨 Common Issues & Solutions

### "Changes not appearing"
1. ✅ Check you saved the file
2. ✅ Check terminal for errors
3. ✅ Hard refresh browser (Ctrl+Shift+R)
4. ✅ Restart dev server

### "HMR failed"
1. Check browser console for errors
2. Restart dev server
3. Clear browser cache

### "Still seeing old code"
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Restart dev server
4. Check you're editing the right file

---

## 📚 Quick Reference

| Action | Result |
|--------|--------|
| Edit `src/**/*.tsx` | ✅ Updates instantly |
| Edit `src/**/*.css` | ✅ Updates instantly |
| Edit `.env` | ❌ Requires restart |
| Edit `index.html` | ❌ Requires restart |
| Edit `vite.config.ts` | ❌ Requires restart |

---

**Remember:** Most changes in `src/` update instantly. Only config files need restart! 🚀

