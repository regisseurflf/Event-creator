"""Backend API tests for L'Ampli (v2) — CRUD + roadmap PDF + PATCH dates."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
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
    return requests.Session()


# ------- Health / branding -------
def test_health_app_is_lampli(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("app") == "L'Ampli", f"expected L'Ampli, got {data}"


# ------- Artists -------
class TestArtists:
    def test_artist_crud(self, client):
        payload = {"name": "TEST_Artist", "genre": "Jazz", "bio": "Bio"}
        r = client.post(f"{API}/artists", json=payload)
        assert r.status_code == 200, r.text
        art = r.json()
        aid = art["id"]
        assert art["name"] == "TEST_Artist"

        r = client.get(f"{API}/artists/{aid}")
        assert r.status_code == 200

        r = client.put(f"{API}/artists/{aid}", json={"name": "TEST_Artist_v2", "genre": "Rock"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Artist_v2"

        r = client.get(f"{API}/artists/{aid}")
        assert r.json()["genre"] == "Rock"

        r = client.delete(f"{API}/artists/{aid}")
        assert r.status_code == 200
        assert client.get(f"{API}/artists/{aid}").status_code == 404


# ------- Venues -------
class TestVenues:
    def test_venue_crud(self, client):
        payload = {"name": "TEST_Venue", "address": "Rue 1", "capacity": 200, "stage_type": "Plateau"}
        r = client.post(f"{API}/venues", json=payload)
        assert r.status_code == 200, r.text
        vid = r.json()["id"]

        assert client.get(f"{API}/venues/{vid}").status_code == 200
        r = client.put(f"{API}/venues/{vid}", json={"name": "TEST_Venue2", "capacity": 300})
        assert r.status_code == 200
        assert r.json()["capacity"] == 300

        assert client.delete(f"{API}/venues/{vid}").status_code == 200
        assert client.get(f"{API}/venues/{vid}").status_code == 404


# ------- Events (no fee/currency in v2) -------
class TestEvents:
    def test_event_crud_and_filter(self, client):
        a = client.post(f"{API}/artists", json={"name": "TEST_EvtArtist"}).json()
        v = client.post(f"{API}/venues", json={"name": "TEST_EvtVenue"}).json()

        ev_payload = {
            "title": "TEST_Concert",
            "type": "concert",
            "artist_ids": [a["id"]],
            "venue_id": v["id"],
            "start_date": "2026-06-01T20:00:00+00:00",
            "status": "confirmed",
        }
        r = client.post(f"{API}/events", json=ev_payload)
        assert r.status_code == 200, r.text
        ev = r.json()
        eid = ev["id"]
        # v2: response must NOT include fee / currency
        assert "fee" not in ev
        assert "currency" not in ev

        res_payload = {
            "title": "TEST_Residence",
            "type": "residence",
            "artist_ids": [a["id"]],
            "venue_id": v["id"],
            "start_date": "2026-07-01",
            "end_date": "2026-07-05",
        }
        rid = client.post(f"{API}/events", json=res_payload).json()["id"]

        # Filter by type=residence
        r = client.get(f"{API}/events", params={"type": "residence"})
        assert r.status_code == 200
        assert {e["type"] for e in r.json()}.issubset({"residence"})
        assert any(e["id"] == rid for e in r.json())

        # Update
        r = client.put(f"{API}/events/{eid}", json={**ev_payload, "title": "TEST_Concert_v2"})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Concert_v2"

        # Invalid type -> 422
        assert client.post(f"{API}/events", json={**ev_payload, "type": "party"}).status_code == 422

        # cleanup
        client.delete(f"{API}/events/{eid}")
        client.delete(f"{API}/events/{rid}")
        client.delete(f"{API}/artists/{a['id']}")
        client.delete(f"{API}/venues/{v['id']}")
        assert client.get(f"{API}/events/{eid}").status_code == 404

    def test_event_accepts_payload_without_fee_currency(self, client):
        """v2: omit fee/currency; server must accept it."""
        payload = {
            "title": "TEST_NoFee",
            "type": "spectacle",
            "start_date": "2026-08-10",
            "status": "option",
        }
        r = client.post(f"{API}/events", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "fee" not in data and "currency" not in data
        client.delete(f"{API}/events/{data['id']}")


# ------- PATCH /events/{id}/dates (drag & drop) -------
class TestPatchDates:
    def test_patch_event_dates(self, client):
        payload = {
            "title": "TEST_PatchDates",
            "type": "concert",
            "start_date": "2026-09-01",
            "status": "option",
        }
        ev = client.post(f"{API}/events", json=payload).json()
        eid = ev["id"]
        r = client.patch(f"{API}/events/{eid}/dates", json={"start_date": "2026-09-15", "end_date": None})
        assert r.status_code == 200, r.text
        assert r.json()["start_date"].startswith("2026-09-15")

        # verify persistence
        r = client.get(f"{API}/events/{eid}")
        assert r.json()["start_date"].startswith("2026-09-15")
        client.delete(f"{API}/events/{eid}")

    def test_patch_residence_shifts_end_date(self, client):
        payload = {
            "title": "TEST_PatchResidence",
            "type": "residence",
            "start_date": "2026-10-01",
            "end_date": "2026-10-05",
            "status": "option",
        }
        ev = client.post(f"{API}/events", json=payload).json()
        eid = ev["id"]
        r = client.patch(f"{API}/events/{eid}/dates",
                         json={"start_date": "2026-10-10", "end_date": "2026-10-14"})
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["start_date"].startswith("2026-10-10")
        assert out["end_date"].startswith("2026-10-14")
        client.delete(f"{API}/events/{eid}")

    def test_patch_dates_unknown_id_404(self, client):
        r = client.patch(f"{API}/events/{uuid.uuid4()}/dates", json={"start_date": "2026-01-01"})
        assert r.status_code == 404


# ------- Roadmap PDF -------
class TestRoadmapPDF:
    def test_roadmap_pdf_generates(self, client):
        a = client.post(f"{API}/artists", json={"name": "TEST_RoadmapArtist", "genre": "Rock", "bio": "Bio text"}).json()
        v = client.post(f"{API}/venues", json={"name": "TEST_RoadmapVenue", "address": "1 rue X", "capacity": 500}).json()
        ev = client.post(f"{API}/events", json={
            "title": "TEST_RoadmapEvent",
            "type": "concert",
            "artist_ids": [a["id"]],
            "venue_id": v["id"],
            "start_date": "2026-11-12",
            "status": "confirmed",
            "notes": "Balance 17h",
        }).json()
        eid = ev["id"]

        r = client.get(f"{API}/events/{eid}/roadmap.pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:5] == b"%PDF-", f"bad magic: {r.content[:10]!r}"
        assert len(r.content) > 500

        # cleanup
        client.delete(f"{API}/events/{eid}")
        client.delete(f"{API}/artists/{a['id']}")
        client.delete(f"{API}/venues/{v['id']}")

    def test_roadmap_pdf_404(self, client):
        r = client.get(f"{API}/events/{uuid.uuid4()}/roadmap.pdf")
        assert r.status_code == 404


# ------- File upload -------
class TestFiles:
    def test_upload_png_and_download(self, client):
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
            b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01]\xfe\xfa\x0e\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = client.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        assert client.get(f"{API}/files/{fid}/info").status_code == 200
        r = client.get(f"{API}/files/{fid}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")

    def test_upload_pdf(self, client):
        pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        files = {"file": ("doc.pdf", io.BytesIO(pdf), "application/pdf")}
        r = client.post(f"{API}/upload", files=files)
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        r = client.get(f"{API}/files/{fid}")
        assert r.status_code == 200
        assert "pdf" in r.headers.get("content-type", "").lower()


# ------- Stats (v2 shape) -------
class TestStats:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/stats")
        assert r.status_code == 200
        data = r.json()
        for key in ["total_events", "upcoming_events", "artists", "venues", "residencies", "confirmed"]:
            assert key in data, f"missing key {key}"
        # v2: total_fees_confirmed removed
        assert "total_fees_confirmed" not in data
        assert isinstance(data["confirmed"], int)
