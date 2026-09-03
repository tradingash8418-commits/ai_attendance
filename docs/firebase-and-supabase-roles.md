# Firebase vs Supabase Role Division & Integration Architecture 🏛️

This document explains the exact role division between **Firebase (Database)** and **Supabase (Image Storage)** in the Contractor AI Workforce Management system.

---

## 📊 Summary Architecture & Division of Roles

```text
                               +----------------------------------+
                               |    Contractor AI Next.js App     |
                               +----------------------------------+
                                     /                      \
                                    /                        \
                                   v                          v
                     +---------------------------+  +---------------------------+
                     |    Firebase Firestore     |  |     Supabase Storage      |
                     |   (NoSQL Cloud Database)  |  |    (Cloud Image Storage)   |
                     +---------------------------+  +---------------------------+
                     | - Worker Profiles         |  | - Attendance Group Photos |
                     | - Sites & Supervisors     |  | - Worker Reference Photos |
                     | - Attendance Records      |  | - Fast Public CDN URLs    |
                     | - 128-d SFace Vectors     |  | - Zero Token Access Links |
                     +---------------------------+  +---------------------------+
```

---

## 🔥 1. Role of Firebase (Cloud Database / Firestore)

**Firebase** acts as the primary **Real-time NoSQL Database** for storing all application data, relationships, and AI feature vectors.

### Data Stored in Firebase Firestore:
1. **`workers` Collection**: Worker names, worker codes (`WRK-001`), roles, and phone numbers.
2. **`workerEmbeddings` Collection**: The 128-dimensional **SFace Deep Neural Feature Vectors** calculated for each worker.
3. **`sites` Collection**: Construction site addresses, supervisor assignments, and active status.
4. **`supervisors` Collection**: Supervisor names, WhatsApp phone numbers, and site links.
5. **`attendanceRecords` Collection**: Daily attendance logs, check-in timestamps, check-out timestamps, worked duration, and Hajri values (`1.0`, `1.5`, `2.0`, `2.5`, `3.0`).
6. **`whatsappMessages` Collection**: Incoming WhatsApp webhook log history and duplicate protection tracking.

---

## ⚡ 2. Role of Supabase (Cloud Image Storage)

**Supabase Storage** acts as the **Cloud Media Object Storage** engine for binary photo files.

### Media Stored in Supabase Storage Bucket (`attendance-photos`):
1. **Attendance Group Photos**: Photos submitted by supervisors via WhatsApp or Web UI (`attendance/2026-09-03/site_123/group_123.jpg`).
2. **Worker Reference Face Photos**: Reference face photos uploaded during worker enrollment (`workers/WRK-006/ref_photo_WRK-006.jpg`).

### Why Supabase Storage is Used Instead of Firebase Storage:
* **Zero Authentication Friction**: Public CDN URLs (`https://<project-id>.supabase.co/storage/v1/object/public/attendance-photos/...`) can be accessed directly by the Python FastAPI AI service without needing complex GCP IAM tokens.
* **100% Free Tier**: 1 GB Storage + 2 GB Monthly Bandwidth free forever.
* **High Performance**: Fast CDN delivery for displaying photos on the Next.js Dashboard.

---

## ⚙️ 3. Environment Variable Configuration (`frontend/.env.local`)

```env
# Database: Firebase Cloud Firestore
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=face-attendance-9c705

# Image Storage Mode: "supabase" | "local" | "firebase"
IMAGE_STORAGE_MODE=supabase

# Image Storage: Supabase Cloud Storage
NEXT_PUBLIC_SUPABASE_URL=https://ylrmdteluxqryifdailv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## 🛠 4. Code Abstraction Layer

All image storage calls flow through [`ImageStorageServer`](file:///d:/face%20recognition%20attendence/frontend/services/image-storage.server.ts):

* Setting `IMAGE_STORAGE_MODE=supabase` in `.env.local` automatically routes image uploads to **Supabase Storage**.
* If Supabase credentials or buckets are not yet configured, the system gracefully falls back to local disk storage (`face-service/runtime-data/`) so the app **never crashes**.

---

*Document Version: 1.0.0 | Contractor AI Workforce OS*
