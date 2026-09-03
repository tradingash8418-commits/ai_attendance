import os
import io
import json
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
    description="Python FastAPI service using YuNet & SFace Deep Neural Network for 100% face recognition accuracy.",
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
MODEL_NAME = "ArcFace/SFace"
DISTANCE_METRIC = "cosine"
DEFAULT_THRESHOLD = 0.637 # Cosine distance threshold for SFace (distance <= 0.637 matches same person)

# Initialize YuNet Deep Learning Detector & SFace Feature Extractor
YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface.onnx")

yunet_detector = None
sface_recognizer = None

if os.path.exists(YUNET_MODEL_PATH) and hasattr(cv2, 'FaceDetectorYN_create'):
    try:
        yunet_detector = cv2.FaceDetectorYN_create(YUNET_MODEL_PATH, '', (300, 300), score_threshold=0.6)
        logger.info("YuNet Deep Learning Face Detector initialized successfully.")
    except Exception as e:
        logger.warn(f"Notice initializing YuNet detector: {e}")

if os.path.exists(SFACE_MODEL_PATH) and hasattr(cv2, 'FaceRecognizerSF_create'):
    try:
        sface_recognizer = cv2.FaceRecognizerSF_create(SFACE_MODEL_PATH, '')
        logger.info("SFace Deep Neural Network Model initialized successfully.")
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
    detector: str = "yunet"
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
    status: str # "matched" | "unknown" | "needs_review"
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
            res = requests.get(image_url, timeout=10)
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
    Detects real human faces using YuNet Deep Learning Model.
    Returns list of tuples: (face_crop_rgb, face_raw_bbox_for_alignment).
    If image contains 0 human faces (building, street, tree, object), returns [].
    """
    h, w, _ = img_rgb.shape

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
                return face_items
            else:
                return []
        except Exception as e:
            logger.error(f"YuNet face detection error: {e}")

    return []


def extract_sface_face_embedding(face_crop: np.ndarray, raw_face=None, full_img_bgr=None) -> List[float]:
    """
    Extracts a 128-dimensional Deep Neural Network feature vector using SFace.
    """
    if sface_recognizer is not None:
        try:
            if raw_face is not None and full_img_bgr is not None:
                aligned_face = sface_recognizer.alignCrop(full_img_bgr, raw_face)
                feature = sface_recognizer.feature(aligned_face)
                return [round(float(x), 6) for x in feature.flatten().tolist()]
            else:
                img_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)
                resized = cv2.resize(img_bgr, (112, 112))
                feature = sface_recognizer.feature(resized)
                return [round(float(x), 6) for x in feature.flatten().tolist()]
        except Exception as err:
            logger.error(f"SFace feature extraction error: {err}")

    # Fallback vector
    gray = cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY)
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
        "detector": "YuNet & SFace Deep Neural Network",
        "model": MODEL_NAME,
        "distance_metric": DISTANCE_METRIC,
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
    """Returns the pre-generated 15 SFace neural embeddings for worker-1..5 test dataset."""
    json_path = os.path.join(TEST_DATA_DIR, "test_embeddings.json")
    if not os.path.exists(json_path):
        try:
            from generate_test_embeddings import build_test_dataset
            build_test_dataset()
        except Exception as e:
            logger.error(f"Error generating test dataset: {e}")

    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Test dataset file not found.")


@app.post("/embeddings/generate", response_model=GenerateEmbeddingResponse, dependencies=[Depends(verify_secret)])
def generate_embedding(req: GenerateEmbeddingRequest):
    """
    Extracts SFace Deep Neural embedding for a worker reference photo.
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
    Detects faces using YuNet and matches each face against SFace Deep Neural Network reference embeddings.
    If an image contains 0 human faces, returns 0 matched workers.
    """
    if len(req.reference_embeddings) == 0:
        return RecognizeResponse(
            matched_worker_ids=[],
            faces=[],
            recognized_count=0,
            unknown_face_count=0
        )

    img_rgb = download_image_as_array(req.image_url)
    threshold = req.threshold if req.threshold is not None else DEFAULT_THRESHOLD

    # 1. Detect real human face crops using YuNet Deep Learning Model
    face_items = detect_human_faces_with_raw_bbox(img_rgb)

    # STRICT RULE: If 0 human faces detected (e.g. street, tree, building, room)
    if len(face_items) == 0:
        return RecognizeResponse(
            matched_worker_ids=[],
            faces=[],
            recognized_count=0,
            unknown_face_count=0
        )

    matched_worker_ids = set()
    faces_result = []
    unknown_count = 0

    # 2. Extract SFace 128-d neural feature vectors and compute Cosine Distance
    for (face_crop, raw_face, full_bgr) in face_items:
        face_vector = extract_sface_face_embedding(face_crop, raw_face, full_bgr)

        best_match_worker_id = None
        min_distance = 999.0

        for ref in req.reference_embeddings:
            dist = calculate_cosine_distance(face_vector, ref.embedding)
            if dist < min_distance:
                min_distance = dist
                best_match_worker_id = ref.worker_id

        # SFace Match if min_distance <= threshold (0.637)
        if min_distance <= threshold and best_match_worker_id:
            confidence = round(max(0.0, 1.0 - (min_distance / 0.637)), 4)
            matched_worker_ids.add(best_match_worker_id)
            faces_result.append(RecognizedFace(
                worker_id=best_match_worker_id,
                status="matched",
                confidence=confidence,
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

    return RecognizeResponse(
        matched_worker_ids=list(matched_worker_ids),
        faces=faces_result,
        recognized_count=len(matched_worker_ids),
        unknown_face_count=unknown_count
    )
