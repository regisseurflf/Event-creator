from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Response
from fastapi.responses import StreamingResponse
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
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


# FastAPI app
app = FastAPI(title="Scène Pulse API")
api_router = APIRouter(prefix="/api")


# ============ Models ============
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
    start_date: str  # ISO date or datetime
    end_date: Optional[str] = None
    fee: Optional[float] = 0.0
    currency: Optional[str] = "EUR"
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
    fee: Optional[float] = 0.0
    currency: Optional[str] = "EUR"
    status: EventStatus = "option"
    poster_file_id: Optional[str] = None
    tech_rider_file_id: Optional[str] = None
    contract_file_id: Optional[str] = None
    notes: Optional[str] = ""


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
    items = await db.artists.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


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
    update = payload.model_dump()
    result = await db.artists.update_one({"id": artist_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artiste introuvable")
    item = await db.artists.find_one({"id": artist_id}, {"_id": 0})
    return item


@api_router.delete("/artists/{artist_id}")
async def delete_artist(artist_id: str):
    result = await db.artists.delete_one({"id": artist_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artiste introuvable")
    return {"ok": True}


# ============ Venues ============
@api_router.get("/venues", response_model=List[Venue])
async def list_venues():
    items = await db.venues.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


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
    update = payload.model_dump()
    result = await db.venues.update_one({"id": venue_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    item = await db.venues.find_one({"id": venue_id}, {"_id": 0})
    return item


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
    items = await db.events.find(query, {"_id": 0}).sort("start_date", 1).to_list(2000)
    return items


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
    update = payload.model_dump()
    result = await db.events.update_one({"id": event_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    item = await db.events.find_one({"id": event_id}, {"_id": 0})
    return item


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Événement introuvable")
    return {"ok": True}


# ============ Stats ============
@api_router.get("/stats")
async def stats():
    now = datetime.now(timezone.utc).isoformat()
    total_events = await db.events.count_documents({})
    upcoming = await db.events.count_documents({"start_date": {"$gte": now}})
    artists_count = await db.artists.count_documents({})
    venues_count = await db.venues.count_documents({})
    residencies = await db.events.count_documents({"type": "residence"})
    # Sum fees for confirmed
    pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$fee"}}},
    ]
    total_fees = 0.0
    async for doc in db.events.aggregate(pipeline):
        total_fees = float(doc.get("total", 0) or 0)
    return {
        "total_events": total_events,
        "upcoming_events": upcoming,
        "artists": artists_count,
        "venues": venues_count,
        "residencies": residencies,
        "total_fees_confirmed": total_fees,
    }


@api_router.get("/")
async def root():
    return {"app": "Scène Pulse", "version": "1.0"}


# Include the router
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
