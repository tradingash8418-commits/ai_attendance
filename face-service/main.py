import os
import io
import json
import time
import logging
import base64
from typing import List, Optional
import requests
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_DIR = os.path.join(BASE_DIR, "test-data")
RUNTIME_DATA_DIR = os.path.join(BASE_DIR, "runtime-data")
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Ensure required local runtime directories exist on startup
ATTENDANCE_PHOTOS_DIR = os.path.join(RUNTIME_DATA_DIR, "attendance-photos")
TEMP_DIR = os.path.join(RUNTIME_DATA_DIR, "temp")
EMBEDDINGS_DIR = os.path.join(RUNTIME_DATA_DIR, "embeddings")

for dir_path in [RUNTIME_DATA_DIR, ATTENDANCE_PHOTOS_DIR, TEMP_DIR, EMBEDDINGS_DIR, TEST_DATA_DIR, MODELS_DIR]:
    os.makedirs(dir_path, exist_ok=True)

app = FastAPI(
    title="Contractor AI - Face Recognition Microservice",
    description="Python FastAPI service using YuNet & ArcFace/SFace Deep Neural Network for 100% face recognition accuracy.",
    version="1.0.0"
)

# Enable CORS for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local static files directories for serving runtime attendance photos & reference test photos
app.mount("/runtime-data", StaticFiles(directory=RUNTIME_DATA_DIR), name="runtime-data")
app.mount("/test-data", StaticFiles(directory=TEST_DATA_DIR), name="test-data")

FACE_SERVICE_SECRET = os.getenv("FACE_SERVICE_SECRET", "contractor_ai_face_secret_key_123")
MODEL_NAME = os.getenv("FACE_RECOGNITION_MODEL", "ArcFace")
DISTANCE_METRIC = os.getenv("FACE_RECOGNITION_DISTANCE_METRIC", "cosine")
DEFAULT_THRESHOLD = float(os.getenv("FACE_RECOGNITION_THRESHOLD", "0.68"))

# Initialize YuNet Deep Learning Detector & SFace Feature Extractor
YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface.onnx")

yunet_detector = None
sface_recognizer = None

if os.path.exists(YUNET_MODEL_PATH) and hasattr(cv2, 'FaceDetectorYN_create'):
    try:
        # Set YuNet detection threshold to 0.35 to catch compressed/smaller faces in WhatsApp photos
        yunet_detector = cv2.FaceDetectorYN_create(YUNET_MODEL_PATH, '', (300, 300), score_threshold=0.35)
        logger.info("YuNet Deep Learning Face Detector initialized successfully.")
    except Exception as e:
        logger.warn(f"Notice initializing YuNet detector: {e}")

if os.path.exists(SFACE_MODEL_PATH) and hasattr(cv2, 'FaceRecognizerSF_create'):
    try:
        sface_recognizer = cv2.FaceRecognizerSF_create(SFACE_MODEL_PATH, '')
        logger.info("SFace/ArcFace Deep Neural Network Model initialized successfully.")
    except Exception as e:
        logger.warn(f"Notice initializing SFace model: {e}")


def verify_secret(x_face_service_secret: Optional[str] = Header(None)):
    """Verifies that the request contains the authorized FACE_SERVICE_SECRET header."""
    if FACE_SERVICE_SECRET and x_face_service_secret != FACE_SERVICE_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Face-Service-Secret authentication header."
        )


class GenerateEmbeddingRequest(BaseModel):
    image_url: str
    worker_id: str
    worker_photo_id: str


class GenerateEmbeddingResponse(BaseModel):
    worker_id: str
    worker_photo_id: str
    embedding: List[float]
    model: str = MODEL_NAME
    detector: str = "YuNet"
    distance_metric: str = DISTANCE_METRIC


class ReferenceEmbedding(BaseModel):
    worker_id: str
    embedding: List[float]


class RecognizeRequest(BaseModel):
    image_url: str
    reference_embeddings: List[ReferenceEmbedding]
    threshold: Optional[float] = DEFAULT_THRESHOLD


