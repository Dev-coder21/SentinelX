"""Add severity, confidence, and classification_source to risk_events

Revision ID: 003_add_nlp_event_fields
Revises: 002_add_risk_event_fingerprint
Create Date: 2026-09-30 14:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_add_nlp_event_fields'
down_revision: Union[str, None] = '002_add_risk_event_fingerprint'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('risk_events', sa.Column('severity', sa.Float(), nullable=True))
    op.add_column('risk_events', sa.Column('confidence', sa.Float(), nullable=True))
    op.add_column('risk_events', sa.Column('classification_source', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('risk_events', 'classification_source')
    op.drop_column('risk_events', 'confidence')
    op.drop_column('risk_events', 'severity')
