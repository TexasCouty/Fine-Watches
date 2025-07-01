
# 🚀 LuxeTime Watches Lookup — Full Startup & Deploy Cheat Sheet

This single file keeps **every step** for rebooting and reconnecting **GitHub, MongoDB Atlas, and Netlify** in one place.

---

## ✅ 1️⃣ Open your project folder

```
cd "C:\Watch LookUp"
```

---

## ✅ 2️⃣ Confirm your Git remote

```
git remote -v
```

✅ Should show:
```
origin  https://github.com/TexasCouty/Fine-Watches.git (fetch)
origin  https://github.com/TexasCouty/Fine-Watches.git (push)
```

If not:
```
git remote add origin https://github.com/TexasCouty/Fine-Watches.git
```

---

## ✅ 3️⃣ Sync with GitHub

```
git pull origin main --allow-unrelated-histories
git status
```

---

## ✅ 4️⃣ Make changes → stage → commit → push

```
git add .
git commit -m "Your commit message"
git push origin main
```

✅ **This auto-triggers your Netlify deploy.**

---

## ✅ 5️⃣ MongoDB Atlas — Exact URI

Use this to test, connect, or upsert:
```
mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster
```

---

## ✅ 6️⃣ Reload your JSON into MongoDB

```
node load_json_to_mongo.js
```

Your `load_json_to_mongo.js` already uses the correct URI.

---

## ✅ 7️⃣ (Optional) Test Netlify functions locally

```
netlify dev
```

Test:
```
http://localhost:8888/.netlify/functions/lookup?ref=336935
```

---

## ✅ 8️⃣ Check your live site

```
https://luxetimewatches-lookup.netlify.app/
```

---

## 🏆 Done

Your **full pipeline**:
- ✅ GitHub remote → origin
- ✅ Mongo Atlas connection → verified
- ✅ Netlify auto-deploy → verified

Keep this file forever → you’ll always know **what to run**!

🔥 **LuxeTime Watches Lookup** — Always On. Always Luxury. 🔥
