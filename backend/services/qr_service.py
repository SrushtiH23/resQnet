import secrets
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from models import QRCard, User

class SecureQRService:
    """
    ResQNet Privacy-Preserving QR Token Engine
    - Generates 256-bit random, non-guessable secure tokens server-side.
    - NEVER encodes medical history, personal data, or DB primary keys in the QR.
    - Supports instant token revocation and regeneration.
    """

    @staticmethod
    def generate_token() -> str:
        """Generates a non-guessable, 256-bit secure URL-safe random token."""
        return f"rq_tok_{secrets.token_urlsafe(32)}"

    @classmethod
    def get_or_create_patient_qr(cls, db: Session, user_id: int) -> QRCard:
        """
        Finds the patient's existing active QR code card.
        If none exists, generates a new secure QR token row.
        """
        qr = None
        try:
            qr = db.query(QRCard).filter(
                QRCard.user_id == user_id,
                QRCard.is_active == True
            ).order_by(QRCard.created_at.desc()).first()
        except Exception:
            try:
                db.rollback()
                qr = db.query(QRCard).filter(QRCard.user_id == user_id).first()
            except Exception:
                db.rollback()

        if not qr:
            token = cls.generate_token()
            qr = QRCard(
                user_id=user_id,
                qr_code_token=token,
                is_active=True,
                created_at=datetime.utcnow()
            )
            try:
                db.add(qr)
                db.commit()
                db.refresh(qr)
            except Exception:
                db.rollback()

        return qr

    @classmethod
    def regenerate_patient_qr(cls, db: Session, user_id: int) -> QRCard:
        """
        Revokes all existing QR tokens for the patient and issues a new active secure token.
        """
        # Revoke old tokens
        active_qrs = db.query(QRCard).filter(
            QRCard.user_id == user_id,
            QRCard.is_active == True
        ).all()

        for old_qr in active_qrs:
            old_qr.is_active = False
            old_qr.revoked_at = datetime.utcnow()

        # Create new active token
        new_token = cls.generate_token()
        new_qr = QRCard(
            user_id=user_id,
            qr_code_token=new_token,
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(new_qr)
        db.commit()
        db.refresh(new_qr)

        return new_qr

    @classmethod
    def validate_token(cls, db: Session, token: str) -> Tuple[Optional[QRCard], Optional[str]]:
        """
        Validates the QR token.
        Returns (QRCard, None) if valid.
        Returns (None, error_reason) if invalid or revoked.
        """
        # Extract token string if full URL was provided
        clean_token = token.strip()
        if "/qr/patient/" in clean_token:
            clean_token = clean_token.split("/qr/patient/")[-1].strip()

        qr = db.query(QRCard).filter(QRCard.qr_code_token == clean_token).first()
        if not qr:
            return None, "Invalid ResQNet QR code."

        if not qr.is_active or qr.revoked_at is not None:
            return None, "This QR code is no longer active."

        return qr, None
