import unittest
import math
from typing import List, Dict, Any
from backend.services.state_machine import FallDetectionStateMachine, FallDetectionStages

def create_frame(ax=0.0, ay=9.81, az=0.0, gx=0.0, gy=0.0, gz=0.0, ts=0.0, gyro_avail=True):
    tot_a = math.sqrt(ax**2 + ay**2 + az**2)
    tot_g = math.sqrt(gx**2 + gy**2 + gz**2)
    return {
        "ax": round(ax, 2), "ay": round(ay, 2), "az": round(az, 2),
        "total_accel": round(tot_a, 2),
        "gx": round(gx, 2), "gy": round(gy, 2), "gz": round(gz, 2),
        "total_gyro": round(tot_g, 2),
        "timestamp": ts,
        "gyro_available": gyro_avail
    }

class SensorSequenceGenerator:
    """Generates synthetic high-frequency 20Hz sensor sequences representing daily activities and falls."""

    @staticmethod
    def generate_genuine_fall() -> List[Dict[str, Any]]:
        frames = []
        # 1. Normal standing baseline (1.0s = 20 frames)
        for i in range(20):
            frames.append(create_frame(ax=0.2, ay=9.8, az=0.3, ts=i*50))
        # 2. Descent / Free-fall dip (300ms = 6 frames, acc drops to ~3.5 m/s²)
        for i in range(6):
            frames.append(create_frame(ax=1.2, ay=3.2, az=1.0, gx=95.0, gy=40.0, gz=30.0, ts=(20+i)*50))
        # 3. High impact shock peak (150ms = 3 frames, acc peaks at 24.5 m/s², gyro spikes to 260°/s)
        frames.append(create_frame(ax=12.0, ay=18.0, az=11.5, gx=210.0, gy=120.0, gz=90.0, ts=1300))
        frames.append(create_frame(ax=8.0, ay=22.5, az=7.0, gx=180.0, gy=90.0, gz=70.0, ts=1350))
        frames.append(create_frame(ax=4.0, ay=15.0, az=4.0, gx=100.0, gy=50.0, gz=40.0, ts=1400))
        # 4. Post-impact resting stillness (2.0s = 40 frames, posture tilted to floor, acc ~9.8 m/s² on Z axis, low variance)
        for i in range(40):
            frames.append(create_frame(ax=0.3, ay=0.5, az=9.78, gx=2.0, gy=1.5, gz=1.0, ts=1450 + i*50))
        return frames

    @staticmethod
    def generate_walking() -> List[Dict[str, Any]]:
        frames = []
        # Periodic 1.5Hz walking steps over 3 seconds (60 frames)
        for i in range(60):
            t = i * 0.05
            oscill = 2.5 * math.sin(2 * math.pi * 1.5 * t)
            frames.append(create_frame(ax=1.0*math.cos(t), ay=9.8 + oscill, az=1.2, gx=35.0, gy=20.0, gz=15.0, ts=i*50))
        return frames

    @staticmethod
    def generate_sitting_down() -> List[Dict[str, Any]]:
        frames = []
        # Standing (15 frames)
        for i in range(15):
            frames.append(create_frame(ax=0.1, ay=9.8, az=0.2, ts=i*50))
        # Gentle bending / sitting (acc dips to 7.5 m/s², seat contact shock only 13.5 m/s², no high impact >= 16.5)
        for i in range(8):
            frames.append(create_frame(ax=1.0, ay=7.5, az=2.0, gx=45.0, gy=25.0, gz=10.0, ts=(15+i)*50))
        frames.append(create_frame(ax=2.0, ay=13.5, az=3.0, gx=50.0, gy=30.0, gz=15.0, ts=1150))
        # Settled in chair (35 frames)
        for i in range(35):
            frames.append(create_frame(ax=0.2, ay=6.5, az=7.3, gx=1.0, gy=0.5, gz=0.5, ts=1200 + i*50))
        return frames

    @staticmethod
    def generate_lying_down() -> List[Dict[str, Any]]:
        frames = []
        # Smooth transition from vertical (standing) to horizontal (bed/couch), peak acc < 12 m/s²
        for i in range(50):
            t = i / 50.0
            angle = t * (math.pi / 2.0)
            ay = 9.8 * math.cos(angle)
            az = 9.8 * math.sin(angle)
            frames.append(create_frame(ax=0.1, ay=ay, az=az, gx=30.0, gy=15.0, gz=5.0, ts=i*50))
        return frames

    @staticmethod
    def generate_running() -> List[Dict[str, Any]]:
        frames = []
        # Vigorous high-frequency oscillation, continuous motion without stillness
        for i in range(60):
            t = i * 0.05
            oscill = 6.0 * math.sin(2 * math.pi * 3.0 * t)
            frames.append(create_frame(ax=3.0*math.cos(t*2), ay=9.8 + oscill, az=4.0, gx=90.0, gy=70.0, gz=45.0, ts=i*50))
        return frames

    @staticmethod
    def generate_jumping() -> List[Dict[str, Any]]:
        frames = []
        # Standing (15 frames)
        for i in range(15):
            frames.append(create_frame(ax=0.0, ay=9.8, az=0.0, ts=i*50))
        # Flight phase / in-air free fall (300ms, acc drops to 2.5 m/s²)
        for i in range(6):
            frames.append(create_frame(ax=0.5, ay=2.5, az=0.5, ts=(15+i)*50))
        # Landing shock peak (22.0 m/s²)
        frames.append(create_frame(ax=2.0, ay=22.0, az=2.0, gx=40.0, gy=30.0, gz=20.0, ts=1050))
        # IMMEDIATE movement resumption / recovery (walking/jogging, high variance > 5.0 m/s²)
        for i in range(35):
            t = i * 0.05
            oscill = 5.0 * math.sin(2 * math.pi * 2.0 * t)
            frames.append(create_frame(ax=1.5, ay=9.8 + oscill, az=2.0, gx=60.0, gy=40.0, gz=30.0, ts=1100 + i*50))
        return frames

    @staticmethod
    def generate_sudden_phone_movement() -> List[Dict[str, Any]]:
        frames = []
        # Fast hand waving / swiping gestures: high gyro ~220°/s, moderate acc ~14.0 m/s² (no shock peak >= 16.5)
        for i in range(50):
            t = i * 0.05
            frames.append(create_frame(ax=4.0*math.sin(t*5), ay=9.8 + 3.0*math.cos(t*5), az=2.0, gx=220.0*math.sin(t*4), gy=180.0, gz=90.0, ts=i*50))
        return frames

    @staticmethod
    def generate_flat_phone_drop() -> List[Dict[str, Any]]:
        frames = []
        # Flat drop on table/floor: free fall (2.0 m/s²), sharp shock (25.0 m/s²), BUT flat landing without body rotation or posture tilt change
        for i in range(15):
            frames.append(create_frame(ax=0.0, ay=9.8, az=0.0, ts=i*50))
        # Free fall
        for i in range(6):
            frames.append(create_frame(ax=0.1, ay=2.0, az=0.1, gx=10.0, gy=5.0, gz=5.0, ts=(15+i)*50))
        # Flat impact shock
        frames.append(create_frame(ax=0.5, ay=25.0, az=0.5, gx=25.0, gy=15.0, gz=10.0, ts=1050))
        # Resting flat on table in same orientation (variance < 0.2, tilt < 5°)
        for i in range(35):
            frames.append(create_frame(ax=0.0, ay=9.8, az=0.0, gx=0.5, gy=0.5, gz=0.5, ts=1100 + i*50))
        return frames

