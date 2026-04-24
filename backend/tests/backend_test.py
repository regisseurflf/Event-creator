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


# ------- v1.2: Strict ISO date validation -------
class TestDateValidation:
    def test_post_event_bad_date_422(self, client):
        payload = {"title": "TEST_BadDate", "type": "concert", "start_date": "bad-date"}
        r = client.post(f"{API}/events", json=payload)
        assert r.status_code == 422, r.text

    def test_post_event_good_date_ok(self, client):
        payload = {"title": "TEST_GoodDate", "type": "concert", "start_date": "2026-07-10"}
        r = client.post(f"{API}/events", json=payload)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        assert r.json()["start_date"] == "2026-07-10"
        client.delete(f"{API}/events/{eid}")

    def test_patch_dates_bad_422(self, client):
        ev = client.post(f"{API}/events", json={"title": "TEST_PatchBad", "type": "concert", "start_date": "2026-07-10"}).json()
        eid = ev["id"]
        r = client.patch(f"{API}/events/{eid}/dates", json={"start_date": "nope"})
        assert r.status_code == 422, r.text
        client.delete(f"{API}/events/{eid}")

    def test_patch_dates_good_persists(self, client):
        ev = client.post(f"{API}/events", json={"title": "TEST_PatchGood", "type": "concert", "start_date": "2026-07-10"}).json()
        eid = ev["id"]
        r = client.patch(f"{API}/events/{eid}/dates", json={"start_date": "2026-07-15"})
        assert r.status_code == 200, r.text
        assert r.json()["start_date"] == "2026-07-15"
        # Persistence
        r = client.get(f"{API}/events/{eid}")
        assert r.json()["start_date"] == "2026-07-15"
        client.delete(f"{API}/events/{eid}")


# ------- v1.2: ICS export -------
class TestICSExport:
    def test_ics_basic(self, client):
        # Seed events
        e1 = client.post(f"{API}/events", json={
            "title": "TEST_ICS_Concert", "type": "concert", "start_date": "2026-07-05", "status": "confirmed"
        }).json()
        e2 = client.post(f"{API}/events", json={
            "title": "TEST_ICS_Residence", "type": "residence",
            "start_date": "2026-07-10", "end_date": "2026-07-12", "status": "option"
        }).json()

        r = client.get(f"{API}/export/events.ics")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert ct.startswith("text/calendar"), f"got {ct}"
        assert "charset=utf-8" in ct.lower()
        body = r.text
        assert body.startswith("BEGIN:VCALENDAR"), body[:80]
        assert body.rstrip().endswith("END:VCALENDAR"), body[-80:]
        # VEVENT structure
        assert "BEGIN:VEVENT" in body
        assert "END:VEVENT" in body
        assert f"UID:{e1['id']}@lampli" in body
        assert "DTSTAMP:" in body
        assert "DTSTART;VALUE=DATE:20260705" in body
        # For e1, end date should be DTEND exclusive = start+1 = 20260706
        assert "DTEND;VALUE=DATE:20260706" in body
        # For e2 residence: start=2026-07-10, end=2026-07-12 -> DTEND exclusive = 20260713
        assert "DTSTART;VALUE=DATE:20260710" in body
        assert "DTEND;VALUE=DATE:20260713" in body
        assert "SUMMARY:" in body
        assert "STATUS:CONFIRMED" in body
        assert "STATUS:TENTATIVE" in body  # e2 status=option -> TENTATIVE

        # Cleanup
        client.delete(f"{API}/events/{e1['id']}")
        client.delete(f"{API}/events/{e2['id']}")

    def test_ics_filter_type(self, client):
        e1 = client.post(f"{API}/events", json={
            "title": "TEST_ICS_OnlyRes", "type": "residence",
            "start_date": "2026-08-01", "end_date": "2026-08-03", "status": "confirmed"
        }).json()
        e2 = client.post(f"{API}/events", json={
            "title": "TEST_ICS_NotIncluded", "type": "concert",
            "start_date": "2026-08-02", "status": "confirmed"
        }).json()
        r = client.get(f"{API}/export/events.ics", params={"type": "residence"})
        assert r.status_code == 200
        body = r.text
        assert f"UID:{e1['id']}@lampli" in body
        assert f"UID:{e2['id']}@lampli" not in body
        client.delete(f"{API}/events/{e1['id']}")
        client.delete(f"{API}/events/{e2['id']}")

    def test_ics_filter_range(self, client):
        in_range = client.post(f"{API}/events", json={
            "title": "TEST_ICS_InRange", "type": "concert", "start_date": "2026-07-15"
        }).json()
        out_range = client.post(f"{API}/events", json={
            "title": "TEST_ICS_OutOfRange", "type": "concert", "start_date": "2026-08-15"
        }).json()
        r = client.get(f"{API}/export/events.ics", params={"start": "2026-07-01", "end": "2026-07-31"})
        assert r.status_code == 200
        body = r.text
        assert f"UID:{in_range['id']}@lampli" in body
        assert f"UID:{out_range['id']}@lampli" not in body
        client.delete(f"{API}/events/{in_range['id']}")
        client.delete(f"{API}/events/{out_range['id']}")

