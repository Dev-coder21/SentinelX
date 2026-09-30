"""Add metrics and metadata columns to mitigation_plans

Revision ID: 004_add_mitigation_plan_metrics
Revises: 003_add_nlp_event_fields
Create Date: 2026-09-30 14:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004_add_mitigation_plan_metrics'
down_revision: Union[str, None] = '003_add_nlp_event_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mitigation_plans', sa.Column('total_budget_used', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('mitigation_plans', sa.Column('remaining_budget', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column('mitigation_plans', sa.Column('objective_value', sa.Float(), nullable=True, server_default='0.0'))
    op.add_column(
        'mitigation_plans',
        sa.Column(
            'optimization_metadata',
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('mitigation_plans', 'optimization_metadata')
    op.drop_column('mitigation_plans', 'objective_value')
    op.drop_column('mitigation_plans', 'remaining_budget')
    op.drop_column('mitigation_plans', 'total_budget_used')
