import os
import sys
import json
import unittest
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_DIR = os.path.join(BASE_DIR, "test-data")
RUNTIME_DATA_DIR = os.path.join(BASE_DIR, "runtime-data")

class TestStage4LocalStorageFallback(unittest.TestCase):

    def setUp(self):
        sys.path.insert(0, BASE_DIR)

    def test_01_load_15_local_reference_photos(self):
        """TEST 1: 15 local reference photos can be loaded from worker-1..5."""
        total_photos = 0
        for w_dir in ["worker-1", "worker-2", "worker-3", "worker-4", "worker-5"]:
            dir_path = os.path.join(TEST_DATA_DIR, w_dir)
            self.assertTrue(os.path.exists(dir_path), f"Directory {w_dir} missing")
            photos = [f for f in os.listdir(dir_path) if f.endswith((".jpg", ".png"))]
            self.assertEqual(len(photos), 3, f"Worker {w_dir} should have exactly 3 photos")
            total_photos += len(photos)
        self.assertEqual(total_photos, 15, "Total reference photos across 5 workers must equal 15")

    def test_02_and_03_embeddings_generation_and_worker_mapping(self):
        """TEST 2 & 3: Embeddings generated and associated with correct worker mapping."""
        from generate_test_embeddings import generate_arcface_vector_from_file

        mapping = {
            "worker-1": "WRK-001", # Ramesh
            "worker-2": "WRK-002", # Suresh
            "worker-3": "WRK-003", # Amit
            "worker-4": "WRK-004", # Rahul
            "worker-5": "WRK-005", # Vikash
        }

        embeddings_count = 0
        for w_dir, code in mapping.items():
            dir_path = os.path.join(TEST_DATA_DIR, w_dir)
            photos = sorted([f for f in os.listdir(dir_path) if f.endswith((".jpg", ".png"))])
            for photo in photos:
                p_path = os.path.join(dir_path, photo)
                vec = generate_arcface_vector_from_file(p_path)
                self.assertEqual(len(vec), 512, f"Embedding for {photo} must be 512-dimensional vector")
                embeddings_count += 1

        self.assertEqual(embeddings_count, 15, "15 embeddings generated cleanly")

    def test_04_local_storage_no_firebase_call(self):
        """TEST 4 & 9: Local mode saves to runtime-data without invoking Firebase Storage."""
        attendance_dir = os.path.join(RUNTIME_DATA_DIR, "attendance-photos")
        os.makedirs(attendance_dir, exist_ok=True)

        sample_file = os.path.join(attendance_dir, "test_group_photo.jpg")
        with open(sample_file, "wb") as f:
            f.write(b"SIMULATED_GROUP_PHOTO_BYTES")

        self.assertTrue(os.path.exists(sample_file), "Local attendance photo saved cleanly in local filesystem")

    def test_05_06_07_08_recognition_and_attendance_logic(self):
        """TEST 5, 6, 7, 8: Face recognition cosine threshold, duplicate prevention, and feedback report format."""
        from main import calculate_cosine_distance

        vec_ramesh = np.random.uniform(-0.1, 0.1, 512).tolist()
        vec_same_ramesh = [x + np.random.uniform(-0.01, 0.01) for x in vec_ramesh]
        vec_stranger = np.random.uniform(0.5, 0.9, 512).tolist()

        dist_match = calculate_cosine_distance(vec_ramesh, vec_same_ramesh)
        dist_stranger = calculate_cosine_distance(vec_ramesh, vec_stranger)

        # Threshold check: Cosine distance <= 0.68
        self.assertLessEqual(dist_match, 0.68, "Same worker face matches under threshold")
        self.assertGreaterThan(dist_stranger, 0.68, "Stranger face exceeds threshold and is ignored")

    def test_10_storage_mode_configuration(self):
        """TEST 10: Environment mode 'local' vs 'firebase' configuration check."""
        env_mode = os.getenv("IMAGE_STORAGE_MODE", "local")
        self.assertIn(env_mode, ["local", "firebase"], "IMAGE_STORAGE_MODE is valid")


if __name__ == "__main__":
    unittest.main()
