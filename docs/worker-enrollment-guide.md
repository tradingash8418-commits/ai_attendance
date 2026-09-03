# Contractor AI - Naye Worker Ko Enroll Karne Ka Complete Tutorial 📘

Yeh guide aapko step-by-step sikhata hai ki Contractor AI Face Attendance System me naye worker ko **UI Dashboard** ya **Test Dataset** ke zariye kaise enroll karein.

---

## 🌟 Method 1: Web UI Se Naye Worker Ko Enroll Karein (Subse Aasan & Recommended)

Real production work me aapko kisi terminal ya script ki zaroorat nahi hai. Aap direct Web UI Dashboard se naye worker ko uski face photo ke sath enroll kar sakte hain.

### Step-by-Step UI Process:

1. **Browser Me Open Karein**:
   [http://localhost:3000/workers](http://localhost:3000/workers)

2. **Top Right Button Click Karein**:
   **`[+ Enroll New Worker]`** (Orange color button)

3. **Form Details Fill Karein**:
   * **Worker Full Name**: e.g., `Amit Kumar` *(Mandatory)*
   * **Worker Code / ID**: e.g., `WRK-006` *(Mandatory)*
   * **Role / Skill**: e.g., `Mason`, `Welder`, `Electrician`
   * **Phone Number**: e.g., `+91 9876543210` *(Optional)*

4. **Worker ki Face Photo Upload Karein**:
   * **Select Worker Face Photo** box par click karein.
   * Computer se us worker ki ek clear front-facing face photo select karein.
   * Screen par photo ka live preview dikhega.

5. **Click `[Enroll Worker]`**:
   * Server automatically SFace Deep Neural AI ke zariye 128-dimensional face embedding vector calculate kar lega.
   * Naya worker instant database me active ho jayega aur directory me dikhne lagega.

---

## 🛠️ Method 2: Test Dataset Script Se Batch Workers Add Karein (Offline/Developer Mode)

Agar aap developer test data folder me bulk me photos add karke embeddings regenerate karna chahte hain:

### Step 1: Naya Worker Folder Banayein
1. Folder location par jayein: `face-service/test-data/`
2. Ek naya folder banayein: `worker-6` (ya `worker-7`, `worker-8`, etc.).
3. Us folder me us worker ki 2–3 clear reference photos rakhein (e.g., `photo1.jpg`, `photo2.jpg`).

### Step 2: Python Script Me Worker Mapping Update Karein
File open karein: [`face-service/generate_test_embeddings.py`](file:///d:/face%20recognition%20attendence/face-service/generate_test_embeddings.py)

`WORKER_MAPPING` dictionary me naye worker ki detail add karein:

```python
WORKER_MAPPING = {
    "worker-1": {"name": "Pintu", "code": "WRK-001"},
    "worker-2": {"name": "Pradeep", "code": "WRK-002"},
    "worker-3": {"name": "Rampal", "code": "WRK-003"},
    "worker-4": {"name": "Suresh", "code": "WRK-004"},
    "worker-5": {"name": "Ramesh", "code": "WRK-005"},
    "worker-6": {"name": "Amit Kumar", "code": "WRK-006"}, # <-- Naya Worker Add Karein
}
```

### Step 3: Embeddings Regenerate Command Run Karein
PowerShell terminal me yeh command chalayein:

```powershell
cd "d:\face recognition attendence\face-service"
& ".\venv\Scripts\python.exe" generate_test_embeddings.py
```

### Step 4: UI Sync
Browser me `http://localhost:3000/test-whatsapp` par jayein aur **`[Seed ArcFace Embeddings]`** button click karein.

---

## 🧠 AI Face Recognition Engine Kaise Kaam Karta Hai?

System me 2 Deep Learning Models ek sath kaam karte hain:

1. **YuNet Deep Learning Face Detector (`face_detection_yunet.onnx`)**:
   * Image me se real human faces detect karta hai.
   * Agar photo building, street, tree, ya bina insaan ki ho, toh YuNet **0 faces** return karta hai (`Present: None`).

2. **SFace Neural Network Model (`face_recognition_sface.onnx`)**:
   * Har face crop ka **128-dimensional normalized neural embedding vector** generate karta hai.
   * Lighting, pose, ya side-angle face hone par bhi **Cosine Distance** compare karke exact match karta hai.

---

## 📷 WhatsApp Attendance Photo Shoot Best Practices (Site Supervisor Tips)

Supervisor site par attendance lete waqt yeh 4 rules follow karein:

1. **Lighting (Ujala)**: Daylight ya bright lights me photo lein. Sun/light source worker ke piche nahi hona chahiye.
2. **Angle (Chehra Seedha)**: Sabhi workers camera ki taraf seedha dekhein.
3. **Obstructions (Chehra Saaf)**: Masks niche kar lein, dark sunglasses hata dein, aur helmets piche push karein.
4. **Distance (Doori)**: Camera 1.5 se 3 meters (5-10 feet) ki doori par rakhein.

---

*Guide Version: 1.0.0 | Contractor AI Workforce Management System*
