"""
PDF export for the Wanderer travel passport.

Generates a styled HTML document and converts it to PDF using WeasyPrint.
Endpoint: GET /api/v1/passport/export/pdf
"""
from __future__ import annotations

from datetime import date
from io import BytesIO
from html import escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.auth import current_user
from app.db.session import get_db
from app.models.travel import TravelEntry, TripPlan
from app.services.travel import BY_ID, progression

router = APIRouter()


def _deny_resource(url, *args, **kwargs):
    """This export uses inline CSS and system fonts; no URL resources are needed."""
    raise ValueError("External resources are disabled for passport exports")


def _stars(rating: int) -> str:
    return "★" * rating + "☆" * (5 - rating)


def _passport_html(user, entries_data: list[dict], trips_data: list[dict], stats: dict) -> str:
    """Build the full passport HTML document."""

    visited = [e for e in entries_data if e["status"] == "Visited"]
    saved = [e for e in entries_data if e["status"] in ("Saved", "Want To Visit")]

    # --- Visited rows ---
    visited_rows = ""
    for e in visited:
        place = BY_ID.get(e["place_id"], {})
        visited_rows += f"""
        <tr>
            <td class="stamp-id">{escape(str(e.get('stamp_id') or '—'))}</td>
            <td><strong>{escape(str(place.get('name', 'Unknown')))}</strong><br><small>{escape(str(place.get('state', '')))}</small></td>
            <td>{escape(str(e.get('visit_date') or '—'))}</td>
            <td class="stars">{_stars(e.get('rating', 5))}</td>
            <td class="notes">{escape(str(e.get('notes') or ''))}</td>
        </tr>"""

    if not visited_rows:
        visited_rows = '<tr><td colspan="5" class="empty">No stamps yet — your first story awaits.</td></tr>'

    # --- Saved rows ---
    saved_rows = ""
    for e in saved:
        place = BY_ID.get(e["place_id"], {})
        saved_rows += f"""
        <tr>
            <td><strong>{escape(str(place.get('name', 'Unknown')))}</strong></td>
            <td>{escape(str(place.get('state', '')))}</td>
            <td>{escape(str(place.get('group', place.get('category', ''))))}</td>
            <td>{escape(str(e['status']))}</td>
        </tr>"""

    if not saved_rows:
        saved_rows = '<tr><td colspan="4" class="empty">No saved places yet.</td></tr>'

    # --- Trip rows ---
    trip_rows = ""
    for t in trips_data:
        dest = BY_ID.get(t.get("place_id"), {})
        trip_rows += f"""
        <tr>
            <td><strong>{escape(str(dest.get('name', 'Unknown')))}</strong></td>
            <td>{escape(str(t.get('origin', '—')))}</td>
            <td>{escape(str(t.get('start', '—')))}</td>
            <td>{escape(str(t.get('days', '—')))} days</td>
            <td>{escape(str(t.get('travelers', 1)))} travelers</td>
            <td>{escape(str(t.get('style', '—')))}</td>
        </tr>"""

    if not trip_rows:
        trip_rows = '<tr><td colspan="6" class="empty">No trips planned yet.</td></tr>'

    # --- Achievements ---
    achievements = stats.get("achievements", [])
    achievement_badges = ""
    for a in achievements:
        status = "unlocked" if a["unlocked"] else "locked"
        achievement_badges += f"""
        <div class="badge {status}">
            <span class="badge-icon">{'✦' if a['unlocked'] else '○'}</span>
            <span class="badge-name">{escape(str(a['name']))}</span>
            <span class="badge-progress">{escape(str(a['count']))}/{escape(str(a['target']))}</span>
        </div>"""

    username = user.username
    if user.password_hash == "!":
        username = "Fellow Wanderer"

    username = escape(username)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Wanderer Passport — {username}</title>
<style>
@page {{
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
}}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #1a1a2e;
    background: #fff;
}}
.cover {{
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 240mm;
    padding: 40mm 20mm;
}}
.cover-emblem {{
    font-size: 48pt;
    color: #e05a47;
    margin-bottom: 8mm;
}}
.cover-title {{
    font-size: 10pt;
    letter-spacing: 4pt;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 3mm;
}}
.cover h1 {{
    font-size: 28pt;
    font-weight: 800;
    letter-spacing: 1pt;
    color: #1a1a2e;
    margin-bottom: 6mm;
}}
.cover-holder {{
    font-size: 14pt;
    font-weight: 600;
    color: #e05a47;
    margin-bottom: 4mm;
}}
.cover-tier {{
    font-size: 11pt;
    color: #555;
    margin-bottom: 3mm;
}}
.cover-xp {{
    font-size: 10pt;
    color: #888;
    margin-bottom: 10mm;
}}
.cover-stats {{
    display: flex;
    gap: 12mm;
    justify-content: center;
    margin-top: 6mm;
}}
.cover-stat {{
    text-align: center;
}}
.cover-stat b {{
    display: block;
    font-size: 22pt;
    color: #e05a47;
}}
.cover-stat small {{
    font-size: 8pt;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1pt;
}}
.cover-footer {{
    margin-top: 16mm;
    font-size: 8pt;
    color: #aaa;
    letter-spacing: 2pt;
    text-transform: uppercase;
}}

/* Sections */
h2 {{
    font-size: 14pt;
    font-weight: 700;
    color: #1a1a2e;
    border-bottom: 2px solid #e05a47;
    padding-bottom: 2mm;
    margin: 8mm 0 4mm 0;
}}
h2 small {{
    font-weight: 400;
    font-size: 9pt;
    color: #888;
    float: right;
    margin-top: 2pt;
}}

