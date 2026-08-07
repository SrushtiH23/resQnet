import math
from typing import List, Dict, Any

class SensorProcessor:
    """
    SensorProcessor Module
    Handles vector magnitude computation, telemetry feature extraction, and signal filtering.
    """

    @staticmethod
    def compute_magnitudes(ax: float, ay: float, az: float, gx: float, gy: float, gz: float) -> Dict[str, float]:
        total_accel = math.sqrt(ax**2 + ay**2 + az**2)
        total_gyro = math.sqrt(gx**2 + gy**2 + gz**2)
        # Linear acceleration approximation (removing standard 9.81 m/s² gravity vector)
        linear_accel = abs(total_accel - 9.81)
        return {
            "total_accel": round(total_accel, 3),
            "linear_accel": round(linear_accel, 3),
            "total_gyro": round(total_gyro, 3)
        }

    @staticmethod
    def aggregate_telemetry(samples: List[Dict[str, float]]) -> Dict[str, Any]:
        if not samples:
            return {
                "sample_count": 0,
                "avg_accel": 0.0,
                "peak_accel": 0.0,
                "avg_gyro": 0.0,
                "peak_gyro": 0.0,
                "status": "Inactive"
            }

        accels = [s.get("total_accel", 9.81) for s in samples]
        gyros = [s.get("total_gyro", 0.0) for s in samples]

        return {
            "sample_count": len(samples),
            "avg_accel": round(sum(accels) / len(accels), 2),
            "peak_accel": round(max(accels), 2),
            "avg_gyro": round(sum(gyros) / len(gyros), 2),
            "peak_gyro": round(max(gyros), 2),
            "status": "Active (20Hz)"
        }
