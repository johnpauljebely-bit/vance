"""Backend tests for VANCE Phase 1+2+3."""
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
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


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
    assert isinstance(d["open_slots"], int)
    assert d["total_slots"] >= 1
    assert isinstance(d["portfolio_tags"], list)
    assert d.get("last_content_updated")


def test_testimonials_endpoint(session):
    r = session.get(f"{API}/testimonials", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


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
    assert d["url"].startswith("/api/files/")
    file_id = d["file_id"]

    r2 = session.get(f"{API}/files/{file_id}", timeout=60)
    assert r2.status_code == 200


def test_download_missing_file(session):
    r = session.get(f"{API}/files/nonexistent-xyz", timeout=30)
    assert r.status_code == 404


# ---------------- Admin auth ----------------
def test_admin_login_wrong_password(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_admin_login_success_and_me(session, admin_token):
    r2 = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["email"] == ADMIN_EMAIL
    assert r2.json()["role"] == "admin"


def test_me_no_token(session):
    r = session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 401


# ---------------- Admin: auth guard ----------------
@pytest.mark.parametrize("path", [
    "/admin/requests",
    "/admin/orders",
    "/admin/dashboard/summary",
    "/admin/settings",
])
def test_admin_requires_auth(session, path):
    r = session.get(f"{API}{path}", timeout=30)
    assert r.status_code == 401


# ---------------- Admin: requests ----------------
def test_admin_list_requests(session, auth_headers):
    r = session.get(f"{API}/admin/requests", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def _make_request(session) -> str:
    r = session.post(f"{API}/requests", json={
        "name": "TEST_AcceptFlow",
        "email": "accept@example.com",
        "commission_type": "Logo",
        "description": "Test accept flow — enough characters for validation.",
    }, timeout=30)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_admin_accept_request_creates_order(session, auth_headers):
    req_id = _make_request(session)
    r = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    order_id = data["order_id"]

    # Fetch order and verify
    r2 = session.get(f"{API}/admin/orders/{order_id}", headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    order = r2.json()
    assert order["status"] == "Accepted – Awaiting Deposit"
    assert order["payment_status"] == "Deposit Pending"
    assert order["request_id"] == req_id
    assert isinstance(order.get("activity"), list) and len(order["activity"]) >= 1

    # Verify request status transitioned + read flag
    reqs = session.get(f"{API}/admin/requests", headers=auth_headers, timeout=30).json()
    found = next((x for x in reqs if x["id"] == req_id), None)
    assert found is not None
    assert found["status"] == "Accepted – Awaiting Deposit"
    assert found["read"] is True


def test_admin_cannot_accept_declined(session, auth_headers):
    req_id = _make_request(session)
    r = session.post(f"{API}/admin/requests/{req_id}/decline", json={"reason": "test"}, headers=auth_headers, timeout=30)
    assert r.status_code == 200
    # Cannot accept a declined
    r2 = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
    assert r2.status_code == 400


def test_admin_decline_with_reason(session, auth_headers):
    req_id = _make_request(session)
    r = session.post(f"{API}/admin/requests/{req_id}/decline", json={"reason": "Not a fit"}, headers=auth_headers, timeout=30)
    assert r.status_code == 200
    reqs = session.get(f"{API}/admin/requests?status=Declined", headers=auth_headers, timeout=30).json()
    found = next((x for x in reqs if x["id"] == req_id), None)
    assert found is not None
    assert found["status"] == "Declined"
    assert found["read"] is True
    assert found.get("decline_reason") == "Not a fit"


# ---------------- Admin: orders ----------------
def test_admin_order_status_transitions(session, auth_headers):
    req_id = _make_request(session)
    ar = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
    order_id = ar.json()["order_id"]

    # Valid transition
    r = session.patch(f"{API}/admin/orders/{order_id}/status", json={"status": "In Queue"}, headers=auth_headers, timeout=30)
    assert r.status_code == 200

    # Invalid status
    r2 = session.patch(f"{API}/admin/orders/{order_id}/status", json={"status": "Bogus"}, headers=auth_headers, timeout=30)
    assert r2.status_code == 400

    # Cannot close without testimonial
    r3 = session.patch(f"{API}/admin/orders/{order_id}/status", json={"status": "Closed"}, headers=auth_headers, timeout=30)
    assert r3.status_code == 400

    # Verify activity log grew
    order = session.get(f"{API}/admin/orders/{order_id}", headers=auth_headers, timeout=30).json()
    assert len(order["activity"]) >= 2


# ---------------- Admin: dashboard ----------------
def test_admin_dashboard_summary(session, auth_headers):
    r = session.get(f"{API}/admin/dashboard/summary", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    for key in ("open_requests", "active_orders", "delivered_this_month", "total_orders"):
        assert isinstance(d[key], int)
    assert isinstance(d["recent_requests"], list)
    assert isinstance(d["recent_orders"], list)


# ---------------- Admin: settings ----------------
def test_admin_settings_get_and_patch(session, auth_headers):
    r = session.get(f"{API}/admin/settings", headers=auth_headers, timeout=30)
    assert r.status_code == 200
    orig = r.json()
    orig_slots = orig["open_slots"]
    orig_tags = orig["portfolio_tags"]

    # patch open_slots
    new_slots = (orig_slots + 1) % 5
    r2 = session.patch(f"{API}/admin/settings", json={"open_slots": new_slots}, headers=auth_headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["open_slots"] == new_slots

    # public reflects new value
    pub = session.get(f"{API}/settings/public", timeout=30).json()
    assert pub["open_slots"] == new_slots

    # invalid open_slots
    r3 = session.patch(f"{API}/admin/settings", json={"open_slots": -1}, headers=auth_headers, timeout=30)
    assert r3.status_code == 400

    # invalid total_slots
    r4 = session.patch(f"{API}/admin/settings", json={"total_slots": 0}, headers=auth_headers, timeout=30)
    assert r4.status_code == 400

    # restore
    session.patch(f"{API}/admin/settings", json={"open_slots": orig_slots, "portfolio_tags": orig_tags}, headers=auth_headers, timeout=30)
