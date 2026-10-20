"""Add durable research jobs and a shared usage ledger."""
from alembic import op
import sqlalchemy as sa

revision = '0002_research'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('research_budget',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('revision', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('spent_musd', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reserved_musd', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quota_day', sa.String(10), nullable=False, server_default=''),
        sa.Column('searches', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('fetched_urls', sa.Integer(), nullable=False, server_default='0'),
        sa.CheckConstraint('spent_musd >= 0 AND reserved_musd >= 0'))
    op.create_table('research_jobs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('ip_hash', sa.String(64), nullable=False),
        sa.Column('request_data', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('provider_id', sa.String(128)),
        sa.Column('result', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.Integer(), nullable=False),
        sa.Column('reserved_musd', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('step_cost_musd', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('settled', sa.Integer(), nullable=False, server_default='0'))
    for column in ('owner_id', 'fingerprint', 'ip_hash'):
        op.create_index('ix_research_jobs_' + column, 'research_jobs', [column])


def downgrade():
    op.drop_table('research_jobs')
    op.drop_table('research_budget')
