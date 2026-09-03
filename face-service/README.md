# Face Recognition Microservice (Python FastAPI + DeepFace + ArcFace)

This microservice handles AI face detection, ArcFace embedding generation, and cosine distance face matching for **Contractor AI**.

---

## 1. Setup & Installation

### Requirements
- **Python**: 3.10 or 3.11
- **Virtual Environment**: Recommended

### Local Setup Steps
```bash
# 1. Navigate to face-service directory
cd face-service

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
```

---

## 2. Running the Microservice

```bash
# Start FastAPI service on port 8000
uvicorn main:app --reload --port 8000
```

The service will run at `http://localhost:8000`.

---

## 3. Configuration & Security

Set environment variables before starting:

```env
FACE_SERVICE_SECRET=contractor_ai_face_secret_key_123
```

All incoming HTTP requests require header:
```http
X-Face-Service-Secret: contractor_ai_face_secret_key_123
```

---

## 4. API Endpoints Specification

### `GET /health`
Returns microservice health and DeepFace readiness.

### `POST /embeddings/generate`
Generates an ArcFace 512-dimensional vector for a worker reference photo.
- **Validation**: Enforces that **EXACTLY ONE** usable face is present. Returns HTTP `400` if 0 or >1 face is detected.

### `POST /recognize`
Detects all faces in a group selfie image and compares each face against active worker reference embeddings using cosine distance:
$$\text{Cosine Distance}(u, v) = 1 - \frac{u \cdot v}{\|u\| \|v\|}$$
- **Threshold**: Default threshold $\le 0.68$. Faces exceeding the distance threshold are marked as `"unknown"` to prevent false positive worker assignments.

---

## 5. Threshold Calibration & Precision Principle

In construction environments (dust, helmets, side camera angles):
> **PRIORITIZE PRECISION OVER RECALL**: It is better to leave one worker unrecognized than to mark an incorrect worker present.