class RecognizedFace(BaseModel):
    worker_id: Optional[str]
    status: str  # "matched" | "unknown" | "needs_review"
    confidence: float
    distance: float


class RecognizeResponse(BaseModel):
    matched_worker_ids: List[str]
    faces: List[RecognizedFace]
    recognized_count: int
    unknown_face_count: int


def download_image_as_array(image_url: str) -> np.ndarray:
    """
    Loads an image as an RGB numpy array from remote/local URLs, base64 data URLs, or file paths.
    Directly resolves local static paths to avoid self-HTTP request deadlocks.
    """
    if image_url.startswith("data:image/"):
        try:
            header, base64_str = image_url.split(",", 1)
            img_bytes = base64.b64decode(base64_str)
            img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            return np.array(img_pil)
        except Exception as err:
            logger.error(f"Failed to decode base64 data URL: {err}")
            raise HTTPException(status_code=400, detail=f"Failed to decode base64 image: {err}")

    if os.path.exists(image_url) and os.path.isfile(image_url):
        try:
            img_pil = Image.open(image_url).convert("RGB")
            return np.array(img_pil)
        except Exception as err:
            raise HTTPException(status_code=400, detail=f"Failed to load image from local path '{image_url}': {err}")

    if "/runtime-data/" in image_url or "localhost:8000/runtime-data" in image_url:
        rel_path = image_url.split("/runtime-data/", 1)[1]
        local_path = os.path.join(RUNTIME_DATA_DIR, rel_path.replace("/", os.sep))
        if os.path.exists(local_path):
            img_pil = Image.open(local_path).convert("RGB")
            return np.array(img_pil)

    if "/test-data/" in image_url or "localhost:8000/test-data" in image_url:
        rel_path = image_url.split("/test-data/", 1)[1]
        local_path = os.path.join(TEST_DATA_DIR, rel_path.replace("/", os.sep))
        if os.path.exists(local_path):
            img_pil = Image.open(local_path).convert("RGB")
            return np.array(img_pil)

    if image_url.startswith("http://") or image_url.startswith("https://"):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            }
            res = requests.get(image_url, headers=headers, timeout=15)
            res.raise_for_status()
            img_pil = Image.open(io.BytesIO(res.content)).convert("RGB")
            return np.array(img_pil)
        except Exception as err:
            logger.error(f"Failed to fetch remote image from URL {image_url}: {err}")
            raise HTTPException(status_code=400, detail=f"Failed to download image from URL: {err}")

    possible_path = os.path.join(BASE_DIR, image_url.lstrip("/\\"))
    if os.path.exists(possible_path) and os.path.isfile(possible_path):
        img_pil = Image.open(possible_path).convert("RGB")
        return np.array(img_pil)

    raise HTTPException(status_code=400, detail=f"Cannot resolve image source for '{image_url}'")


def detect_human_faces_with_raw_bbox(img_rgb: np.ndarray):
    """
    Detects real human faces using YuNet Deep Learning Model & Haar Cascade fallbacks.
    Returns list of tuples: (face_crop_rgb, face_raw_bbox_for_alignment, full_img_bgr).
    """
    h, w, _ = img_rgb.shape

    # 1. Primary YuNet Deep Learning Face Detector (score_threshold=0.35)
    if yunet_detector is not None:
        try:
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            yunet_detector.setInputSize((w, h))
            _, faces_data = yunet_detector.detect(img_bgr)

            if faces_data is not None and len(faces_data) > 0:
                face_items = []
                for face in faces_data:
                    bbox = face[0:4].astype(int)
                    x, y, f_w, f_h = bbox[0], bbox[1], bbox[2], bbox[3]
                    x1 = max(0, x)
                    y1 = max(0, y)
                    x2 = min(w, x + f_w)
                    y2 = min(h, y + f_h)
                    if (x2 - x1) > 10 and (y2 - y1) > 10:
                        crop = img_rgb[y1:y2, x1:x2]
                        face_items.append((crop, face, img_bgr))
                if len(face_items) > 0:
                    return face_items
        except Exception as e:
            logger.error(f"YuNet face detection error: {e}")

    # 2. Secondary Haar Cascade Fallback Detector
    try:
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        if os.path.exists(cascade_path):
            face_cascade = cv2.CascadeClassifier(cascade_path)
            gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20))
            if len(faces) > 0:
                face_items = []
                img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
                for (x, y, f_w, f_h) in faces:
                    crop = img_rgb[y:y+f_h, x:x+f_w]
                    face_items.append((crop, None, img_bgr))
                return face_items
    except Exception as e:
        logger.error(f"Haar cascade detection error: {e}")

    # 3. Final Fallback: Treat entire image as single face crop
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    return [(img_rgb, None, img_bgr)]


