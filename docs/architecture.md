# System Architecture - Contractor AI

## Overview
**Contractor AI** is an AI-powered construction workforce attendance and site management platform tailored for contractors managing multiple construction sites and workers.

The system is designed with a decoupled, event-friendly architecture ensuring clear separation between:
1. **Frontend Client Layer** (User Interface & Local State)
2. **Backend & Cloud Infrastructure Layer** (Firebase Authentication, Firestore DB, Firebase Storage)
3. **Business Logic & Processing Layer** (Verification, Business Rules, Auditing)
4. **AI & Computer Vision Layer** (Python / FastAPI / DeepFace + ArcFace)

---

## High-Level Architecture Flow Diagram

```
+-------------------------------------------------------------+
|                      Frontend Client                        |
|   (Next.js 14 App Router, TypeScript, Tailwind CSS, PWA)    |
+------------------------------+------------------------------+
                               |
                               | Firebase Client SDK (HTTPS/WSS)
                               v
+-------------------------------------------------------------+
|                 Firebase Infrastructure                     |
|  +--------------------+  +------------------+  +----------+ |
|  | Firebase Auth      |  | Cloud Firestore  |  | Firebase | |
|  | (Sup/Worker Auth)  |  | (Site Data, Logs)|  | Storage  | |
|  +--------------------+  +------------------+  +----------+ |
+------------------------------+------------------------------+
                               |
                               | Secure API / Event Trigger
                               v
+-------------------------------------------------------------+
|               Future Backend / Business Logic               |
|            (Validation, Site Verification, Audit)           |
+------------------------------+------------------------------+
                               |
                               | HTTPS REST API (JSON + Image Payloads)
                               v
+-------------------------------------------------------------+
|             Future Face Recognition Microservice            |
|       (Python, FastAPI, DeepFace + ArcFace Embeddings)      |
+-------------------------------------------------------------+
```

---

## Architectural Principles & Layer Responsibilities

### 1. Frontend Client Layer (`/frontend`)
- **Technology Stack**: Next.js (App Router), TypeScript, Tailwind CSS.
- **Responsibilities**:
  - Render responsive UI optimized for mobile devices (site supervisors on-site) and desktop browsers (contractor admin).
  - Capture site group photos and handle client-side input validation.
  - Connect safely to Firebase via public environment variables.
  - Support future PWA (Progressive Web App) offline capabilities and camera APIs.

### 2. Firebase Infrastructure Layer
- **Firebase Authentication**: Manages identity and access tokens securely without hardcoded credentials.
- **Cloud Firestore**: Scalable NoSQL document store for site data, worker registrations, site assignments, and attendance logs.
- **Firebase Storage**: Secure object storage for original attendance photos, worker face reference images, and audit snapshots.

### 3. Future Backend & Business Logic Layer
- **Responsibilities**:
  - Enforce site boundary rules, supervisor permissions, and daily attendance windows.
  - Coordinate face verification payloads between Firebase Storage and the AI service.
  - Prepare data structures for future features (notifications, payroll calculations).

### 4. Future Face-Recognition Microservice (`/face-service`)
- **Technology Stack**: Python 3.10+, FastAPI, DeepFace library, ArcFace facial embedding model.
- **Responsibilities**:
  - Receive reference worker face embeddings and daily group/individual site photos.
  - Perform face detection, alignment, feature extraction, and high-accuracy cosine similarity matching.
  - Return worker identification candidates with confidence scores.
- **Isolation**: Completely decoupled from the Next.js frontend to allow independent scaling, GPU acceleration, and isolated updates.

---

## Deployment & Local Development Strategy
- **Local Emulation**: Fully compatible with `firebase emulators` for offline development and local database testing.
- **Production Deployment**: Frontend can be deployed to Vercel/Firebase Hosting, database on Firebase Cloud, and Python AI service on containerized GPU/CPU cloud infrastructure (e.g. Docker / Cloud Run).
