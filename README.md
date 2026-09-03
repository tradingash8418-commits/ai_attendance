# Contractor AI - Autonomous WhatsApp Attendance & AI Face Recognition System

> Modern, AI-powered construction workforce attendance system with Meta WhatsApp Cloud API integration, YuNet & SFace AI face recognition microservice, continuous time-slab Hajri calculation, Firebase Firestore database, and Supabase image storage.

---

## 🚀 How to Run the Project (3 Simple Steps)

Open **3 separate terminal windows** (PowerShell) and run these commands:

### Terminal 1: Next.js Frontend App (Port 3000)
```powershell
cd "d:\face recognition attendence\frontend"
npm run dev
```
*Access Web Dashboard:* `http://localhost:3000`

---

### Terminal 2: Python AI Face Recognition Service (Port 8000)
```powershell
cd "d:\face recognition attendence\face-service"
& ".\venv\Scripts\uvicorn.exe" main:app --reload --port 8000
```
*API Endpoint:* `http://localhost:8000/health`

---

### Terminal 3: Public HTTPS Webhook Tunnel (For Meta WhatsApp API)
```powershell
cd "d:\face recognition attendence"
npx localtunnel --port 3000
```
*Forwarding URL:* `https://<YOUR-SUBDOMAIN>.loca.lt` $\rightarrow$ `http://localhost:3000`

---

## 📘 Documentation & Architecture Guides

* **[24/7 Cloud Deployment Guide](docs/cloud-deployment-guide.md)**: Step-by-step tutorial on deploying Next.js to Vercel and Python AI to Render for 24/7/365 active automation even when PC is off.
* **[Firebase vs Supabase Roles](docs/firebase-and-supabase-roles.md)**: Role division between Firebase (Database) and Supabase (Cloud Image Storage).
* **[Hajri Time-Slab System Documentation](docs/hajri-time-slab-system.md)**: Detailed technical design, continuous time-slab tables, single-record lifecycle, and boundary test matrix.
* **[Worker Enrollment Guide](docs/worker-enrollment-guide.md)**: Complete tutorial on how to enroll new workers via Web UI (`http://localhost:3000/workers`) or test dataset scripts.
* **[WhatsApp Attendance Flow](docs/whatsapp-attendance-flow.md)**: Complete architectural flow for WhatsApp webhook processing and feedback dispatch.
* **[System Architecture](docs/architecture.md)**: Detailed breakdown of Next.js frontend, Python FastAPI microservice, and YuNet + SFace AI models.

---

## 🛠 Project Architecture & Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend UI** | Next.js 14 (App Router), React 18, Tailwind CSS | Sleek dark-mode contractor dashboard |
| **Backend Database** | Firebase Cloud Firestore | Multi-tenant sites, workers, single-record attendance sessions |
| **Cloud Image Storage** | Supabase Storage (`IMAGE_STORAGE_MODE=supabase`) | Fast public CDN links for attendance & reference photos |
| **AI Microservice** | Python 3, FastAPI, OpenCV, YuNet & SFace Neural Models | 128-d cosine feature matching for group photos |
| **Messaging Integration** | Meta WhatsApp Cloud API | Automated WhatsApp group selfie processing & clean reports |

---

## 🧪 Testing WhatsApp Attendance Live

1. Open `http://localhost:3000/test-whatsapp` in your browser.
2. Click **`[Seed ArcFace Embeddings]`** to sync the 5 Stage-4 test workers (**Pintu, Pradeep, Rampal, Suresh, Ramesh**).
3. Send a group selfie / collage photo on WhatsApp to your Meta test number (`+1 555 203-7574`) or click **`[Run WhatsApp Group Photo AI Test]`**.
4. The system will detect all faces, log attendance in Firestore, and send the automated **WhatsApp Attendance Report** directly to your phone!
