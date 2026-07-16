"""Iteration 3+4 backend endpoint tests: portal auth, messages, portfolio,
automation, showcase, mockups, watermark preview, email triggers."""
import io
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vance-wip.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vance.design"
ADMIN_PASSWORD = "changeme-in-production"


@pytest.fixture(scope="module")
def session():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Client Portal Auth ----------------
class TestPortalAuth:
    def test_login_devtest_no_prior_request(self, session):
        # DEVTEST password should work regardless of prior request
        email = f"test_devtest_{uuid.uuid4().hex[:6]}@example.com"
        r = session.post(f"{API}/portal/login", json={"email": email, "password": "DEVTEST"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "password"
        assert d["email"] == email
        assert "access_token" in d and len(d["access_token"]) > 20

    def test_login_no_password_unknown_email(self, session):
        # Should return magic-link mode without leaking whether email exists
        email = f"unknown_{uuid.uuid4().hex[:6]}@example.com"
        r = session.post(f"{API}/portal/login", json={"email": email}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "magic-link"
        assert d["sent"] is True

    def test_login_wrong_password_falls_through(self, session):
        email = f"wrongpw_{uuid.uuid4().hex[:6]}@example.com"
        r = session.post(f"{API}/portal/login", json={"email": email, "password": "wrong-pw"}, timeout=30)
        assert r.status_code == 200
        # Wrong pw + no prior request => magic-link mode
        assert r.json()["mode"] == "magic-link"

    def test_magic_link_flow_with_prior_request(self, session):
        # Create a request first
        email = f"magic_{uuid.uuid4().hex[:6]}@example.com"
        rq = session.post(f"{API}/requests", json={
            "name": "TEST_MagicLink",
            "email": email,
            "commission_type": "Logo",
            "description": "Magic link flow test description of adequate length.",
        }, timeout=30)
        assert rq.status_code == 201

        # Trigger magic-link
        r = session.post(f"{API}/portal/login", json={"email": email}, timeout=30)
        assert r.status_code == 200
        assert r.json()["mode"] == "magic-link"

        # Pull token from DB via a Mongo shim — we cannot access DB directly here,
        # so we rely on the log fallback or test that the endpoint at least records it.
        # Since we can't extract the token from outside, verify /portal/verify with
        # a bogus token returns 400.
        rv = session.post(f"{API}/portal/verify", json={"token": "bogus-token-xyz"}, timeout=30)
        assert rv.status_code == 400

    def test_portal_me_requires_client_token(self, session, auth_headers):
        # No token
        r = session.get(f"{API}/portal/me", timeout=30)
        assert r.status_code == 401
        # Admin token => 403
        r2 = session.get(f"{API}/portal/me", headers=auth_headers, timeout=30)
        assert r2.status_code == 403

    def test_portal_me_with_client_token(self, session):
        email = f"portalme_{uuid.uuid4().hex[:6]}@example.com"
        r = session.post(f"{API}/portal/login", json={"email": email, "password": "DEVTEST"}, timeout=30)
        token = r.json()["access_token"]
        r2 = session.get(f"{API}/portal/me", headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r2.status_code == 200
        d = r2.json()
        assert d["email"] == email
        assert d["role"] == "client"


# ---------------- Client Portal Orders ----------------
class TestPortalOrders:
    def _make_client(self, session, auth_headers):
        email = f"client_{uuid.uuid4().hex[:6]}@example.com"
        rq = session.post(f"{API}/requests", json={
            "name": "TEST_ClientPortal",
            "email": email,
            "commission_type": "Logo",
            "description": "Client portal test description with enough length.",
        }, timeout=30)
        req_id = rq.json()["id"]
        ar = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
        order_id = ar.json()["order_id"]
        lr = session.post(f"{API}/portal/login", json={"email": email, "password": "DEVTEST"}, timeout=30)
        return email, order_id, lr.json()["access_token"]

    def test_portal_orders_scoped_to_email(self, session, auth_headers):
        email, order_id, token = self._make_client(session, auth_headers)
        headers = {"Authorization": f"Bearer {token}"}

        r = session.get(f"{API}/portal/orders", headers=headers, timeout=30)
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list)
        # All returned orders must belong to this client
        for o in orders:
            assert o.get("client_email") == email
        # And our order should be in there
        assert any(o["id"] == order_id for o in orders)

    def test_portal_get_order_only_own(self, session, auth_headers):
        _, order_id, token = self._make_client(session, auth_headers)
        headers = {"Authorization": f"Bearer {token}"}

        r = session.get(f"{API}/portal/orders/{order_id}", headers=headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == order_id

        # A DIFFERENT client should get 404
        other = session.post(f"{API}/portal/login", json={"email": f"other_{uuid.uuid4().hex[:6]}@example.com", "password": "DEVTEST"}, timeout=30)
        other_token = other.json()["access_token"]
        r2 = session.get(f"{API}/portal/orders/{order_id}", headers={"Authorization": f"Bearer {other_token}"}, timeout=30)
        assert r2.status_code == 404


# ---------------- Messages ----------------
class TestMessages:
    def _prep(self, session, auth_headers):
        email = f"msg_{uuid.uuid4().hex[:6]}@example.com"
        rq = session.post(f"{API}/requests", json={
            "name": "TEST_Messages",
            "email": email,
            "commission_type": "Logo",
            "description": "Messages test description with enough length in it.",
        }, timeout=30)
        req_id = rq.json()["id"]
        ar = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
        order_id = ar.json()["order_id"]
        lr = session.post(f"{API}/portal/login", json={"email": email, "password": "DEVTEST"}, timeout=30)
        return order_id, lr.json()["access_token"]

    def test_admin_and_client_message_roundtrip(self, session, auth_headers):
        order_id, client_token = self._prep(session, auth_headers)
        client_headers = {"Authorization": f"Bearer {client_token}"}

        # Admin sends first
        r = session.post(f"{API}/admin/orders/{order_id}/messages",
                         json={"body": "Hello from admin"}, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["from_side"] == "admin"
        assert d["body"] == "Hello from admin"

        # Client sends
        r2 = session.post(f"{API}/portal/orders/{order_id}/messages",
                          json={"body": "Hi from client"}, headers=client_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["from_side"] == "client"

        # List (admin) — first call triggers mark-as-read
        r3 = session.get(f"{API}/admin/orders/{order_id}/messages", headers=auth_headers, timeout=30)
        assert r3.status_code == 200
        assert len(r3.json()) >= 2
        # Second call should now show client messages as read_by_admin=True
        r3b = session.get(f"{API}/admin/orders/{order_id}/messages", headers=auth_headers, timeout=30)
        msgs = r3b.json()
        assert all(m["read_by_admin"] for m in msgs if m["from_side"] == "client")

        # List (client)
        r4 = session.get(f"{API}/portal/orders/{order_id}/messages", headers=client_headers, timeout=30)
        assert r4.status_code == 200
        assert len(r4.json()) >= 2

    def test_client_cannot_access_others_order_messages(self, session, auth_headers):
        order_id, _ = self._prep(session, auth_headers)
        other = session.post(f"{API}/portal/login", json={"email": f"otherm_{uuid.uuid4().hex[:6]}@example.com", "password": "DEVTEST"}, timeout=30)
        other_h = {"Authorization": f"Bearer {other.json()['access_token']}"}
        r = session.get(f"{API}/portal/orders/{order_id}/messages", headers=other_h, timeout=30)
        assert r.status_code == 404
        r2 = session.post(f"{API}/portal/orders/{order_id}/messages", json={"body": "sneaky"}, headers=other_h, timeout=30)
        assert r2.status_code == 404


# ---------------- Portfolio CRUD ----------------
class TestPortfolio:
    def test_portfolio_crud_and_home_cap(self, session, auth_headers):
        created_ids = []
        try:
            # Wipe home_visible flags via list first
            existing = session.get(f"{API}/admin/portfolio", headers=auth_headers, timeout=30).json()
            for it in existing:
                if it.get("home_visible"):
                    session.patch(f"{API}/admin/portfolio/{it['id']}", json={"home_visible": False}, headers=auth_headers, timeout=30)

            # Create 5 home-visible
            for i in range(5):
                r = session.post(f"{API}/admin/portfolio", json={
                    "title": f"TEST_HV_{i}",
                    "tags": ["Logo"],
                    "cover_image_url": "https://example.com/x.png",
                    "home_visible": True,
                    "published": True,
                }, headers=auth_headers, timeout=30)
                assert r.status_code == 200, r.text
                created_ids.append(r.json()["id"])

            # 6th should fail
            r6 = session.post(f"{API}/admin/portfolio", json={
                "title": "TEST_HV_6",
                "tags": ["Logo"],
                "cover_image_url": "https://example.com/x.png",
                "home_visible": True,
                "published": True,
            }, headers=auth_headers, timeout=30)
            assert r6.status_code == 400

            # Public /portfolio/home returns <=5
            pub = session.get(f"{API}/portfolio/home", timeout=30)
            assert pub.status_code == 200
            assert len(pub.json()) <= 5

            # PATCH: turn one off, then try to make a new one home_visible
            session.patch(f"{API}/admin/portfolio/{created_ids[0]}", json={"home_visible": False}, headers=auth_headers, timeout=30)
            # Now creating 1 more home_visible should succeed
            r7 = session.post(f"{API}/admin/portfolio", json={
                "title": "TEST_HV_7",
                "tags": ["Logo"],
                "cover_image_url": "https://example.com/x.png",
                "home_visible": True,
                "published": True,
            }, headers=auth_headers, timeout=30)
            assert r7.status_code == 200
            created_ids.append(r7.json()["id"])

            # DELETE one and verify
            del_id = created_ids[-1]
            rd = session.delete(f"{API}/admin/portfolio/{del_id}", headers=auth_headers, timeout=30)
            assert rd.status_code == 200
            created_ids.remove(del_id)
        finally:
            for cid in created_ids:
                session.delete(f"{API}/admin/portfolio/{cid}", headers=auth_headers, timeout=30)


# ---------------- Automation & Mockups ----------------
class TestAutomation:
    def test_get_automation(self, session, auth_headers):
        r = session.get(f"{API}/admin/automation", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert 0.0 < d["watermark_opacity"] <= 1.0
        assert 0.0 < d["watermark_size_pct"] <= 1.0
        assert d["watermark_url"].startswith("http")
        assert d["mockup_count"] >= 5

    def test_patch_automation_valid(self, session, auth_headers):
        r = session.patch(f"{API}/admin/automation", json={"watermark_opacity": 0.5, "watermark_size_pct": 0.4},
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["watermark_opacity"] == 0.5
        assert d["watermark_size_pct"] == 0.4

    def test_patch_automation_out_of_range(self, session, auth_headers):
        r = session.patch(f"{API}/admin/automation", json={"watermark_opacity": 2.0}, headers=auth_headers, timeout=30)
        assert r.status_code == 422
        r2 = session.patch(f"{API}/admin/automation", json={"watermark_size_pct": 0.001}, headers=auth_headers, timeout=30)
        assert r2.status_code == 422

    def test_mockups_seed(self, session, auth_headers):
        r = session.get(f"{API}/admin/mockups", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 5
        for m in docs:
            for k in ("id", "label", "category", "url", "placement_type", "logo_hex", "requirement"):
                assert k in m, f"missing key {k} in mockup {m.get('id')}"
            if m["placement_type"] == "flat":
                assert "zone" in m
            else:
                assert "corners" in m


# ---------------- Watermark Preview ----------------
class TestWatermark:
    def test_watermark_preview_returns_png(self, session, auth_headers):
        logo_url = ("https://customer-assets-lxgj4vgw.emergentagent.net/"
                    "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/"
                    "pzblpyw9_Logo%20%2825%29.png")
        r = session.post(f"{API}/admin/watermark/preview", json={"logo_url": logo_url},
                         headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text[:400]
        assert r.headers.get("content-type", "").startswith("image/png")
        assert len(r.content) > 100
        # PNG signature
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


# ---------------- Showcase Automation ----------------
class TestShowcase:
    LOGO_URL = ("https://customer-assets-lxgj4vgw.emergentagent.net/"
                "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/"
                "pzblpyw9_Logo%20%2825%29.png")

    def _mk_order(self, session, auth_headers):
        email = f"show_{uuid.uuid4().hex[:6]}@example.com"
        rq = session.post(f"{API}/requests", json={
            "name": "TEST_Showcase",
            "email": email,
            "commission_type": "Logo",
            "description": "Showcase test description of adequate length.",
        }, timeout=30)
        req_id = rq.json()["id"]
        ar = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
        return ar.json()["order_id"]

    def test_showcase_prepare(self, session, auth_headers):
        order_id = self._mk_order(session, auth_headers)
        r = session.post(f"{API}/admin/orders/{order_id}/showcase/prepare",
                         json={"logo_url": self.LOGO_URL}, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["accent_color"].startswith("#") and len(d["accent_color"]) == 7
        assert len(d["compatible_mockups"]) >= 5

    def test_showcase_generate_and_publish(self, session, auth_headers):
        order_id = self._mk_order(session, auth_headers)
        prep = session.post(f"{API}/admin/orders/{order_id}/showcase/prepare",
                            json={"logo_url": self.LOGO_URL}, headers=auth_headers, timeout=60).json()
        mockup_ids = [m["id"] for m in prep["compatible_mockups"]]

        gen = session.post(f"{API}/admin/orders/{order_id}/showcase/generate", json={
            "logo_url": self.LOGO_URL,
            "mockup_ids": mockup_ids,
            "rationale_headline": "TEST rationale",
            "rationale_bullets": ["A", "B"],
            "portfolio_tags": ["Logo"],
        }, headers=auth_headers, timeout=120)
        assert gen.status_code == 200, gen.text[:400]
        gd = gen.json()
        tiles = gd["tiles"]
        # At least 1 mockup tile
        mock_tiles = [t for t in tiles if t.get("kind") == "mockup"]
        assert len(mock_tiles) >= 1, f"No mockup tiles generated. tiles={tiles}"
        # Typography + pattern tiles present
        kinds = {t["kind"] for t in tiles}
        assert "typography" in kinds or "pattern" in kinds

        # Publish
        pub = session.post(f"{API}/admin/orders/{order_id}/showcase/publish", json={
            "title": f"TEST_Showcase_{uuid.uuid4().hex[:6]}",
            "home_visible": False,
        }, headers=auth_headers, timeout=60)
        assert pub.status_code == 200, pub.text[:400]
        item = pub.json()
        assert item["published"] is True
        # Cleanup
        session.delete(f"{API}/admin/portfolio/{item['id']}", headers=auth_headers, timeout=30)


# ---------------- Email Triggers (log-based) ----------------
def test_email_triggers_log(session, auth_headers):
    """Simulate an accept flow and grep backend log for email lines."""
    # Fire accept
    email = f"emailt_{uuid.uuid4().hex[:6]}@example.com"
    rq = session.post(f"{API}/requests", json={
        "name": "TEST_EmailTrigger",
        "email": email,
        "commission_type": "Logo",
        "description": "Email trigger test description with enough length.",
    }, timeout=30)
    req_id = rq.json()["id"]
    ar = session.post(f"{API}/admin/requests/{req_id}/accept", json={}, headers=auth_headers, timeout=30)
    assert ar.status_code == 200

    # Grep backend logs for email traces
    import subprocess
    time.sleep(1.0)
    out = subprocess.run(
        ["bash", "-c", "grep -Ei 'email|SMTP|magic|log-only' /var/log/supervisor/backend*.log | tail -50"],
        capture_output=True, text=True, timeout=15,
    ).stdout
    # We at least expect some email-related log activity from startup or accept
    assert len(out) > 0, "No email-related log lines found — email service may not be wired"
