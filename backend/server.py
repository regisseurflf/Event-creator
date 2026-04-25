from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import httpx
import certifi
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional, Literal
from datetime import datetime, timezone, date as date_cls, timedelta

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)  # silently ignored if absent in packaged app

mongo_url = os.environ['MONGO_URL']
# Désactiver TLS pour les connexions locales (localhost/127.0.0.1)
_is_local = any(h in mongo_url for h in ['localhost', '127.0.0.1'])
client = AsyncIOMotorClient(
    mongo_url,
    **({} if _is_local else {'tlsCAFile': certifi.where()}),
)
db = client[os.environ['DB_NAME']]

# ── Stockage local ───────────────────────────────────────────────────────────
UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", str(ROOT_DIR / "uploads")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Sauvegarde un fichier localement."""
    filename = Path(path).name
    dest = UPLOADS_DIR / filename
    dest.write_bytes(data)
    return {"path": str(dest), "size": len(data)}

async def get_object(storage_path: str):
    """Lit un fichier local."""
    import mimetypes
    p = Path(storage_path)
    if not p.exists():
        raise FileNotFoundError(f"Fichier introuvable : {storage_path}")
    content_type = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return p.read_bytes(), content_type

# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Stockage local : {UPLOADS_DIR}")
    yield
    client.close()