/* Tables */
table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6mm;
    font-size: 9pt;
}}
th {{
    background: #f5f0ec;
    color: #1a1a2e;
    font-weight: 600;
    text-align: left;
    padding: 2mm 3mm;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
}}
td {{
    padding: 2mm 3mm;
    border-bottom: 0.5pt solid #eee;
    vertical-align: top;
}}
tr:last-child td {{ border-bottom: none; }}
.stamp-id {{
    font-family: 'Courier New', monospace;
    font-size: 8pt;
    color: #e05a47;
    font-weight: 700;
}}
.stars {{ color: #e05a47; font-size: 10pt; white-space: nowrap; }}
.notes {{ color: #555; font-size: 8pt; max-width: 50mm; }}
.empty {{
    text-align: center;
    color: #aaa;
    font-style: italic;
    padding: 6mm 0;
}}

/* Achievements */
.achievements {{
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
    margin: 4mm 0 8mm 0;
}}
.badge {{
    border: 1pt solid #ddd;
    border-radius: 3mm;
    padding: 3mm 4mm;
    text-align: center;
    width: 30mm;
}}
.badge.unlocked {{
    border-color: #e05a47;
    background: #fdf5f3;
}}
.badge.locked {{
    opacity: 0.5;
}}
.badge-icon {{ font-size: 14pt; display: block; margin-bottom: 1mm; }}
.badge.unlocked .badge-icon {{ color: #e05a47; }}
.badge-name {{ font-size: 8pt; font-weight: 600; display: block; }}
.badge-progress {{ font-size: 7pt; color: #888; }}

/* Footer */
.doc-footer {{
    margin-top: 10mm;
    padding-top: 4mm;
    border-top: 0.5pt solid #ddd;
    text-align: center;
    font-size: 7pt;
    color: #bbb;
    letter-spacing: 1pt;
    text-transform: uppercase;
}}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
    <div class="cover-emblem">✦</div>
    <div class="cover-title">Republic of Wanderers</div>
    <h1>WANDERER<br>PASSPORT</h1>
    <div class="cover-holder">{username}</div>
    <div class="cover-tier">{escape(str(stats.get('tier', 'Explorer')))}</div>
    <div class="cover-xp">{stats.get('xp', 0):,} Travel XP</div>
    <div class="cover-stats">
        <div class="cover-stat"><b>{stats.get('visited', 0)}</b><small>Places visited</small></div>
        <div class="cover-stat"><b>{stats.get('states', 0)}</b><small>States explored</small></div>
        <div class="cover-stat"><b>{len(saved)}</b><small>Saved places</small></div>
        <div class="cover-stat"><b>{len(trips_data)}</b><small>Trips planned</small></div>
    </div>
    <div class="cover-footer">India · Your story, unbound</div>
</div>

<!-- STAMPS (Visited Places) -->
<h2>Field Stamps <small>{len(visited)} memories collected</small></h2>
<table>
    <thead>
        <tr><th>Stamp</th><th>Destination</th><th>Date</th><th>Rating</th><th>Memory</th></tr>
    </thead>
    <tbody>{visited_rows}</tbody>
</table>

<!-- SAVED PLACES -->
<h2>Saved Places <small>{len(saved)} places to explore</small></h2>
<table>
    <thead>
        <tr><th>Destination</th><th>State</th><th>Category</th><th>Status</th></tr>
    </thead>
    <tbody>{saved_rows}</tbody>
</table>

<!-- TRIPS -->
<h2>Trip Plans <small>{len(trips_data)} journeys</small></h2>
<table>
    <thead>
        <tr><th>Destination</th><th>From</th><th>Start</th><th>Duration</th><th>Group</th><th>Style</th></tr>
    </thead>
    <tbody>{trip_rows}</tbody>
</table>

<!-- ACHIEVEMENTS -->
<h2>Achievements <small>{sum(1 for a in achievements if a['unlocked'])}/{len(achievements)} unlocked</small></h2>
<div class="achievements">{achievement_badges}</div>

<div class="doc-footer">
    Wanderer Passport · Exported {date.today().isoformat()} · wanderer.travel
</div>

</body>
</html>"""


@router.get("/passport/export/pdf")
def export_passport_pdf(user=Depends(current_user), db: Session = Depends(get_db)):
    """Generate and return a styled PDF of the user's travel passport."""
    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(
            501,
            "PDF export requires WeasyPrint. Install it with: pip install weasyprint",
        )

    # Gather data
    entries = db.query(TravelEntry).filter_by(user_id=user.id).all()
    entries_data = [
        {
            "place_id": e.place_id,
            "status": e.status,
            "visit_date": str(e.visit_date) if e.visit_date else None,
            "notes": e.notes,
            "rating": e.rating,
            "stamp_id": e.stamp_id,
        }
        for e in entries
    ]
    stats = progression(entries)

    trips = db.query(TripPlan).filter_by(user_id=user.id).order_by(TripPlan.id.desc()).all()
    trips_data = [t.data for t in trips]

    html_content = _passport_html(user, entries_data, trips_data, stats)

    # Generate PDF
    pdf_bytes = HTML(string=html_content, url_fetcher=_deny_resource).write_pdf()
    buffer = BytesIO(pdf_bytes)

    filename = f"wanderer-passport-{date.today().isoformat()}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
