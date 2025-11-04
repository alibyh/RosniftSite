# 🔍 Yandex Maps Billing/Limits Check

## ✅ Good News
Your API key is created for the **correct service**: "JavaScript API и HTTP Геокодер"

## 🚨 Possible Issue: Billing or Limits

You mentioned: **"Израсходовано 196"** (196 used)

### Check 1: Daily Limits
On the page https://developer.tech.yandex.ru/services/, look for:

1. **Лимит в сутки** (Daily limit) - what is the limit?
2. **Израсходовано** (Used) - currently 196

**Question:** What is your daily limit? Is it:
- 25,000 requests per day (free tier standard)?
- Something lower?
- Unlimited?

If your limit is low (e.g., 200-500), you might have hit it!

### Check 2: Billing Status
Look for information about:
- **"Бесплатный с ограничениями"** (Free with limitations)
- Is billing enabled?
- Are there any warnings or error messages?

### Check 3: Service Restrictions
Sometimes the free tier has restrictions on:
- ❌ Tile loading (map images) - **this might be the issue!**
- ✅ API calls (working)
- ✅ Geocoding (working)
- ✅ Routing (working)


