"""add_notification_and_acknowledgements

Revision ID: 001_add_notif_ack
Revises: 
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa

revision = '001_add_notif_ack'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'notification_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('emergency_event_id', sa.Integer(), sa.ForeignKey('emergency_events.id'), nullable=False),
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('family_contacts.id'), nullable=True),
        sa.Column('channel', sa.String(length=20), server_default='SMS', nullable=False),
        sa.Column('provider', sa.String(length=50), server_default='twilio', nullable=False),
        sa.Column('provider_message_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'emergency_acknowledgements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('emergency_event_id', sa.Integer(), sa.ForeignKey('emergency_events.id'), nullable=False),
        sa.Column('contact_id', sa.Integer(), sa.ForeignKey('family_contacts.id'), nullable=True),
        sa.Column('response', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('emergency_acknowledgements')
    op.drop_table('notification_logs')
