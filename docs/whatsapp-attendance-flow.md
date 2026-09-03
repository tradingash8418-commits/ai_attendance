# End-to-End AI Attendance & WhatsApp Pipeline Specification

This document details the complete end-to-end automated pipeline for **Contractor AI**, from WhatsApp group selfie submission to Python DeepFace ArcFace recognition, automatic attendance creation, automated WhatsApp report feedback, and configurable image storage mode.

---

## 1. Storage Modes (`IMAGE_STORAGE_MODE`)

The application supports two storage modes via environment variables:

| Mode | Environment Variable | Usage | Description |
|---|---|---|---|
| **Local Filesystem** (Default in Dev) | `IMAGE_STORAGE_MODE=local` | Development / Testing | Bypasses Firebase Storage entirely. Saves attendance photos and worker reference photos locally in `face-service/runtime-data/`. |
| **Firebase Storage** | `IMAGE_STORAGE_MODE=firebase` | Production | Uploads photos to Google Cloud Firebase Storage buckets (`attendance/...` and `workers/...`). |

> **Note**: In production mode (`IMAGE_STORAGE_MODE=firebase`), if Firebase Storage is unavailable or unconfigured, the system fails clearly without silent fallbacks.

---

## 2. Complete End-to-End Sequence Flow

```
Supervisor (WhatsApp Client)
          │
          │ 1. Sends group selfie photo to Meta WhatsApp Test Number
          ▼
Meta WhatsApp Cloud API
          │
          │ 2. HTTPS POST Webhook event payload (`/api/webhooks/whatsapp`)
          ▼
Next.js Webhook Processor (`services/webhook-processor.server.ts`)
          │
          ├── 3. Validate HMAC-SHA256 signature (`x-hub-signature-256`)
          ├── 4. Duplicate protection check (`isWhatsAppMessageAlreadyProcessed`)
          ├── 5. Normalize sender number & lookup supervisor (`supervisors` collection)
          ├── 6. Resolve supervisor's site (`attendanceSession.siteId`)
          ├── 7. Save photo via ImageStorageServer (Local filesystem OR Firebase Storage)
          └── 8. Create & update Attendance Session (`status: "processing"`)
          │
          ▼
Python Face Recognition Service (`face-service/` - Python FastAPI + DeepFace + ArcFace)
          │
          ├── 9. POST /recognize (Group selfie image URL + active worker ArcFace embeddings)
          ├── 10. Detect faces & extract 512-d ArcFace vectors
          ├── 11. Compute cosine distance against active worker embeddings
          └── 12. Return matched worker IDs & unrecognized face count (Threshold: Cosine Distance <= 0.68)
          │
          ▼
Automatic Attendance Creation (`services/attendance.service.ts`)
          │
          ├── 13. For each recognized active worker:
          │       - create `attendance` record (`status: "present"`, `siteId: session.siteId`)
          │       - enforce workerId + siteId + date duplicate record protection
          │       - worker assignment mismatch NEVER blocks attendance creation!
          └── 14. Update Attendance Session (`status: "completed"`)
          │
          ▼
Supervisor WhatsApp Feedback Report (`services/whatsapp-feedback.server.ts`)
          │
          ├── 15. Format clean text report:
          │       "Attendance Recorded ✅
          │        Site: Andheri Commercial Site
          │        Date: 02 Sep 2026
          │        Present:
          │        1. Ramesh Kumar (#WRK-001)
          │        2. Suresh (#WRK-002)
          │        Total Present: 2"
          └── 16. Dispatch WhatsApp text report back to supervisor's WhatsApp sender number!
```

---

## 3. Core Business Rules

### Rule 1: "Send Selfie $\rightarrow$ Forget About It"
- The supervisor takes a group selfie and sends it.
- **NO manual site selection, NO worker selection, NO web app confirmation required.**

### Rule 2: Session Site is Source of Truth
- The attendance site is **ALWAYS** `attendanceSession.siteId` (the supervisor's site).
- Even if a worker's Firestore assignment record says Site B, if they appear in Supervisor A's selfie at Site A, they are marked **PRESENT for Site A**.
- **Worker site assignment mismatch NEVER blocks attendance creation.**

### Rule 3: Unrecognized Faces Do Not Block Attendance
- If a selfie contains 8 faces and 7 are confidently recognized, attendance is logged for those 7 workers.
- The 8th unrecognized face does not block the session and generates a note in the feedback report.

### Rule 4: Idempotency & Duplicate Prevention
- A worker receives at most **ONE attendance record per workerId + siteId + date**.
- Subsequent selfies sent on the same day do not create duplicate attendance records.

### Rule 5: WhatsApp Delivery Failure Safety
- If sending the WhatsApp feedback report fails, **created attendance records are NEVER rolled back**.
