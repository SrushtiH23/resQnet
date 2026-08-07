from typing import List, Dict, Any
from services.sliding_window import SlidingWindowBuffer
from services.state_machine import FallDetectionStateMachine
from services.sensor_processing import SensorProcessor

class IntelligentFallDetector:
    """
    IntelligentFallDetector Orchestrator
    Delegates sliding window buffer analysis to state_machine.py and sensor_processing.py.
    """

    @staticmethod
    def analyze_window(samples: List[Dict[str, float]]) -> Dict[str, Any]:
        return FallDetectionStateMachine.evaluate_window(samples)

    @staticmethod
    def process_frame(ax: float, ay: float, az: float, gx: float, gy: float, gz: float) -> Dict[str, float]:
        return SensorProcessor.compute_magnitudes(ax, ay, az, gx, gy, gz)
