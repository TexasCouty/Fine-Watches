# Fine Watches Reference Lookup

This project is a simple reference lookup tool for luxury watches, using:
- **Netlify Functions** for a secure backend API.
- **MongoDB Atlas** for storing watch references.
- A clean, responsive **HTML frontend**.

## 🔍 How it works

- Enter a watch reference number (partial or complete).
- The site calls a serverless function: `/.netlify/functions/lookup`.
- The function queries MongoDB Atlas with a `$regex` search.
- Results are displayed nicely on the page.

## 🚀 Tech stack

- Netlify Functions (Node.js serverless API)
- MongoDB Atlas (cloud database)
- Plain HTML, CSS, JS frontend
- GitHub → Netlify deploy pipeline

## 📂 Project structure