class TestSensorRepeatability(unittest.TestCase):
    """
    Automated repeatability test suite replaying identical sensor sequences
    multiple times to verify deterministic, consistent detection states and results.
    """

    def _stream_and_evaluate(self, sequence: List[Dict[str, Any]], buffer_size: int = 100) -> Dict[str, Any]:
        buf = []
        final_result = None
        state_history = []
        for frame in sequence:
            buf.append(frame)
            if len(buf) > buffer_size:
                buf.pop(0)
            if len(buf) >= 20:
                res = FallDetectionStateMachine.evaluate_window(buf)
                final_result = res
                state_history.append(res["stage"])
                if res["is_fall"]:
                    return {"detected": True, "final_stage": res["stage"], "result": res, "state_history": state_history}
        return {"detected": False, "final_stage": final_result["stage"] if final_result else "NORMAL", "result": final_result, "state_history": state_history}

    def test_repeatability_genuine_fall(self):
        """Genuine fall must be detected consistently 10 times in a row with identical state transitions."""
        seq = SensorSequenceGenerator.generate_genuine_fall()
        results = [self._stream_and_evaluate(seq) for _ in range(10)]
        for idx, r in enumerate(results):
            self.assertTrue(r["detected"], f"Run #{idx+1} failed to detect genuine fall")
            self.assertEqual(r["final_stage"], FallDetectionStages.USER_CONFIRMATION)
        # Verify deterministic reproducibility: all runs produce identical state sequences
        first_history = results[0]["state_history"]
        for idx, r in enumerate(results[1:], start=2):
            self.assertEqual(r["state_history"], first_history, f"Run #{idx} produced different state transition history")

    def test_repeatability_walking_rejected(self):
        """Normal walking must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_walking()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Walking triggered false alarm on run #{idx+1}")

    def test_repeatability_sitting_down_rejected(self):
        """Sitting down on a chair must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_sitting_down()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Sitting down triggered false alarm on run #{idx+1}")

    def test_repeatability_lying_down_rejected(self):
        """Lying down smoothly on bed must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_lying_down()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Lying down triggered false alarm on run #{idx+1}")

    def test_repeatability_running_rejected(self):
        """Running with heavy footsteps must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_running()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Running triggered false alarm on run #{idx+1}")

    def test_repeatability_jumping_recovered_rejected(self):
        """Jumping with immediate movement recovery must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_jumping()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Jumping triggered false alarm on run #{idx+1}")

    def test_repeatability_sudden_phone_movement_rejected(self):
        """Sudden gestures/phone waving must be consistently rejected across 10 repeated runs."""
        seq = SensorSequenceGenerator.generate_sudden_phone_movement()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Sudden phone movement triggered false alarm on run #{idx+1}")

    def test_repeatability_flat_phone_drop_rejected(self):
        """Flat phone drop without angular body rotation or posture tilt must be consistently rejected."""
        seq = SensorSequenceGenerator.generate_flat_phone_drop()
        for idx in range(10):
            r = self._stream_and_evaluate(seq)
            self.assertFalse(r["detected"], f"Flat phone drop triggered false alarm on run #{idx+1}")

if __name__ == "__main__":
    unittest.main()
