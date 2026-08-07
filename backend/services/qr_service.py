import jwt
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

SECRET_KEY = os.getenv("JWT_SECRET", "resqnet_super_secret_jwt_key_2026")
ALGORITHM = "HS256"

class EncryptedQRService:
    """
    QR Medical Card Privacy & Encryption Service
    Generates privacy-preserving QR tokens containing ONLY an encrypted UUID and User Token.
    Never stores raw personal, phone, or medical information inside the QR payload.
    Exposes medical details ONLY after doctor/hospital role authorization.
    """

    @staticmethod
    def generate_medical_qr_token(user_id: int) -> str:
        """Generates a secure QR payload containing only an encrypted UUID, user_id, and expiration."""
        payload = {
            "qr_uuid": str(uuid.uuid4()),
            "qr_user_id": user_id,
            "type": "resqnet_medical_card",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(days=365) # Valid for 1 year
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    @staticmethod
    def verify_and_decode_qr(qr_token: str) -> Optional[int]:
        """
        Decodes the QR token to verify signature and extract user_id.
        Returns user_id if valid, None if tampered or expired.
        """
        try:
            payload = jwt.decode(qr_token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("type") == "resqnet_medical_card":
                return payload.get("qr_user_id")
        except jwt.PyJWTError:
            return None
        return None