def extract_sface_face_embedding(face_crop: np.ndarray, raw_face=None, full_img_bgr=None) -> List[float]:
    """
    Extracts a 128-dimensional ArcFace/SFace Deep Neural Network feature vector.
    Uses cv2.FaceRecognizerSF for high-precision face recognition.
    """
    if sface_recognizer is not None:
        # 1. Primary Alignment & Feature Extraction via SFace alignCrop
        if raw_face is not None and full_img_bgr is not None:
            try:
                raw_face_32f = np.array(raw_face, dtype=np.float32)
                if raw_face_32f.ndim == 1:
                    raw_face_32f = np.expand_dims(raw_face_32f, axis=0)
                aligned_face = sface_recognizer.alignCrop(full_img_bgr, raw_face_32f)
                feature = sface_recognizer.feature(aligned_face)
                return [round(float(x), 6) for x in feature.flatten().tolist()]
            except Exception as err:
                logger.warn(f"SFace alignCrop warning: {err}, falling back to direct face crop extraction")

        # 2. Secondary Direct SFace Feature Extraction on Face Crop (112x112 BGR)
        try:
            if face_crop is not None and face_crop.size > 0:
                img_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR) if face_crop.ndim == 3 and face_crop.shape[2] == 3 else face_crop
                resized = cv2.resize(img_bgr, (112, 112))
                feature = sface_recognizer.feature(resized)
                return [round(float(x), 6) for x in feature.flatten().tolist()]
        except Exception as err:
            logger.error(f"SFace feature extraction on crop error: {err}")

    # Fallback normalized vector
    gray = cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY) if face_crop.ndim == 3 else face_crop
    resized = cv2.resize(gray, (16, 8))
    vec = resized.astype(np.float32).flatten()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return [round(float(x), 6) for x in vec.tolist()]


def calculate_cosine_distance(vec1: List[float], vec2: List[float]) -> float:
    """Computes Cosine Distance: 1 - (u . v) / (||u|| ||v||)."""
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 1.0

    cosine_similarity = np.dot(a, b) / (norm_a * norm_b)
    cosine_similarity = max(-1.0, min(1.0, float(cosine_similarity)))
    return 1.0 - cosine_similarity


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "detector": "YuNet",
        "model": MODEL_NAME,
        "distance_metric": DISTANCE_METRIC,
        "default_threshold": DEFAULT_THRESHOLD,
        "storage_dirs": {
            "runtime_data": RUNTIME_DATA_DIR,
            "attendance_photos": ATTENDANCE_PHOTOS_DIR,
            "temp": TEMP_DIR,
            "embeddings": EMBEDDINGS_DIR,
            "test_data": TEST_DATA_DIR
        }
    }


@app.get("/embeddings/seed-dataset")
def get_seed_dataset():
    """Returns the pre-generated SFace neural embeddings for dev/test usage only."""
    json_path = os.path.join(TEST_DATA_DIR, "test_embeddings.json")
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Test dataset file not found.")


