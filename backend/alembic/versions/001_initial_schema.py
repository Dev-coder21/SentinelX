"""Initial SentinelX schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. suppliers
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('annual_spend', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('criticality_tier', sa.Integer(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliers_name'), 'suppliers', ['name'], unique=False)
    op.create_index(op.f('ix_suppliers_region'), 'suppliers', ['region'], unique=False)

    # 2. dependencies
    op.create_table(
        'dependencies',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('company_product', sa.String(length=255), nullable=False),
        sa.Column('supplier_id', sa.Uuid(), nullable=False),
        sa.Column('dependency_weight', sa.Float(), nullable=False, server_default='1.0'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dependencies_company_product'), 'dependencies', ['company_product'], unique=False)
    op.create_index(op.f('ix_dependencies_supplier_id'), 'dependencies', ['supplier_id'], unique=False)

    # 3. risk_events
    op.create_table(
        'risk_events',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('region', sa.String(length=100), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('headline', sa.String(length=500), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('sentiment_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('raw_url', sa.String(length=1000), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_events_detected_at'), 'risk_events', ['detected_at'], unique=False)
    op.create_index(op.f('ix_risk_events_event_type'), 'risk_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_risk_events_region'), 'risk_events', ['region'], unique=False)
    op.create_index(op.f('ix_risk_events_source'), 'risk_events', ['source'], unique=False)

    # 4. risk_scores
    op.create_table(
        'risk_scores',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('supplier_id', sa.Uuid(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('contributing_factors', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_risk_scores_supplier_id'), 'risk_scores', ['supplier_id'], unique=False)
    op.create_index(op.f('ix_risk_scores_timestamp'), 'risk_scores', ['timestamp'], unique=False)

    # 5. mitigation_plans
    op.create_table(
        'mitigation_plans',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('budget_constraint', sa.Float(), nullable=False),
        sa.Column('selected_suppliers', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('expected_revenue_protected', sa.Float(), nullable=False),
        sa.Column('optimization_notes', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_mitigation_plans_generated_at'), 'mitigation_plans', ['generated_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mitigation_plans_generated_at'), table_name='mitigation_plans')
    op.drop_table('mitigation_plans')
    op.drop_index(op.f('ix_risk_scores_timestamp'), table_name='risk_scores')
    op.drop_index(op.f('ix_risk_scores_supplier_id'), table_name='risk_scores')
    op.drop_table('risk_scores')
    op.drop_index(op.f('ix_risk_events_source'), table_name='risk_events')
    op.drop_index(op.f('ix_risk_events_region'), table_name='risk_events')
    op.drop_index(op.f('ix_risk_events_event_type'), table_name='risk_events')
    op.drop_index(op.f('ix_risk_events_detected_at'), table_name='risk_events')
    op.drop_table('risk_events')
    op.drop_index(op.f('ix_dependencies_supplier_id'), table_name='dependencies')
    op.drop_index(op.f('ix_dependencies_company_product'), table_name='dependencies')
    op.drop_table('dependencies')
    op.drop_index(op.f('ix_suppliers_region'), table_name='suppliers')
    op.drop_index(op.f('ix_suppliers_name'), table_name='suppliers')
    op.drop_table('suppliers')
