"""Create the Wanderer v1 schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False), sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("profile_image", sa.String()), sa.Column("bio", sa.String()), sa.Column("role", sa.String(), server_default="USER"),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.false()), sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("username"), sa.UniqueConstraint("email"))
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table("destinations",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(), nullable=False), sa.Column("state", sa.String(), nullable=False),
        sa.Column("region", sa.String()), sa.Column("category", sa.String()), sa.Column("mood", sa.String()), sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()), sa.Column("image_url", sa.String()), sa.Column("description", sa.Text()), sa.Column("budget_per_day", sa.Integer()),
        sa.Column("tags", sa.String()), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    for name, column in (("ix_destinations_name", "name"), ("ix_destinations_state", "state"), ("ix_destinations_category", "category"), ("ix_destinations_mood", "mood")):
        op.create_index(name, "destinations", [column])
    op.create_table("public_profiles", sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True), sa.Column("display_name", sa.String(80), nullable=False, server_default=""), sa.Column("bio", sa.String(500), nullable=False, server_default=""), sa.Column("home_region", sa.String(80), nullable=False, server_default=""), sa.Column("interests", sa.String(300), nullable=False, server_default=""), sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table("travel_entries", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("place_id", sa.Integer(), sa.ForeignKey("destinations.id"), nullable=False), sa.Column("status", sa.String(), nullable=False, server_default="Saved"), sa.Column("visit_date", sa.Date()), sa.Column("notes", sa.Text(), server_default=""), sa.Column("rating", sa.Integer(), server_default="5"), sa.Column("stamp_id", sa.String()), sa.UniqueConstraint("user_id", "place_id", name="uq_user_place"))
    op.create_index("ix_travel_entries_user_id", "travel_entries", ["user_id"])
    op.create_table("trip_plans", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("data", sa.JSON(), nullable=False))
    op.create_index("ix_trip_plans_user_id", "trip_plans", ["user_id"])
    op.create_table("blogs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("title", sa.String(160), nullable=False, server_default=""), sa.Column("subtitle", sa.String(300), nullable=False, server_default=""), sa.Column("body", sa.Text(), nullable=False, server_default=""), sa.Column("place_id", sa.Integer(), sa.ForeignKey("destinations.id")), sa.Column("status", sa.String(20), nullable=False, server_default="draft"), sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("version", sa.Integer(), nullable=False, server_default="1"), sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_blogs_author_id", "blogs", ["author_id"]); op.create_index("ix_blogs_place_id", "blogs", ["place_id"]); op.create_index("ix_blogs_status", "blogs", ["status"])
    op.create_table("blog_reports", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False), sa.Column("blog_id", sa.Integer(), sa.ForeignKey("blogs.id"), nullable=False), sa.Column("reason", sa.String(80), nullable=False), sa.Column("detail", sa.String(1000), nullable=False, server_default=""), sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()), sa.UniqueConstraint("user_id", "blog_id", name="uq_blog_report"))
    op.create_index("ix_blog_reports_blog_id", "blog_reports", ["blog_id"])

def downgrade():
    for table in ("blog_reports", "blogs", "trip_plans", "travel_entries", "public_profiles", "destinations", "users"):
        op.drop_table(table)