app = FastAPI(title="L'Ampli API", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

def now_iso():
    return datetime.now(timezone.utc).isoformat()

class FileRef(BaseModel):
    id: str
    original_filename: str
    content_type: str
    size: int

class Artist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    bio: Optional[str] = ""
    genre: Optional[str] = ""
    website: Optional[str] = ""
    social_links: Optional[str] = ""
    photo_file_id: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class ArtistCreate(BaseModel):
    name: str
    bio: Optional[str] = ""
    genre: Optional[str] = ""
    website: Optional[str] = ""
    social_links: Optional[str] = ""
    photo_file_id: Optional[str] = None

class Venue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: Optional[str] = ""
    capacity: Optional[int] = 0
    stage_type: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class VenueCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    capacity: Optional[int] = 0
    stage_type: Optional[str] = ""
    notes: Optional[str] = ""

EventType = Literal["concert", "spectacle", "residence"]
EventStatus = Literal["confirmed", "option", "cancelled"]

def _validate_iso_date(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    try:
        s = v[:10]
        date_cls.fromisoformat(s)
        return s
    except Exception:
        raise ValueError("Date invalide (format attendu YYYY-MM-DD)")

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    type: EventType
    artist_ids: List[str] = []
    venue_id: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    status: EventStatus = "option"
    poster_file_id: Optional[str] = None
    tech_rider_file_id: Optional[str] = None
    contract_file_id: Optional[str] = None
    notes: Optional[str] = ""
    created_at: str = Field(default_factory=now_iso)

class EventCreate(BaseModel):
    title: str
    type: EventType
    artist_ids: List[str] = []
    venue_id: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    status: EventStatus = "option"
    poster_file_id: Optional[str] = None
    tech_rider_file_id: Optional[str] = None
    contract_file_id: Optional[str] = None
    notes: Optional[str] = ""

    @field_validator("start_date")
    @classmethod
    def _v_start(cls, v):
        out = _validate_iso_date(v)
        if out is None:
            raise ValueError("Date de début obligatoire (YYYY-MM-DD)")
        return out

    @field_validator("end_date")
    @classmethod
    def _v_end(cls, v):
        return _validate_iso_date(v)

class EventDatesUpdate(BaseModel):
    start_date: str
    end_date: Optional[str] = None

    @field_validator("start_date")
    @classmethod
    def _v_start(cls, v):
        out = _validate_iso_date(v)
        if out is None:
            raise ValueError("Date de début obligatoire (YYYY-MM-DD)")
        return out

    @field_validator("end_date")
    @classmethod
    def _v_end(cls, v):
        return _validate_iso_date(v)

# ============ File upload ============
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 25 Mo)")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    file_id = str(uuid.uuid4())
    path = f"{file_id}.{ext}"
    content_type = file.content_type or "application/octet-stream"
    result = await put_object(path, data, content_type)
    doc = {
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {"id": file_id, "original_filename": file.filename, "content_type": content_type, "size": doc["size"]}

@api_router.get("/files/{file_id}")
async def download_file(file_id: str):
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    data, content_type = await get_object(record["storage_path"])
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Content-Disposition": f'inline; filename="{record["original_filename"]}"'},
    )

@api_router.get("/files/{file_id}/info", response_model=FileRef)
async def file_info(file_id: str):
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return FileRef(id=record["id"], original_filename=record["original_filename"],
                   content_type=record["content_type"], size=record["size"])

# ============ Artists ============
@api_router.get("/artists", response_model=List[Artist])
async def list_artists():
    return await db.artists.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.post("/artists", response_model=Artist)
async def create_artist(payload: ArtistCreate):
    artist = Artist(**payload.model_dump())
    await db.artists.insert_one(artist.model_dump())
    return artist

@api_router.get("/artists/{artist_id}", response_model=Artist)
async def get_artist(artist_id: str):
    item = await db.artists.find_one({"id": artist_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Artiste introuvable")
    return item

@api_router.put("/artists/{artist_id}", response_model=Artist)
async def update_artist(artist_id: str, payload: ArtistCreate):
    result = await db.artists.update_one({"id": artist_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artiste introuvable")
    return await db.artists.find_one({"id": artist_id}, {"_id": 0})

@api_router.delete("/artists/{artist_id}")
async def delete_artist(artist_id: str):
    result = await db.artists.delete_one({"id": artist_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artiste introuvable")
    # Cascade: remove artist_id from all events
    await db.events.update_many(
        {"artist_ids": artist_id},
        {"$pull": {"artist_ids": artist_id}},
    )
    return {"ok": True}

# ============ Venues ============
@api_router.get("/venues", response_model=List[Venue])
async def list_venues():
    return await db.venues.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.post("/venues", response_model=Venue)
async def create_venue(payload: VenueCreate):
    venue = Venue(**payload.model_dump())
    await db.venues.insert_one(venue.model_dump())
    return venue

@api_router.get("/venues/{venue_id}", response_model=Venue)
async def get_venue(venue_id: str):
    item = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    return item

@api_router.put("/venues/{venue_id}", response_model=Venue)
async def update_venue(venue_id: str, payload: VenueCreate):
    result = await db.venues.update_one({"id": venue_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    return await db.venues.find_one({"id": venue_id}, {"_id": 0})

@api_router.delete("/venues/{venue_id}")
async def delete_venue(venue_id: str):
    result = await db.venues.delete_one({"id": venue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    # Cascade: clear venue_id from all events that referenced this venue
    await db.events.update_many(
        {"venue_id": venue_id},
        {"$set": {"venue_id": None}},
    )
    return {"ok": True}

# ============ Events ============
@api_router.get("/events", response_model=List[Event])
async def list_events(type: Optional[str] = None):
    query = {}
    if type:
        query["type"] = type
    return await db.events.find(query, {"_id": 0}).sort("start_date", 1).to_list(2000)

@api_router.post("/events", response_model=Event)
async def create_event(payload: EventCreate):
    event = Event(**payload.model_dump())
    await db.events.insert_one(event.model_dump())
    return event

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str):
    item = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return item

@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, payload: EventCreate):
    result = await db.events.update_one({"id": event_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return await db.events.find_one({"id": event_id}, {"_id": 0})

@api_router.patch("/events/{event_id}/dates", response_model=Event)
async def update_event_dates(event_id: str, payload: EventDatesUpdate):
    update = {"start_date": payload.start_date}
    if payload.end_date is not None:
        update["end_date"] = payload.end_date
    result = await db.events.update_one({"id": event_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return await db.events.find_one({"id": event_id}, {"_id": 0})

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return {"ok": True}

# ============ Roadmap PDF ============
TYPE_LABEL_FR = {"concert": "Concert", "spectacle": "Spectacle", "residence": "Résidence"}
STATUS_LABEL_FR = {"confirmed": "Confirmé", "option": "Option", "cancelled": "Annulé"}

def _fmt_date(iso: Optional[str]) -> str:
    if not iso:
        return "—"
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        try:
            d = datetime.strptime(iso[:10], "%Y-%m-%d")
        except Exception:
            return iso
    months = ["janvier", "février", "mars", "avril", "mai", "juin",
             "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    return f"{d.day:02d} {months[d.month - 1]} {d.year}"

PDF_BLACK = colors.HexColor("#0A0A0C")
PDF_ORANGE = colors.HexColor("#FF5A00")
PDF_GREY = colors.HexColor("#71717A")
PDF_RULE = colors.HexColor("#E4E4E7")

def _pdf_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold",
                                fontSize=24, leading=28, textColor=PDF_BLACK, spaceAfter=2),
        "sub": ParagraphStyle("s", parent=styles["Normal"], fontName="Helvetica",
                              fontSize=9, textColor=PDF_GREY, leading=12, spaceAfter=10),
        "h2": ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                             fontSize=11, textColor=PDF_BLACK, leading=14,
                             spaceBefore=10, spaceAfter=6),
        "body": ParagraphStyle("b", parent=styles["Normal"], fontName="Helvetica",
                               fontSize=10, textColor=PDF_BLACK, leading=14),
        "meta": ParagraphStyle("m", parent=styles["Normal"], fontName="Helvetica",
                               fontSize=9, textColor=PDF_GREY, leading=12),
    }

def _pdf_rule_elem(width_mm: float, thickness: int, color) -> Table:
    t = Table([[""]], colWidths=[width_mm * mm], rowHeights=[thickness])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color)]))
    return t

def _pdf_info_table(event: dict, venue: Optional[dict], artists: list, styles: dict) -> Table:
    rows = [["DATE", _fmt_date(event.get("start_date"))]]
    if event.get("end_date") and event["end_date"] != event.get("start_date"):
        rows.append(["FIN", _fmt_date(event["end_date"])])
    if venue:
        line = venue["name"]
        if venue.get("address"):
            line += f"<br/><font color='#71717A' size='9'>{venue['address']}</font>"
        if venue.get("capacity"):
            line += (f"<br/><font color='#71717A' size='9'>"
                     f"Jauge : {venue['capacity']} · Scène : {venue.get('stage_type') or '—'}</font>")
        rows.append(["LIEU", Paragraph(line, styles["body"])])
    else:
        rows.append(["LIEU", "À définir"])
    if artists:
        rows.append(["ARTISTES", ", ".join(a["name"] for a in artists)])
    table = Table(rows, colWidths=[32 * mm, 138 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), PDF_GREY),
        ("TEXTCOLOR", (1, 0), (1, -1), PDF_BLACK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, PDF_RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table

def _pdf_artist_block(a: dict) -> str:
    block = f"<b>{a['name']}</b>"
    if a.get("genre"):
        block += f" &nbsp;<font color='#71717A' size='9'>· {a['genre']}</font>"
    if a.get("bio"):
        block += f"<br/>{a['bio']}"
    if a.get("website"):
        block += f"<br/><font color='#FF5A00'>{a['website']}</font>"
    if a.get("social_links"):
        block += f"<br/><font color='#71717A' size='9'>{a['social_links']}</font>"
    return block

def _build_roadmap_story(event: dict, venue: Optional[dict], artists: list) -> list:
    styles = _pdf_styles()
    story = []
    story.append(Paragraph("FEUILLE DE ROUTE · L'AMPLI", styles["sub"]))
    story.append(Paragraph(event["title"], styles["title"]))
    story.append(Paragraph(
        f"{TYPE_LABEL_FR.get(event['type'], event['type']).upper()} &nbsp;·&nbsp; "
        f"Statut : {STATUS_LABEL_FR.get(event['status'], event['status'])}",
        styles["sub"],
    ))
    story.append(_pdf_rule_elem(170, 2, PDF_ORANGE))
    story.append(Spacer(1, 10))
    story.append(_pdf_info_table(event, venue, artists, styles))
    story.append(Spacer(1, 14))
    if artists:
        story.append(Paragraph("FICHES ARTISTES", styles["h2"]))
        for a in artists:
            story.append(Paragraph(_pdf_artist_block(a), styles["body"]))
            story.append(Spacer(1, 8))
    if venue and venue.get("notes"):
        story.append(Paragraph("LOGES / BACKLINE / ACCUEIL", styles["h2"]))
        story.append(Paragraph(venue["notes"].replace("\n", "<br/>"), styles["body"]))
    if event.get("notes"):
        story.append(Paragraph("NOTES DE PRODUCTION", styles["h2"]))
        story.append(Paragraph(event["notes"].replace("\n", "<br/>"), styles["body"]))
    story.append(Spacer(1, 18))
    story.append(_pdf_rule_elem(170, 1, PDF_RULE))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Générée le {_fmt_date(datetime.now(timezone.utc).isoformat())} · L'Ampli",
        styles["meta"],
    ))
    return story

async def _load_event_context(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    venue = None
    if event.get("venue_id"):
        venue = await db.venues.find_one({"id": event["venue_id"]}, {"_id": 0})
    artists = []
    if event.get("artist_ids"):
        async for a in db.artists.find({"id": {"$in": event["artist_ids"]}}, {"_id": 0}):
            artists.append(a)
    return event, venue, artists

def _render_pdf(event: dict, story: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm,
        title=f"Feuille de route — {event['title']}")
    doc.build(story)
    pdf = buf.getvalue()
    buf.close()
    return pdf

@api_router.get("/events/{event_id}/roadmap.pdf")
async def event_roadmap_pdf(event_id: str):
    event, venue, artists = await _load_event_context(event_id)
    story = _build_roadmap_story(event, venue, artists)
    pdf = _render_pdf(event, story)
    safe_title = "".join(c if c.isalnum() else "_" for c in event["title"])[:60]
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="feuille_de_route_{safe_title}.pdf"'})

# ============ ICS Export ============
def _ics_escape(s: str) -> str:
    if not s:
        return ""
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")

def _ics_fold(line: str) -> str:
    if len(line) <= 75:
        return line
    out = []
    first = True
    while line:
        chunk = line[:75] if first else line[:74]
        out.append(chunk)
        line = line[len(chunk):]
        first = False
    return "\r\n ".join(out)

ICS_STATUS_MAP = {"cancelled": "CANCELLED", "confirmed": "CONFIRMED"}

def _ics_filter_items(items: list, start: Optional[str], end: Optional[str]) -> list:
    def in_range(e):
        s = (e.get("start_date") or "")[:10]
        ed = (e.get("end_date") or e.get("start_date") or "")[:10]
        if start and ed < start:
            return False
        if end and s > end:
            return False
        return True
    return [e for e in items if in_range(e)]

async def _ics_load_related(items: list):
    venue_ids = list({e["venue_id"] for e in items if e.get("venue_id")})
    artist_ids = list({a for e in items for a in (e.get("artist_ids") or [])})
    venues_map = {v["id"]: v async for v in db.venues.find({"id": {"$in": venue_ids}}, {"_id": 0})} if venue_ids else {}
    artists_map = {a["id"]: a async for a in db.artists.find({"id": {"$in": artist_ids}}, {"_id": 0})} if artist_ids else {}
    return venues_map, artists_map

def _ics_event_dates(e: dict):
    try:
        s_date = date_cls.fromisoformat(e["start_date"][:10])
    except Exception:
        return None, None
    end_raw = (e.get("end_date") or e["start_date"])[:10]
    try:
        e_date = date_cls.fromisoformat(end_raw)
    except Exception:
        e_date = s_date
    return s_date, (e_date + timedelta(days=1))

def _ics_summary_and_description(e: dict, artists_map: dict) -> tuple:
    type_label = TYPE_LABEL_FR.get(e.get("type", ""), e.get("type", "")).upper()
    artists_names = [artists_map[a]["name"] for a in (e.get("artist_ids") or []) if a in artists_map]
    summary = f"{type_label} · {e.get('title', '')}"
    if artists_names:
        summary += " — " + ", ".join(artists_names)
    desc_bits = []
    if e.get("status"):
        desc_bits.append(f"Statut: {STATUS_LABEL_FR.get(e['status'], e['status'])}")
    if artists_names:
        desc_bits.append("Artistes: " + ", ".join(artists_names))
    if e.get("notes"):
        desc_bits.append(e["notes"])
    return type_label, summary, "\n".join(desc_bits)

def _ics_location(e: dict, venues_map: dict) -> str:
    v = venues_map.get(e.get("venue_id"))
    if not v:
        return ""
    location = v["name"]
    if v.get("address"):
        location += ", " + v["address"]
    return location

def _build_vevent(e: dict, now_stamp: str, venues_map: dict, artists_map: dict) -> list:
    s_date, end_exclusive = _ics_event_dates(e)
    if s_date is None:
        return []
    type_label, summary, description = _ics_summary_and_description(e, artists_map)
    location = _ics_location(e, venues_map)
    lines = ["BEGIN:VEVENT", f"UID:{e['id']}@lampli", f"DTSTAMP:{now_stamp}",
             f"DTSTART;VALUE=DATE:{s_date.strftime('%Y%m%d')}",
             f"DTEND;VALUE=DATE:{end_exclusive.strftime('%Y%m%d')}",
             f"SUMMARY:{_ics_escape(summary)}"]
    if location:
        lines.append(f"LOCATION:{_ics_escape(location)}")
    if description:
        lines.append(f"DESCRIPTION:{_ics_escape(description)}")
    lines.append(f"STATUS:{ICS_STATUS_MAP.get(e.get('status'), 'TENTATIVE')}")
    lines.append(f"CATEGORIES:{type_label}")
    lines.append("END:VEVENT")
    return [_ics_fold(ln) for ln in lines]

def _ics_filename(type: Optional[str], start: Optional[str], end: Optional[str]) -> str:
    parts = ["lampli"]
    for p in (type, start, end):
        if p:
            parts.append(p)
    return "_".join(parts) + ".ics"

@api_router.get("/export/events.ics")
async def export_ics(type: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None):
    if start:
        _validate_iso_date(start)
    if end:
        _validate_iso_date(end)
    query = {"type": type} if type else {}
    raw = await db.events.find(query, {"_id": 0}).sort("start_date", 1).to_list(5000)
    items = _ics_filter_items(raw, start, end)
    venues_map, artists_map = await _ics_load_related(items)
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//L'Ampli//Planificateur//FR",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:L'Ampli"]
    for e in items:
        lines.extend(_build_vevent(e, now_stamp, venues_map, artists_map))
    lines.append("END:VCALENDAR")
    body = "\r\n".join(lines) + "\r\n"
    return Response(content=body, media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_ics_filename(type, start, end)}"'})

# ============ Public share ============
async def _get_or_create_public_token() -> str:
    doc = await db.settings.find_one({"id": "public"}, {"_id": 0})
    if doc and doc.get("token"):
        return doc["token"]
    token = uuid.uuid4().hex
    await db.settings.update_one({"id": "public"},
        {"$set": {"id": "public", "token": token, "created_at": now_iso()}}, upsert=True)
    return token

async def _verify_public_token(token: str) -> None:
    current = await _get_or_create_public_token()
    if token != current:
        raise HTTPException(status_code=404, detail="Lien public invalide")

@api_router.get("/public/token")
async def get_public_token():
    return {"token": await _get_or_create_public_token()}

@api_router.post("/public/token/rotate")
async def rotate_public_token():
    token = uuid.uuid4().hex
    await db.settings.update_one({"id": "public"},
        {"$set": {"id": "public", "token": token, "created_at": now_iso()}}, upsert=True)
    return {"token": token}

@api_router.get("/public/{token}/calendar")
async def public_calendar(token: str):
    await _verify_public_token(token)
    events = await db.events.find({}, {"_id": 0}).sort("start_date", 1).to_list(5000)
    venues = await db.venues.find({}, {"_id": 0}).to_list(5000)
    artists = await db.artists.find({}, {"_id": 0}).to_list(5000)
    for e in events:
        e.pop("tech_rider_file_id", None)
        e.pop("contract_file_id", None)
    return {"events": events, "venues": venues, "artists": artists}

@api_router.get("/public/{token}/events/{event_id}/roadmap.pdf")
async def public_roadmap(token: str, event_id: str):
    await _verify_public_token(token)
    return await event_roadmap_pdf(event_id)

# ============ Stats ============
@api_router.get("/stats")
async def stats():
    # Use YYYY-MM-DD string comparison (consistent with how start_date is stored)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_events = await db.events.count_documents({})
    upcoming = await db.events.count_documents({"start_date": {"$gte": today}})
    artists_count = await db.artists.count_documents({})
    venues_count = await db.venues.count_documents({})
    residencies = await db.events.count_documents({"type": "residence"})
    confirmed = await db.events.count_documents({"status": "confirmed"})
    return {"total_events": total_events, "upcoming_events": upcoming,
            "artists": artists_count, "venues": venues_count,
            "residencies": residencies, "confirmed": confirmed}

@api_router.get("/")
async def root():
    return {"app": "L'Ampli", "version": "1.2"}

app.include_router(api_router)

# CORS — restrict in production by setting CORS_ORIGINS env var
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
allow_origins = [o.strip() for o in cors_origins_env.split(',') if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
