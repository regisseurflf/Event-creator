from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent Object Storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "scene-pulse"
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


app = FastAPI(title="L'Ampli API")
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


class EventDatesUpdate(BaseModel):
    start_date: str
    end_date: Optional[str] = None


# ============ File upload ============
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 25 Mo)")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{file_id}.{ext}"
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, data, content_type)
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
    return {
        "id": file_id,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": doc["size"],
    }


@api_router.get("/files/{file_id}")
async def download_file(file_id: str):
    record = await db.files.find_one({"id": file_id, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    data, content_type = get_object(record["storage_path"])
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
    return FileRef(
        id=record["id"],
        original_filename=record["original_filename"],
        content_type=record["content_type"],
        size=record["size"],
    )


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


@api_router.get("/events/{event_id}/roadmap.pdf")
async def event_roadmap_pdf(event_id: str):
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

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=f"Feuille de route — {event['title']}",
    )

    styles = getSampleStyleSheet()
    BLACK = colors.HexColor("#0A0A0C")
    ORANGE = colors.HexColor("#FF5A00")
    GREY = colors.HexColor("#71717A")

    title_style = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold",
                                 fontSize=24, leading=28, textColor=BLACK, spaceAfter=2)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontName="Helvetica",
                               fontSize=9, textColor=GREY, leading=12, spaceAfter=10,
                               letterSpace=0.5)
    h2_style = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                              fontSize=11, textColor=BLACK, leading=14,
                              spaceBefore=10, spaceAfter=6)
    body_style = ParagraphStyle("b", parent=styles["Normal"], fontName="Helvetica",
                                fontSize=10, textColor=BLACK, leading=14)
    meta_style = ParagraphStyle("m", parent=styles["Normal"], fontName="Helvetica",
                                fontSize=9, textColor=GREY, leading=12)

    story = []
    story.append(Paragraph("FEUILLE DE ROUTE · L'AMPLI", sub_style))
    story.append(Paragraph(event["title"], title_style))
    story.append(Paragraph(
        f"{TYPE_LABEL_FR.get(event['type'], event['type']).upper()} &nbsp;·&nbsp; "
        f"Statut : {STATUS_LABEL_FR.get(event['status'], event['status'])}",
        sub_style,
    ))

    # Horizontal rule
    rule = Table([[""]], colWidths=[170 * mm], rowHeights=[2])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ORANGE)]))
    story.append(rule)
    story.append(Spacer(1, 10))

    # Key info table
    info_rows = [
        ["DATE", _fmt_date(event.get("start_date"))],
    ]
    if event.get("end_date") and event["end_date"] != event.get("start_date"):
        info_rows.append(["FIN", _fmt_date(event["end_date"])])
    if venue:
        venue_line = venue["name"]
        if venue.get("address"):
            venue_line += f"<br/><font color='#71717A' size='9'>{venue['address']}</font>"
        if venue.get("capacity"):
            venue_line += f"<br/><font color='#71717A' size='9'>Jauge : {venue['capacity']} · Scène : {venue.get('stage_type') or '—'}</font>"
        info_rows.append(["LIEU", Paragraph(venue_line, body_style)])
    else:
        info_rows.append(["LIEU", "À définir"])

    if artists:
        artist_names = ", ".join(a["name"] for a in artists)
        info_rows.append(["ARTISTES", artist_names])

    info_table = Table(info_rows, colWidths=[32 * mm, 138 * mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), GREY),
        ("TEXTCOLOR", (1, 0), (1, -1), BLACK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#E4E4E7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))

    if artists:
        story.append(Paragraph("FICHES ARTISTES", h2_style))
        for a in artists:
            block = f"<b>{a['name']}</b>"
            if a.get("genre"):
                block += f" &nbsp;<font color='#71717A' size='9'>· {a['genre']}</font>"
            if a.get("bio"):
                block += f"<br/>{a['bio']}"
            if a.get("website"):
                block += f"<br/><font color='#FF5A00'>{a['website']}</font>"
            if a.get("social_links"):
                block += f"<br/><font color='#71717A' size='9'>{a['social_links']}</font>"
            story.append(Paragraph(block, body_style))
            story.append(Spacer(1, 8))

    if venue and venue.get("notes"):
        story.append(Paragraph("LOGES / BACKLINE / ACCUEIL", h2_style))
        story.append(Paragraph(venue["notes"].replace("\n", "<br/>"), body_style))

    if event.get("notes"):
        story.append(Paragraph("NOTES DE PRODUCTION", h2_style))
        story.append(Paragraph(event["notes"].replace("\n", "<br/>"), body_style))

    # Footer rule
    story.append(Spacer(1, 18))
    frule = Table([[""]], colWidths=[170 * mm], rowHeights=[1])
    frule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E4E4E7"))]))
    story.append(frule)
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Générée le {_fmt_date(datetime.now(timezone.utc).isoformat())} · L'Ampli",
        meta_style,
    ))

    doc.build(story)
    pdf = buf.getvalue()
    buf.close()
    safe_title = "".join(c if c.isalnum() else "_" for c in event["title"])[:60]
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="feuille_de_route_{safe_title}.pdf"'},
    )


# ============ Stats ============
@api_router.get("/stats")
async def stats():
    now = datetime.now(timezone.utc).isoformat()
    total_events = await db.events.count_documents({})
    upcoming = await db.events.count_documents({"start_date": {"$gte": now}})
    artists_count = await db.artists.count_documents({})
    venues_count = await db.venues.count_documents({})
    residencies = await db.events.count_documents({"type": "residence"})
    confirmed = await db.events.count_documents({"status": "confirmed"})
    return {
        "total_events": total_events,
        "upcoming_events": upcoming,
        "artists": artists_count,
        "venues": venues_count,
        "residencies": residencies,
        "confirmed": confirmed,
    }


@api_router.get("/")
async def root():
    return {"app": "L'Ampli", "version": "1.1"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
