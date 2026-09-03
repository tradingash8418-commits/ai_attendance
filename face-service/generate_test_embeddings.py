import os
import json
import numpy as np
import cv2

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test-data")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface.onnx")

detector = cv2.FaceDetectorYN_create(YUNET_MODEL_PATH, '', (300, 300), score_threshold=0.6)
recognizer = cv2.FaceRecognizerSF_create(SFACE_MODEL_PATH, '')

WORKER_MAPPING = {
    "worker-1": {"name": "Pintu", "code": "WRK-001"},
    "worker-2": {"name": "Pradeep", "code": "WRK-002"},
    "worker-3": {"name": "Rampal", "code": "WRK-003"},
    "worker-4": {"name": "Suresh", "code": "WRK-004"},
    "worker-5": {"name": "Ramesh", "code": "WRK-005"},
}

def extract_sface_neural_vector(image_path: str) -> list[float]:
    """
    Extracts a 128-d SFace Deep Neural Network feature embedding vector for a reference photo.
    """
    try:
        img_bgr = cv2.imread(image_path)
        h, w, _ = img_bgr.shape
        detector.setInputSize((w, h))
        _, faces = detector.detect(img_bgr)
        if faces is not None and len(faces) > 0:
            aligned_face = recognizer.alignCrop(img_bgr, faces[0])
            feature = recognizer.feature(aligned_face)
            return [round(float(x), 6) for x in feature.flatten().tolist()]
        else:
            # Fallback alignment if YuNet detector doesn't crop tight
            resized = cv2.resize(img_bgr, (112, 112))
            feature = recognizer.feature(resized)
            return [round(float(x), 6) for x in feature.flatten().tolist()]
    except Exception as e:
        print(f"Notice generating SFace embedding for {image_path}: {e}")
        return [0.0] * 128

def build_test_dataset():
    dataset = []
    total_photos = 0

    print("Processing Stage 4 Test Dataset using SFace Deep Neural Network...")

    for worker_dir, meta in WORKER_MAPPING.items():
        dir_path = os.path.join(TEST_DATA_DIR, worker_dir)
        if not os.path.exists(dir_path):
            print(f"Warning: Directory {dir_path} not found.")
            continue

        photo_files = [f for f in os.listdir(dir_path) if f.endswith((".jpg", ".png", ".jpeg"))]
        photo_files.sort()

        for idx, filename in enumerate(photo_files):
            file_path = os.path.join(dir_path, filename)
            photo_id = f"photo_{worker_dir}_{idx+1}"
            embedding = extract_sface_neural_vector(file_path)

            record = {
                "workerCode": meta["code"],
                "workerName": meta["name"],
                "workerDir": worker_dir,
                "photoId": photo_id,
                "filename": filename,
                "model": "ArcFace/SFace",
                "detector": "yunet",
                "distanceMetric": "cosine",
                "embedding": embedding
            }
            dataset.append(record)
            total_photos += 1
            print(f"  [+] Generated SFace Neural Vector for {meta['name']} ({meta['code']}) - {filename}")

    output_path = os.path.join(TEST_DATA_DIR, "test_embeddings.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)

    print(f"\nSuccessfully generated {total_photos} SFace neural embeddings for Stage 4 test dataset.")
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    build_test_dataset()
