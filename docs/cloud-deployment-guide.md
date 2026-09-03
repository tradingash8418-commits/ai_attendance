# Contractor AI - 24/7 Cloud Deployment Guide ☁️

Yeh step-by-step tutorial aapko sikhaata hai ki Contractor AI System ko **Vercel** aur **Render** par **100% Free** 24/7/365 live kaise deploy karein, jisse aapka **PC band hone par bhi WhatsApp AI Attendance Humesha Active Rahe**.

---

## 📊 Deployment Architecture

```text
                               +-------------------------------------+
                               |   Meta WhatsApp Cloud API Webhook   |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |        Vercel Cloud Hosting         |
                               |    (Next.js Frontend & Webhooks)    |
                               |  https://contractor-ai.vercel.app   |
                               +-------------------------------------+
                                       /                   \
                                      /                     \
                                     v                       v
                   +-------------------+           +-------------------+
                   | Firebase & Supabase |           | Render AI Service |
                   | (Cloud DB & Media)  |           | (Python YuNet+SFace) |
                   +-------------------+           +-------------------+
```

---

## 🚀 Step 1: Code Ko GitHub Repository Par Push Karein

1. [GitHub.com](https://github.com) open karein aur ek naya repository banayein: `contractor-ai`.
2. Terminal me commands chalayein:

```powershell
cd "d:\face recognition attendence"
git init
git add .
git commit -m "Initial commit of complete Contractor AI workforce system"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/contractor-ai.git
git push -u origin main
```

---

## ⚡ Step 2: Next.js Frontend Ko Vercel Par Deploy Karein (Free 24/7)

1. [Vercel.com](https://vercel.com) par jayein aur **Continue with GitHub** se login karein.
2. **`[Add New]`** $\rightarrow$ **`[Project]`** click karein.
3. Apna GitHub repo `contractor-ai` select karke **`[Import]`** click karein.
4. Configure karein:
   * **Framework Preset**: `Next.js`
   * **Root Directory**: `frontend` (Edit click karke `frontend` select karein).
5. **Environment Variables** add karein (`frontend/.env.local` se copy karke):
   * `WHATSAPP_ACCESS_TOKEN` = `<YOUR_TOKEN>`
   * `WHATSAPP_PHONE_NUMBER_ID` = `1330066433517275`
   * `WHATSAPP_BUSINESS_ACCOUNT_ID` = `1738385663951266`
   * `WHATSAPP_VERIFY_TOKEN` = `contractor_ai_whatsapp_verify_token_123`
   * `WHATSAPP_APP_SECRET` = `<YOUR_SECRET>`
   * `FACE_SERVICE_URL` = `https://<YOUR-RENDER-APP>.onrender.com` (Step 3 wala URL)
   * `IMAGE_STORAGE_MODE` = `supabase`
   * `NEXT_PUBLIC_SUPABASE_URL` = `https://ylrmdteluxqryifdailv.supabase.co`
6. Click **`[Deploy]`**!
   * Vercel aapko permanent domain dega: `https://contractor-ai.vercel.app`.

---

## 🧠 Step 3: Python AI Microservice Ko Render Par Deploy Karein (Free 24/7)

1. [Render.com](https://render.com) par jayein aur **Log in with GitHub** karein.
2. Click **`[New +]`** $\rightarrow$ **`[Web Service]`**.
3. GitHub repository `contractor-ai` select karein.
4. Form me fill karein:
   * **Name**: `contractor-ai-face-service`
   * **Root Directory**: `face-service`
   * **Environment**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Click **`[Create Web Service]`**.
   * Render aapko permanent HTTPS URL dega: `https://contractor-ai-face-service.onrender.com`.

---

## 📱 Step 4: Meta WhatsApp Webhook Callback URL Only ONCE Set Karein

1. [Meta Developer Dashboard](https://developers.facebook.com/apps/1820168339341443) me **WhatsApp $\rightarrow$ Configuration** open karein.
2. **Callback URL** me apna permanent Vercel domain enter karein:
   `https://contractor-ai.vercel.app/api/webhooks/whatsapp`
3. **Verify Token**: `contractor_ai_whatsapp_verify_token_123`
4. Click **`[Verify and Save]`** $\rightarrow$ Click **`[Subscribe]`** next to `messages`.

---

## 🎉 Done! 24/7/365 Automatic System Active!

Ab aapka PC off ho, laptop close ho, ya aap kahin bhi travel kar rahe hon — jab bhi koi supervisor WhatsApp par photo bhejega:
1. **Vercel** instant photo download karega.
2. **Render AI** YuNet + SFace se faces recognize karega.
3. **Firebase & Supabase** me records + photos save ho jayenge.
4. **WhatsApp Feedback Report** supervisor ko **24 hours a day, 365 days a year** automatically milti rahegi!

---

*Guide Version: 1.0.0 | Contractor AI Production Cloud Setup*
