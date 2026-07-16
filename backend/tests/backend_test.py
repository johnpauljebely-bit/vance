"""Backend tests for VANCE Phase 1+2."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vance-wip.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vance.design"
ADMIN_PASSWORD = "changeme-in-production"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    return s


# ---------------- Health & settings ----------------
def test_health(session):
    r = session.get(f"{API}/health", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert "storage" in data


def test_public_settings(session):
    r = session.get(f"{API}/settings/public", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["open_slots"] == 3
    assert d["total_slots"] == 3
    assert isinstance(d["portfolio_tags"], list)
    assert "Logo" in d["portfolio_tags"]
    assert d.get("last_content_updated")


def test_testimonials_empty(session):
    r = session.get(f"{API}/testimonials", timeout=30)
    assert r.status_code == 200
    assert r.json() == []


def test_portfolio_empty(session):
    r = session.get(f"{API}/portfolio", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_portfolio_tag_filter(session):
    r = session.get(f"{API}/portfolio", params={"tag": "Logo"}, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------- Commission requests ----------------
def test_create_request_success(session):
    payload = {
        "name": "TEST_User",
        "email": "test_user@example.com",
        "commission_type": "Logo",
        "description": "This is a test commission with enough characters.",
        "budget": "$500",
    }
    r = session.post(f"{API}/requests", json=payload, timeout=30)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["name"] == "TEST_User"
    assert d["status"] == "New"
    assert d["read"] is False
    assert "id" in d


def test_create_request_short_description(session):
    payload = {
        "name": "TEST",
        "email": "t@example.com",
        "commission_type": "Logo",
        "description": "short",
    }
    r = session.post(f"{API}/requests", json=payload, timeout=30)
    assert r.status_code in (400, 422)


def test_create_request_invalid_ref_file(session):
    payload = {
        "name": "TEST",
        "email": "t@example.com",
        "commission_type": "Logo",
        "description": "This description is definitely long enough.",
        "reference_file_ids": ["nonexistent-id-xyz"],
    }
    r = session.post(f"{API}/requests", json=payload, timeout=30)
    assert r.status_code == 400


# ---------------- Uploads ----------------
# Minimal 1x1 PNG
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08"
    b"\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01\x00"
    b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_upload_unsupported_type(session):
    files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
    r = session.post(f"{API}/uploads/reference", files=files, timeout=30)
    assert r.status_code == 400


def test_upload_and_download(session):
    files = {"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = session.post(f"{API}/uploads/reference", files=files, timeout=60)
    if r.status_code == 500:
        pytest.skip(f"Storage service unavailable: {r.text}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert "file_id" in d
    assert d["size"] > 0
    assert d["url"].startswith("/api/files/")
    file_id = d["file_id"]

    # Now download
    r2 = session.get(f"{API}/files/{file_id}", timeout=60)
    assert r2.status_code == 200
    assert "image" in r2.headers.get("content-type", "")

    # And use the file in a request
    payload = {
        "name": "TEST_WithFile",
        "email": "t@example.com",
        "commission_type": "Logo",
        "description": "This test request has a reference file attached to it.",
        "reference_file_ids": [file_id],
    }
    r3 = session.post(f"{API}/requests", json=payload, timeout=30)
    assert r3.status_code == 201, r3.text


def test_download_missing_file(session):
    r = session.get(f"{API}/files/nonexistent-xyz", timeout=30)
    assert r.status_code == 404


# ---------------- Admin auth ----------------
def test_admin_login_wrong_password(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_admin_login_wrong_email(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": "nope@vance.design", "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 401


def test_admin_login_success_and_me(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    assert token

    r2 = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["email"] == ADMIN_EMAIL
    assert r2.json()["role"] == "admin"


def test_me_no_token(session):
    r = session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


def test_me_invalid_token(session):
    r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}, timeout=30)
    assert r.status_code == 401
