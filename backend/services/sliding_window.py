import math
from collections import deque
from typing import List, Dict, Any

class SlidingWindowBuffer:
    """
    SlidingWindowBuffer Module
    Maintains a rolling 5-second buffer (100 samples @ 20Hz) of accelerometer & gyroscope readings.
    Complexity: O(1) insertion and eviction.
    """
    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self.buffer = deque(maxlen=capacity)

    def push(self, ax: float, ay: float, az: float, gx: float, gy: float, gz: float) -> Dict[str, float]:
        total_accel = math.sqrt(ax**2 + ay**2 + az**2)
        total_gyro = math.sqrt(gx**2 + gy**2 + gz**2)
        sample = {
            "ax": ax, "ay": ay, "az": az,
            "gx": gx, "gy": gy, "gz": gz,
            "total_accel": total_accel,
            "total_gyro": total_gyro
        }
        self.buffer.append(sample)
        return sample

    def get_samples(self) -> List[Dict[str, float]]:
        return list(self.buffer)

    def clear(self):
        self.buffer.clear()

    def get_statistics(self) -> Dict[str, float]:
        samples = self.get_samples()
        if not samples:
            return {"min_accel": 0.0, "max_accel": 0.0, "max_gyro": 0.0, "accel_variance": 0.0}

        accels = [s["total_accel"] for s in samples]
        gyros = [s["total_gyro"] for s in samples]
        min_accel = min(accels)
        max_accel = max(accels)
        max_gyro = max(gyros)

        tail_count = max(3, int(len(samples) * 0.3))
        tail_accels = accels[-tail_count:]
        accel_variance = max(tail_accels) - min(tail_accels)

        return {
            "min_accel": min_accel,
            "max_accel": max_accel,
            "max_gyro": max_gyro,
            "accel_variance": accel_variance
        }
