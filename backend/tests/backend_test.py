"""Backend API tests for Scène Pulse (concerts/spectacles/résidences planner)."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
# Prefer the frontend env file for the public URL
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
except Exception:
    pass

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    return s


# ------- Health -------
def test_health(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("app")


# ------- Artists -------
class TestArtists:
    def test_artist_crud(self, client):
        payload = {"name": "TEST_Artist", "genre": "Jazz", "bio": "Bio"}
        r = client.post(f"{API}/artists", json=payload)
        assert r.status_code == 200, r.text
        art = r.json()
        assert art["name"] == "TEST_Artist"
        assert art["genre"] == "Jazz"
        assert "id" in art
        aid = art["id"]

        # LIST contains it
        r = client.get(f"{API}/artists")
        assert r.status_code == 200
        assert any(a["id"] == aid for a in r.json())

        # GET
        r = client.get(f"{API}/artists/{aid}")
        assert r.status_code == 200
        assert r.json()["id"] == aid

        # UPDATE
        r = client.put(f"{API}/artists/{aid}", json={"name": "TEST_Artist_v2", "genre": "Rock"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Artist_v2"

        # verify persistence
        r = client.get(f"{API}/artists/{aid}")
        assert r.json()["name"] == "TEST_Artist_v2"
        assert r.json()["genre"] == "Rock"

        # DELETE
        r = client.delete(f"{API}/artists/{aid}")
        assert r.status_code == 200

        r = client.get(f"{API}/artists/{aid}")
        assert r.status_code == 404


# ------- Venues -------
class TestVenues:
    def test_venue_crud(self, client):
        payload = {"name": "TEST_Venue", "address": "Rue 1", "capacity": 200, "stage_type": "Plateau"}
        r = client.post(f"{API}/venues", json=payload)
        assert r.status_code == 200, r.text
        v = r.json()
        vid = v["id"]
        assert v["capacity"] == 200

        r = client.get(f"{API}/venues/{vid}")
        assert r.status_code == 200

        r = client.put(f"{API}/venues/{vid}", json={"name": "TEST_Venue2", "capacity": 300})
        assert r.status_code == 200
        assert r.json()["capacity"] == 300

        r = client.delete(f"{API}/venues/{vid}")
        assert r.status_code == 200
        r = client.get(f"{API}/venues/{vid}")
        assert r.status_code == 404


# ------- Events -------
class TestEvents:
    def test_event_crud_with_links_and_filter(self, client):
        # Create artist + venue first
        a = client.post(f"{API}/artists", json={"name": "TEST_EvtArtist"}).json()
        v = client.post(f"{API}/venues", json={"name": "TEST_EvtVenue"}).json()

        # Concert
        ev_payload = {
            "title": "TEST_Concert",
            "type": "concert",
            "artist_ids": [a["id"]],
            "venue_id": v["id"],
            "start_date": "2026-06-01T20:00:00+00:00",
            "fee": 1200.0,
            "currency": "EUR",
            "status": "confirmed",
        }
        r = client.post(f"{API}/events", json=ev_payload)
        assert r.status_code == 200, r.text
        ev = r.json()
        assert ev["type"] == "concert"
        assert ev["artist_ids"] == [a["id"]]
        assert ev["venue_id"] == v["id"]
        eid = ev["id"]

        # Residence
        res_payload = {
            "title": "TEST_Residence",
            "type": "residence",
            "artist_ids": [a["id"]],
            "venue_id": v["id"],
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
        }
        r = client.post(f"{API}/events", json=res_payload)
        assert r.status_code == 200
        rid = r.json()["id"]

        # Filter by type=residence
        r = client.get(f"{API}/events", params={"type": "residence"})
        assert r.status_code == 200
        types = {e["type"] for e in r.json()}
        assert types.issubset({"residence"})
        assert any(e["id"] == rid for e in r.json())

        # GET /events (all)
        r = client.get(f"{API}/events")
        ids = {e["id"] for e in r.json()}
        assert eid in ids and rid in ids

        # Update event
        r = client.put(f"{API}/events/{eid}", json={**ev_payload, "title": "TEST_Concert_v2", "fee": 2000.0})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Concert_v2"

        # Validation: invalid type
        bad = {**ev_payload, "type": "party"}
        r = client.post(f"{API}/events", json=bad)
        assert r.status_code == 422

        # Cleanup
        client.delete(f"{API}/events/{eid}")
        client.delete(f"{API}/events/{rid}")
        client.delete(f"{API}/artists/{a['id']}")
        client.delete(f"{API}/venues/{v['id']}")

        # Confirm deletion
        assert client.get(f"{API}/events/{eid}").status_code == 404


# ------- File upload -------
class TestFiles:
    def test_upload_png_and_download(self, client):
        # Minimal PNG bytes (1x1 red)
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
            b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01]\xfe\xfa\x0e\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = client.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        fid = data["id"]
        assert data["original_filename"] == "test.png"
        assert data["content_type"] == "image/png"
        assert data["size"] > 0

        # Info
        r = client.get(f"{API}/files/{fid}/info")
        assert r.status_code == 200
        info = r.json()
        assert info["id"] == fid
        assert info["content_type"] == "image/png"

        # Download
        r = client.get(f"{API}/files/{fid}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        assert len(r.content) > 0

    def test_upload_pdf(self, client):
        pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        files = {"file": ("doc.pdf", io.BytesIO(pdf), "application/pdf")}
        r = client.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["content_type"] == "application/pdf"
        fid = data["id"]

        r = client.get(f"{API}/files/{fid}")
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()

    def test_file_info_missing(self, client):
        r = client.get(f"{API}/files/{uuid.uuid4()}/info")
        assert r.status_code == 404


# ------- Stats -------
class TestStats:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/stats")
        assert r.status_code == 200
        data = r.json()
        for key in ["total_events", "upcoming_events", "artists", "venues", "residencies", "total_fees_confirmed"]:
            assert key in data, f"missing key {key}"
        assert isinstance(data["total_events"], int)
        assert isinstance(data["total_fees_confirmed"], (int, float))
