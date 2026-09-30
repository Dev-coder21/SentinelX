"""Add fingerprint column to risk_events for deduplication

Revision ID: 002_add_risk_event_fingerprint
Revises: 001_initial_schema
Create Date: 2026-09-30 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_risk_event_fingerprint'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('risk_events', sa.Column('fingerprint', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_risk_events_fingerprint'), 'risk_events', ['fingerprint'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_risk_events_fingerprint'), table_name='risk_events')
    op.drop_column('risk_events', 'fingerprint')
