
# 📚 LuxeTime Watches — How to Update Your Master Watch References

---

## ✅ 1️⃣ Your master JSON file

All watch reference data is managed in:
```
master_references_skydweller_dials_bracelet_corrected.json
```

**📂 Location:**  
Place this file in:
```
C:\Watch LookUp\
```

This file holds **ALL references** you want in your MongoDB cluster.

---

## ✅ 2️⃣ Add new watches safely

- Open `master_references_skydweller_dials_bracelet_corrected.json` in your text editor.
- To add a new reference:
  - Add a new JSON object for **each watch**.
  - If the same reference has multiple dials, **merge them into a single record** using:
    ```
    "dial": "Chocolate, Sundust, Blue"
    ```
- Do **not remove** any rows unless you intentionally want to delete that watch from the master copy.
- Always **group dials and bracelet variations** in the same row for a single reference.

---

## ✅ 3️⃣ Upsert your JSON into MongoDB Atlas

Use your safe upsert script:
```
load_json_to_mongo.js
```

This file reads:
```
master_references_skydweller_dials_bracelet_corrected.json
```

It connects to your MongoDB Atlas cluster:
```
mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster
```

---

## ✅ 4️⃣ Run the script

Open Command Prompt:

```
cd "C:\Watch LookUp"
node load_json_to_mongo.js
```

✅ This will:
- Upsert each reference by `reference` number.
- Update any changed fields.
- Add new references if they don’t exist yet.
- **NEVER delete** watches not listed in the file.

---

## ✅ 5️⃣ Confirm your lookup is live

Your Netlify lookup function reads directly from your Atlas cluster:
```
https://luxetimewatches-lookup.netlify.app/
```

Once upserted → the new references are instantly searchable!

---

## 🏆 Keep this as your master flow — your LuxeTime watch data stays complete, clean & safe!