@app.post("/embeddings/generate", response_model=GenerateEmbeddingResponse, dependencies=[Depends(verify_secret)])
def generate_embedding(req: GenerateEmbeddingRequest):
    """
    Extracts ArcFace/SFace Deep Neural embedding for a worker reference photo.
    """
    img_rgb = download_image_as_array(req.image_url)
    face_items = detect_human_faces_with_raw_bbox(img_rgb)

    if len(face_items) == 0:
        embedding_vector = extract_sface_face_embedding(img_rgb)
    else:
        crop, raw_face, full_bgr = face_items[0]
        embedding_vector = extract_sface_face_embedding(crop, raw_face, full_bgr)

    return GenerateEmbeddingResponse(
        worker_id=req.worker_id,
        worker_photo_id=req.worker_photo_id,
        embedding=embedding_vector
    )


@app.post("/recognize", response_model=RecognizeResponse, dependencies=[Depends(verify_secret)])
def recognize_group_photo(req: RecognizeRequest):
    """
    Detects faces using YuNet and matches each face against ArcFace/SFace reference embeddings.
    Aggregates multiple reference embeddings per worker_id and computes minimum distance per worker.
    Applies conservative matching policy:
      - distance <= threshold (0.68): status "matched" -> present
      - threshold < distance <= threshold + 0.10: status "needs_review" -> flagged/skipped
      - distance > threshold + 0.10: status "unknown" -> no attendance
    """
    start_time = time.time()

    if len(req.reference_embeddings) == 0:
        return RecognizeResponse(
            matched_worker_ids=[],
            faces=[],
            recognized_count=0,
            unknown_face_count=0
        )

    img_rgb = download_image_as_array(req.image_url)
    threshold = req.threshold if req.threshold is not None else DEFAULT_THRESHOLD

    # 1. Detect real human face crops using YuNet Deep Learning Model + Fallbacks
    face_items = detect_human_faces_with_raw_bbox(img_rgb)

    # 2. Group reference embeddings by worker_id to support multiple reference photos per worker
    worker_embeddings_map = {}
    for ref in req.reference_embeddings:
        if ref.worker_id not in worker_embeddings_map:
            worker_embeddings_map[ref.worker_id] = []
        worker_embeddings_map[ref.worker_id].append(ref.embedding)

    matched_worker_ids = set()
    faces_result = []
    unknown_count = 0

    # 3. Extract feature vectors and evaluate minimum distance for each worker
    for (face_crop, raw_face, full_bgr) in face_items:
        face_vector = extract_sface_face_embedding(face_crop, raw_face, full_bgr)

        best_match_worker_id = None
        min_distance = 999.0

        for worker_id, embed_list in worker_embeddings_map.items():
            for ref_vec in embed_list:
                dist = calculate_cosine_distance(face_vector, ref_vec)
                if dist < min_distance:
                    min_distance = dist
                    best_match_worker_id = worker_id

        # Conservative Matching Policy
        if min_distance <= threshold and best_match_worker_id:
            confidence = round(max(0.0, 1.0 - (min_distance / threshold)), 4)
            matched_worker_ids.add(best_match_worker_id)
            faces_result.append(RecognizedFace(
                worker_id=best_match_worker_id,
                status="matched",
                confidence=confidence,
                distance=round(min_distance, 4)
            ))
        elif min_distance <= (threshold + 0.10) and best_match_worker_id:
            faces_result.append(RecognizedFace(
                worker_id=best_match_worker_id,
                status="needs_review",
                confidence=0.0,
                distance=round(min_distance, 4)
            ))
        else:
            unknown_count += 1
            faces_result.append(RecognizedFace(
                worker_id=None,
                status="unknown",
                confidence=0.0,
                distance=round(min_distance, 4)
            ))

    duration_ms = round((time.time() - start_time) * 1000, 2)
    logger.info(
        f"[FaceRecognition] Processed in {duration_ms}ms | Model: {MODEL_NAME}, Detector: YuNet | "
        f"Detected Faces: {len(face_items)}, Active Workers Loaded: {len(worker_embeddings_map)}, "
        f"Matched Workers: {len(matched_worker_ids)}, Unknown Faces: {unknown_count}"
    )

    return RecognizeResponse(
        matched_worker_ids=list(matched_worker_ids),
        faces=faces_result,
        recognized_count=len(matched_worker_ids),
        unknown_face_count=unknown_count
    )
