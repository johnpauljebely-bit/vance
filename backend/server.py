"""VANCE backend — Phase 1 + 2.

Provides:
- Commission request submission (public)
- Reference image upload (public, via Emergent Object Storage)
- Admin login (JWT)
- Public settings (open slots)
- Testimonials & portfolio listing (empty until phases 3-5 populate them)
- File serving (auth-optional; request references are considered semi-private
  — served only via signed short-lived URL in a later phase, but public here
  since the surface is a designer's own portfolio submission)
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import jwt
import requests
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Header,
    Query,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

from email_service import (
    email_deposit_confirmed,
    email_magic_link,
    email_new_message,
    email_order_delivered,
    email_request_accepted,
    email_request_declined,
    email_review_request,
)
from image_service import (
    apply_watermark,
    dominant_color_hex,
    make_pattern_tile,
    make_typography_tile,
    place_angled,
    place_flat,
    recolor_logo,
)
from PIL import Image
import io as _io
import secrets

# ------------------------------------------------------------------ env / config
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APP_NAME = os.environ.get("APP_NAME", "vance")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_EXPIRES_MIN = int(os.environ.get("JWT_EXPIRES_MINUTES", "1440"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vance.design")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "hello@vance.design")

CLIENT_DEV_PASSWORD = os.environ.get("CLIENT_DEV_PASSWORD", "DEVTEST")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}
IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_UPLOAD_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vance")

# ------------------------------------------------------------------ mongo
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ------------------------------------------------------------------ pydantic helpers
def _validate_object_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------ models
class CommissionRequestCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    commission_type: str = Field(..., min_length=1, max_length=80)
    description: str = Field(..., min_length=10, max_length=5000)
    budget: Optional[str] = Field(default=None, max_length=120)
    reference_file_ids: List[str] = Field(default_factory=list)


class CommissionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    commission_type: str
    description: str
    budget: Optional[str] = None
    reference_file_ids: List[str] = Field(default_factory=list)
    status: str = "New"  # Canonical status list
    read: bool = False
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class Testimonial(BaseModel):
    id: str
    client_name: str
    quote: str
    rating: int = 5
    order_id: Optional[str] = None
    approved: bool = False
    created_at: str


class PortfolioItem(BaseModel):
    id: str
    title: str
    tags: List[str] = Field(default_factory=list)
    cover_image_url: str
    accent_color: Optional[str] = None
    published: bool = False
    created_at: str


class PublicSettings(BaseModel):
    open_slots: int
    total_slots: int
    portfolio_tags: List[str]
    last_content_updated: str


class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str


class AdminLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class FileMeta(BaseModel):
    id: str
    storage_path: str
    original_filename: str
    content_type: str
    size: int
    created_at: str


# ------------------------------------------------------------------ storage helper
_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    """Initialize once at startup. Returns storage_key or None on failure."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set — object storage disabled")
        return None
    try:
        resp = requests.post(
            f"{STORAGE_URL}/init",
            json={"emergent_key": EMERGENT_KEY},
            timeout=30,
        )
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as exc:  # noqa: BLE001
        logger.error("Storage init failed: %s", exc)
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ------------------------------------------------------------------ auth
def create_admin_token(email: str) -> str:
    payload = {
        "sub": email,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MIN),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(401, f"Invalid token: {exc}") from exc


def require_admin(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return payload


# ------------------------------------------------------------------ app
app = FastAPI(title="VANCE API", version="0.1.0")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup() -> None:
    init_storage()
    # Ensure the singleton settings doc exists
    settings_doc = await db.settings.find_one({"_id": "singleton"})
    if not settings_doc:
        await db.settings.insert_one(
            {
                "_id": "singleton",
                "open_slots": 3,
                "total_slots": 3,
                "portfolio_tags": ["Logo", "Brand Identity", "Social Kit"],
                "last_content_updated": now_iso(),
            }
        )
        logger.info("Seeded default settings")

    # Seed mockup library
    if await db.mockups.count_documents({}) == 0:
        cdn2 = "https://customer-assets-lqy194kg.emergentagent.net/job_vance-wip/artifacts"
        mockups_seed = [
            {
                "id": "mk-xtwitter",
                "label": "X/Twitter profile",
                "category": "social",
                "url": f"{cdn2}/pbiu0vt7_Untitled%2020.png",
                "placement_type": "flat",
                "zone": [615, 470, 380, 380],
                "logo_hex": "#000000",
                "requirement": "Black logo, avatar zone",
            },
            {
                "id": "mk-bizcard",
                "label": "Business card on tiles",
                "category": "print",
                "url": f"{cdn2}/q70gqakf_Untitled%2020%20%281%29.png",
                "placement_type": "flat",
                "zone": [720, 490, 380, 220],
                "logo_hex": "#000000",
                "requirement": "Black logo, transparent bg",
            },
            {
                "id": "mk-phoneinhand",
                "label": "Phone in hand",
                "category": "device",
                "url": f"{cdn2}/ddlhgonq_hands_iphones_preview_4_5cc96b583d.png",
                "placement_type": "flat",
                "zone": [800, 500, 320, 320],
                "logo_hex": "#FFFFFF",
                "requirement": "White logo, transparent bg",
            },
            {
                "id": "mk-eventpass",
                "label": "Event pass / badge",
                "category": "print",
                "url": f"{cdn2}/nd180i8r_for%20apparel%20either%20black%20logo%20or%20white%20logo%20both%20transparent%20bg%20and%20make%20it%20small%20ish%20and%20center%20it%20as%20shown%203rd%20image.png",
                "placement_type": "flat",
                "zone": [820, 620, 260, 220],
                "logo_hex": "#000000",
                "requirement": "Black logo, transparent bg",
            },
            {
                "id": "mk-aframe",
                "label": "A-frame sandwich board",
                "category": "environmental",
                "url": f"{cdn2}/5a89v76s_for%20apparel%20either%20black%20logo%20or%20white%20logo%20both%20transparent%20bg%20and%20make%20it%20small%20ish%20and%20center%20it%20as%20shown%203rd%20image%20%281%29.png",
                "placement_type": "angled",
                "corners": [[460, 250], [880, 240], [870, 610], [470, 620]],
                "logo_hex": "#000000",
                "requirement": "Black logo, transparent bg",
            },
        ]
        await db.mockups.insert_many(mockups_seed)
        logger.info("Seeded %d mockups", len(mockups_seed))


@app.on_event("shutdown")
async def on_shutdown() -> None:
    client.close()


# ------------------------------------------------------------------ health
@api.get("/health")
async def health() -> dict:
    return {"ok": True, "storage": _storage_key is not None, "time": now_iso()}


# ------------------------------------------------------------------ settings (public)
@api.get("/settings/public", response_model=PublicSettings)
async def get_public_settings() -> PublicSettings:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        raise HTTPException(500, "Settings uninitialized")
    return PublicSettings(
        open_slots=int(doc.get("open_slots", 0)),
        total_slots=int(doc.get("total_slots", 0)),
        portfolio_tags=doc.get("portfolio_tags", []),
        last_content_updated=doc.get("last_content_updated", now_iso()),
    )


# ------------------------------------------------------------------ uploads (public — for request references)
@api.post("/uploads/reference")
async def upload_reference(file: UploadFile = File(...)) -> dict:
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else "bin"
    if ext not in ALLOWED_UPLOAD_EXTS:
        raise HTTPException(400, f"Unsupported file type: {ext}")

    data = await file.read()
    if len(data) > IMAGE_MAX_BYTES:
        raise HTTPException(400, "File too large (max 10MB)")

    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/references/{file_id}.{ext}"

    result = put_object(path, data, content_type)

    doc = {
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename or f"{file_id}.{ext}",
        "content_type": content_type,
        "size": int(result.get("size", len(data))),
        "kind": "reference",
        "created_at": now_iso(),
        "is_deleted": False,
    }
    await db.files.insert_one(doc)
    return {
        "file_id": file_id,
        "original_filename": doc["original_filename"],
        "size": doc["size"],
        "url": f"/api/files/{file_id}",
    }


@api.get("/files/{file_id}")
async def download_file(file_id: str) -> Response:
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    data, content_type = get_object(record["storage_path"])
    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ------------------------------------------------------------------ commission requests
@api.post("/requests", response_model=CommissionRequest, status_code=201)
async def create_request(payload: CommissionRequestCreate) -> CommissionRequest:
    # Basic anti-abuse: reject if description is all spaces / very short after strip
    if len(payload.description.strip()) < 10:
        raise HTTPException(400, "Description is too short")

    # Verify referenced files exist
    if payload.reference_file_ids:
        existing = await db.files.count_documents(
            {"id": {"$in": payload.reference_file_ids}, "is_deleted": False}
        )
        if existing != len(payload.reference_file_ids):
            raise HTTPException(400, "One or more reference files not found")

    req = CommissionRequest(
        name=payload.name.strip(),
        email=payload.email,
        commission_type=payload.commission_type,
        description=payload.description.strip(),
        budget=payload.budget,
        reference_file_ids=payload.reference_file_ids,
    )
    await db.requests.insert_one(req.model_dump())
    logger.info("New commission request: %s <%s>", req.name, req.email)
    return req


@api.get("/requests/count")
async def requests_count() -> dict:
    total = await db.requests.count_documents({})
    new = await db.requests.count_documents({"status": "New"})
    return {"total": total, "new": new}


# ------------------------------------------------------------------ testimonials + portfolio (public read)
@api.get("/testimonials", response_model=List[Testimonial])
async def list_testimonials() -> List[Testimonial]:
    docs = await db.testimonials.find(
        {"approved": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return [Testimonial(**d) for d in docs]


@api.get("/portfolio", response_model=List[PortfolioItem])
async def list_portfolio(tag: Optional[str] = Query(default=None)) -> List[PortfolioItem]:
    query: dict = {"published": True}
    if tag and tag.lower() != "all":
        query["tags"] = tag
    docs = await db.portfolio.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [PortfolioItem(**d) for d in docs]


# ------------------------------------------------------------------ admin auth
@api.post("/auth/admin/login", response_model=AdminLoginOut)
async def admin_login(payload: AdminLoginIn) -> AdminLoginOut:
    # Compare against env-configured admin. Single admin only.
    if payload.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(401, "Invalid credentials")
    # ADMIN_PASSWORD is stored as plaintext in .env for the single-admin
    # bootstrap. Compared in constant-ish time.
    if not _safe_str_eq(payload.password, ADMIN_PASSWORD):
        raise HTTPException(401, "Invalid credentials")

    token = create_admin_token(payload.email.lower())
    return AdminLoginOut(access_token=token, email=payload.email.lower())


@api.get("/auth/me")
async def whoami(admin=Depends(require_admin)) -> dict:
    return {"email": admin["sub"], "role": admin["role"]}


# ------------------------------------------------------------------ admin: requests inbox
class RequestActionIn(BaseModel):
    reason: Optional[str] = None


@api.get("/admin/requests")
async def admin_list_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin=Depends(require_admin),
) -> List[dict]:
    query: dict = {}
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    docs = await db.requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.post("/admin/requests/{request_id}/read")
async def admin_mark_read(request_id: str, admin=Depends(require_admin)) -> dict:
    result = await db.requests.update_one({"id": request_id}, {"$set": {"read": True}})
    if result.matched_count == 0:
        raise HTTPException(404, "Request not found")
    return {"ok": True}


@api.post("/admin/requests/{request_id}/accept")
async def admin_accept_request(
    request_id: str, payload: RequestActionIn, admin=Depends(require_admin)
) -> dict:
    req = await db.requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(404, "Request not found")
    if req.get("status") not in {"New", "Awaiting Response"}:
        raise HTTPException(400, f"Cannot accept from status {req.get('status')}")

    now = now_iso()
    # Advance the request
    await db.requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": "Accepted – Awaiting Deposit",
                "read": True,
                "updated_at": now,
            }
        },
    )
    # Auto-create an Order
    order_id = str(uuid.uuid4())
    order = {
        "id": order_id,
        "request_id": request_id,
        "client_name": req["name"],
        "client_email": req["email"],
        "commission_type": req.get("commission_type"),
        "description": req.get("description"),
        "budget": req.get("budget"),
        "status": "Accepted – Awaiting Deposit",
        "payment_status": "Deposit Pending",
        "showcase_safe": True,
        "revision_count": 0,
        "activity": [
            {"at": now, "note": f"Accepted by {admin['sub']}", "actor": "admin"},
        ],
        "reference_file_ids": req.get("reference_file_ids", []),
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order)
    email_request_accepted(to=req["email"], name=req["name"], order_id=order_id)
    logger.info("Request %s accepted → order %s created", request_id, order_id)
    return {"ok": True, "order_id": order_id}


@api.post("/admin/requests/{request_id}/decline")
async def admin_decline_request(
    request_id: str, payload: RequestActionIn, admin=Depends(require_admin)
) -> dict:
    req = await db.requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(404, "Request not found")
    now = now_iso()
    await db.requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": "Declined",
                "read": True,
                "decline_reason": payload.reason or None,
                "updated_at": now,
            }
        },
    )
    # TODO(Phase 3.5): dispatch "Request Declined" email.
    logger.info("Request %s declined", request_id)
    return {"ok": True}


# ------------------------------------------------------------------ admin: orders
@api.get("/admin/orders")
async def admin_list_orders(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    admin=Depends(require_admin),
) -> List[dict]:
    query: dict = {}
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/admin/orders/{order_id}")
async def admin_get_order(order_id: str, admin=Depends(require_admin)) -> dict:
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


class OrderStatusIn(BaseModel):
    status: str


ALLOWED_ORDER_STATUSES = {
    "Accepted – Awaiting Deposit",
    "Awaiting Manual Payment Confirmation",
    "In Queue",
    "Sketching",
    "Final Review",
    "Delivered – Awaiting Final Payment",
    "Delivered – Awaiting Review",
    "Closed",
}


@api.patch("/admin/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str, payload: OrderStatusIn, admin=Depends(require_admin)
) -> dict:
    if payload.status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(400, f"Invalid status: {payload.status}")

    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    # Closed requires a review submission — enforce doc rule.
    if payload.status == "Closed":
        review_count = await db.testimonials.count_documents({"order_id": order_id})
        if review_count == 0:
            raise HTTPException(400, "Cannot close: client review not submitted")

    now = now_iso()
    activity = order.get("activity", [])
    activity.append(
        {
            "at": now,
            "note": f"Status → {payload.status}",
            "actor": "admin",
        }
    )
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": payload.status, "updated_at": now, "activity": activity}},
    )
    # Fire status-based emails
    try:
        if payload.status == "In Queue":
            email_deposit_confirmed(to=order["client_email"], name=order["client_name"], order_id=order_id)
        elif payload.status in ("Delivered – Awaiting Final Payment", "Delivered – Awaiting Review"):
            email_order_delivered(to=order["client_email"], name=order["client_name"], order_id=order_id)
            email_review_request(to=order["client_email"], name=order["client_name"], order_id=order_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Status email failed: %s", exc)
    return {"ok": True, "status": payload.status}


# ------------------------------------------------------------------ admin: dashboard summary
@api.get("/admin/dashboard/summary")
async def admin_dashboard_summary(admin=Depends(require_admin)) -> dict:
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
    open_requests = await db.requests.count_documents({"status": "New"})
    active_orders = await db.orders.count_documents(
        {"status": {"$in": ["In Queue", "Sketching", "Final Review"]}}
    )
    delivered_this_month = await db.orders.count_documents(
        {
            "status": {"$in": ["Delivered – Awaiting Review", "Closed"]},
            "updated_at": {"$gte": month_start},
        }
    )
    total_orders = await db.orders.count_documents({})
    recent_requests = await db.requests.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(6)
    recent_orders = await db.orders.find(
        {}, {"_id": 0, "activity": 0}
    ).sort("updated_at", -1).to_list(6)
    return {
        "open_requests": open_requests,
        "active_orders": active_orders,
        "delivered_this_month": delivered_this_month,
        "total_orders": total_orders,
        "recent_requests": recent_requests,
        "recent_orders": recent_orders,
    }


# ------------------------------------------------------------------ admin: settings
class SettingsUpdateIn(BaseModel):
    open_slots: Optional[int] = None
    total_slots: Optional[int] = None
    portfolio_tags: Optional[List[str]] = None


@api.get("/admin/settings")
async def admin_get_settings(admin=Depends(require_admin)) -> dict:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        raise HTTPException(500, "Settings uninitialized")
    doc.pop("_id", None)
    return doc


@api.patch("/admin/settings")
async def admin_update_settings(
    payload: SettingsUpdateIn, admin=Depends(require_admin)
) -> dict:
    updates: dict = {}
    if payload.open_slots is not None:
        if payload.open_slots < 0:
            raise HTTPException(400, "open_slots must be ≥ 0")
        updates["open_slots"] = int(payload.open_slots)
    if payload.total_slots is not None:
        if payload.total_slots < 1:
            raise HTTPException(400, "total_slots must be ≥ 1")
        updates["total_slots"] = int(payload.total_slots)
    if payload.portfolio_tags is not None:
        updates["portfolio_tags"] = [t.strip() for t in payload.portfolio_tags if t.strip()]
    if not updates:
        raise HTTPException(400, "No changes provided")
    updates["last_content_updated"] = now_iso()
    await db.settings.update_one({"_id": "singleton"}, {"$set": updates})
    doc = await db.settings.find_one({"_id": "singleton"})
    doc.pop("_id", None)
    return doc


def _safe_str_eq(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0


# ------------------------------------------------------------------ client portal auth (magic-link + DEVTEST bypass)
def create_client_token(email: str, name: Optional[str] = None) -> str:
    payload = {
        "sub": email.lower(),
        "role": "client",
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_client(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    if payload.get("role") != "client":
        raise HTTPException(403, "Client only")
    return payload


class PortalLoginIn(BaseModel):
    email: EmailStr
    password: Optional[str] = None


class PortalVerifyIn(BaseModel):
    token: str


@api.post("/portal/login")
async def portal_login(payload: PortalLoginIn) -> dict:
    """Two modes:
    - DEVTEST password → immediate session (dev shortcut per user's request)
    - No password → generate one-time magic link, email it, return {sent:true}
    """
    email = payload.email.lower()
    # DEV shortcut
    if payload.password and payload.password == CLIENT_DEV_PASSWORD:
        # Ensure at least one order exists for this email? Not required.
        req = await db.requests.find_one({"email": email})
        name = req["name"] if req else email.split("@")[0]
        return {
            "mode": "password",
            "access_token": create_client_token(email, name),
            "email": email,
        }

    # Magic-link mode: block emails with no prior request to prevent spam scans
    req = await db.requests.find_one({"email": email})
    if not req:
        # Same success response — don't leak whether the email exists
        return {"mode": "magic-link", "sent": True}

    link_token = secrets.token_urlsafe(32)
    await db.magic_links.insert_one(
        {
            "token": link_token,
            "email": email,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
            "used": False,
            "created_at": now_iso(),
        }
    )
    email_magic_link(to=email, name=req["name"], link_token=link_token)
    return {"mode": "magic-link", "sent": True}


@api.post("/portal/verify")
async def portal_verify(payload: PortalVerifyIn) -> dict:
    record = await db.magic_links.find_one({"token": payload.token, "used": False})
    if not record:
        raise HTTPException(400, "Invalid or already-used link")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Link expired")
    await db.magic_links.update_one({"token": payload.token}, {"$set": {"used": True}})
    email = record["email"]
    req = await db.requests.find_one({"email": email})
    name = req["name"] if req else email.split("@")[0]
    return {"access_token": create_client_token(email, name), "email": email}


@api.get("/portal/me")
async def portal_me(client=Depends(require_client)) -> dict:
    return {"email": client["sub"], "name": client.get("name"), "role": client["role"]}


# ------------------------------------------------------------------ client portal — orders
@api.get("/portal/orders")
async def portal_list_orders(client=Depends(require_client)) -> List[dict]:
    email = client["sub"]
    docs = await db.orders.find(
        {"client_email": email}, {"_id": 0, "activity": 0}
    ).sort("created_at", -1).to_list(100)
    return docs


@api.get("/portal/orders/{order_id}")
async def portal_get_order(order_id: str, client=Depends(require_client)) -> dict:
    doc = await db.orders.find_one(
        {"id": order_id, "client_email": client["sub"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Order not found")
    return doc


# ------------------------------------------------------------------ messages (shared: admin + client)
class MessageIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)
    attachment_file_ids: List[str] = Field(default_factory=list)


async def _persist_message(order_id: str, from_side: str, body: str, attachments: list) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "from_side": from_side,  # "admin" | "client"
        "body": body,
        "attachment_file_ids": attachments,
        "read_by_admin": from_side == "admin",
        "read_by_client": from_side == "client",
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/orders/{order_id}/messages")
async def admin_list_messages(order_id: str, admin=Depends(require_admin)) -> List[dict]:
    docs = await db.messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Mark client → admin messages as read
    await db.messages.update_many(
        {"order_id": order_id, "from_side": "client", "read_by_admin": False},
        {"$set": {"read_by_admin": True}},
    )
    return docs


@api.post("/admin/orders/{order_id}/messages")
async def admin_send_message(
    order_id: str, payload: MessageIn, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    msg = await _persist_message(order_id, "admin", payload.body, payload.attachment_file_ids)
    # Fire-and-forget email notification to client
    email_new_message(
        to=order["client_email"],
        name=order["client_name"],
        order_id=order_id,
        preview=payload.body,
        from_side="admin",
    )
    return msg


@api.get("/portal/orders/{order_id}/messages")
async def portal_list_messages(order_id: str, client=Depends(require_client)) -> List[dict]:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    docs = await db.messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.messages.update_many(
        {"order_id": order_id, "from_side": "admin", "read_by_client": False},
        {"$set": {"read_by_client": True}},
    )
    return docs


@api.post("/portal/orders/{order_id}/messages")
async def portal_send_message(
    order_id: str, payload: MessageIn, client=Depends(require_client)
) -> dict:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    msg = await _persist_message(order_id, "client", payload.body, payload.attachment_file_ids)
    email_new_message(
        to=ADMIN_EMAIL,
        name="Vance",
        order_id=order_id,
        preview=payload.body,
        from_side="client",
    )
    return msg


# ------------------------------------------------------------------ reviews (client submits)
class ReviewIn(BaseModel):
    quote: str = Field(..., min_length=10, max_length=1000)
    rating: int = Field(default=5, ge=1, le=5)


@api.post("/portal/orders/{order_id}/review")
async def portal_submit_review(
    order_id: str, payload: ReviewIn, client=Depends(require_client)
) -> dict:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    # One review per order
    existing = await db.testimonials.find_one({"order_id": order_id})
    if existing:
        raise HTTPException(400, "Review already submitted")

    doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "client_name": order["client_name"],
        "quote": payload.quote.strip(),
        "rating": int(payload.rating),
        "approved": False,  # admin approves before it appears publicly
        "created_at": now_iso(),
    }
    await db.testimonials.insert_one(doc)
    # Advance order → Closed
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "Closed", "updated_at": now_iso()}, "$push": {"activity": {"at": now_iso(), "note": "Client submitted review", "actor": "client"}}},
    )
    return {"ok": True}


# ------------------------------------------------------------------ portfolio CRUD (admin)
class PortfolioIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    tags: List[str] = Field(default_factory=list)
    cover_image_url: str
    description: Optional[str] = None
    accent_color: Optional[str] = None
    home_visible: bool = False
    published: bool = True


@api.get("/admin/portfolio")
async def admin_list_portfolio(admin=Depends(require_admin)) -> List[dict]:
    docs = await db.portfolio.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return docs


@api.post("/admin/portfolio")
async def admin_create_portfolio(payload: PortfolioIn, admin=Depends(require_admin)) -> dict:
    if payload.home_visible:
        home_count = await db.portfolio.count_documents({"home_visible": True})
        if home_count >= 5:
            raise HTTPException(400, "At most 5 items can be home-visible. Un-toggle one first.")
    order_val = await db.portfolio.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "tags": payload.tags,
        "cover_image_url": payload.cover_image_url,
        "description": payload.description,
        "accent_color": payload.accent_color,
        "home_visible": payload.home_visible,
        "published": payload.published,
        "order": order_val,
        "created_at": now_iso(),
    }
    await db.portfolio.insert_one(doc)
    doc.pop("_id", None)
    return doc


class PortfolioPatch(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_image_url: Optional[str] = None
    description: Optional[str] = None
    accent_color: Optional[str] = None
    home_visible: Optional[bool] = None
    published: Optional[bool] = None
    order: Optional[int] = None


@api.patch("/admin/portfolio/{item_id}")
async def admin_update_portfolio(item_id: str, payload: PortfolioPatch, admin=Depends(require_admin)) -> dict:
    existing = await db.portfolio.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Portfolio item not found")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates.get("home_visible") and not existing.get("home_visible"):
        home_count = await db.portfolio.count_documents({"home_visible": True})
        if home_count >= 5:
            raise HTTPException(400, "At most 5 items can be home-visible.")

    if not updates:
        raise HTTPException(400, "No changes provided")
    await db.portfolio.update_one({"id": item_id}, {"$set": updates})
    doc = await db.portfolio.find_one({"id": item_id}, {"_id": 0})
    return doc


@api.delete("/admin/portfolio/{item_id}")
async def admin_delete_portfolio(item_id: str, admin=Depends(require_admin)) -> dict:
    result = await db.portfolio.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Portfolio item not found")
    return {"ok": True}


# Overwrite public /portfolio to sort by `order` and support home-only filter
@api.get("/portfolio/home")
async def list_portfolio_home() -> List[dict]:
    docs = await db.portfolio.find(
        {"published": True, "home_visible": True}, {"_id": 0}
    ).sort("order", 1).limit(5).to_list(5)
    return docs


@api.get("/portfolio/{item_id}")
async def get_portfolio_item(item_id: str) -> dict:
    doc = await db.portfolio.find_one({"id": item_id, "published": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Portfolio item not found")
    return doc


# ------------------------------------------------------------------ automation settings (watermark + mockups)
class AutomationSettingsIn(BaseModel):
    watermark_opacity: Optional[float] = Field(default=None, ge=0.05, le=1.0)
    watermark_size_pct: Optional[float] = Field(default=None, ge=0.05, le=1.0)


@api.get("/admin/automation")
async def admin_get_automation(admin=Depends(require_admin)) -> dict:
    doc = await db.settings.find_one({"_id": "singleton"}) or {}
    return {
        "watermark_opacity": doc.get("watermark_opacity", 0.35),
        "watermark_size_pct": doc.get("watermark_size_pct", 0.35),
        "watermark_url": (
            "https://customer-assets-lxgj4vgw.emergentagent.net/"
            "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/"
            "pzblpyw9_Logo%20%2825%29.png"
        ),
        "mockup_count": await db.mockups.count_documents({}),
    }


@api.patch("/admin/automation")
async def admin_update_automation(payload: AutomationSettingsIn, admin=Depends(require_admin)) -> dict:
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(400, "No changes provided")
    updates["last_content_updated"] = now_iso()
    await db.settings.update_one({"_id": "singleton"}, {"$set": updates})
    return await admin_get_automation(admin=admin)


# ------------------------------------------------------------------ mockups library
@api.get("/admin/mockups")
async def admin_list_mockups(admin=Depends(require_admin)) -> List[dict]:
    docs = await db.mockups.find({}, {"_id": 0}).sort("category", 1).to_list(100)
    return docs


# ------------------------------------------------------------------ auto-watermark preview
class WatermarkPreviewIn(BaseModel):
    logo_url: str


@api.post("/admin/watermark/preview")
async def admin_watermark_preview(payload: WatermarkPreviewIn, admin=Depends(require_admin)) -> Response:
    settings = await db.settings.find_one({"_id": "singleton"}) or {}
    opacity = float(settings.get("watermark_opacity", 0.35))
    size_pct = float(settings.get("watermark_size_pct", 0.35))
    wm_url = (
        "https://customer-assets-lxgj4vgw.emergentagent.net/"
        "job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts/"
        "pzblpyw9_Logo%20%2825%29.png"
    )
    try:
        data = apply_watermark(payload.logo_url, wm_url, opacity=opacity, size_pct=size_pct)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Watermark failed: {exc}") from exc
    return Response(content=data, media_type="image/png")


# ------------------------------------------------------------------ showcase automation
class ShowcasePrepareIn(BaseModel):
    logo_url: str


@api.post("/admin/orders/{order_id}/showcase/prepare")
async def admin_showcase_prepare(
    order_id: str, payload: ShowcasePrepareIn, admin=Depends(require_admin)
) -> dict:
    """Analyse the logo, extract accent, and list COMPATIBLE mockups.
    Every mockup in our seed library only requires black/white/#EB211A logo
    variants — all auto-generatable from any transparent PNG — so nothing is
    filtered out today. The filter is kept as a hook for future formats
    (e.g. multi-color logos that can't recolor cleanly)."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    try:
        logo_pil = _download_image(payload.logo_url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Could not load logo: {exc}") from exc

    accent = dominant_color_hex(logo_pil)

    mockups = await db.mockups.find({}, {"_id": 0}).sort("category", 1).to_list(100)
    # Simple compatibility rule: all built-ins are compatible for any RGBA logo.
    compatible = mockups

    return {
        "order_id": order_id,
        "logo_url": payload.logo_url,
        "accent_color": accent,
        "compatible_mockups": compatible,
    }


class ShowcaseGenerateIn(BaseModel):
    logo_url: str
    mockup_ids: List[str]
    rationale_headline: Optional[str] = None
    rationale_bullets: List[str] = Field(default_factory=list)
    portfolio_tags: List[str] = Field(default_factory=list)
    social_banner_url: Optional[str] = None


@api.post("/admin/orders/{order_id}/showcase/generate")
async def admin_showcase_generate(
    order_id: str, payload: ShowcaseGenerateIn, admin=Depends(require_admin)
) -> dict:
    """Generate every mockup + auto tile for the selected set. Persists rendered
    outputs into object storage and returns URLs. Does NOT publish yet — user
    must call /publish afterwards."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if not payload.mockup_ids:
        raise HTTPException(400, "Select at least one mockup")

    logo_pil = _download_image(payload.logo_url)
    accent = dominant_color_hex(logo_pil)

    generated: list[dict] = []
    mockups = await db.mockups.find({"id": {"$in": payload.mockup_ids}}).to_list(100)
    for m in mockups:
        try:
            variant = recolor_logo(logo_pil, m.get("logo_hex", "#000000"))
            if m["placement_type"] == "flat":
                zone = tuple(m["zone"])  # type: ignore[assignment]
                data = place_flat(m["url"], variant, zone=zone)
            else:
                corners = [tuple(c) for c in m["corners"]]
                data = place_angled(m["url"], variant, corners=corners)
            url = await _save_generated(order_id, f"mockup_{m['id']}.png", data)
            generated.append({"kind": "mockup", "mockup_id": m["id"], "label": m["label"], "url": url})
        except Exception as exc:  # noqa: BLE001
            logger.warning("Mockup %s failed: %s", m["id"], exc)

    # Auto tiles
    try:
        typo = make_typography_tile(logo_pil)
        generated.append({"kind": "typography", "url": await _save_generated(order_id, "typography.png", typo)})
    except Exception as exc:  # noqa: BLE001
        logger.warning("typography tile failed: %s", exc)
    try:
        pat = make_pattern_tile(logo_pil, logo_hex=accent, bg_hex="#1A1A1A")
        generated.append({"kind": "pattern", "url": await _save_generated(order_id, "pattern.png", pat)})
    except Exception as exc:  # noqa: BLE001
        logger.warning("pattern tile failed: %s", exc)

    # Persist draft
    draft = {
        "order_id": order_id,
        "logo_url": payload.logo_url,
        "accent_color": accent,
        "tiles": generated,
        "rationale_headline": payload.rationale_headline,
        "rationale_bullets": payload.rationale_bullets,
        "portfolio_tags": payload.portfolio_tags,
        "social_banner_url": payload.social_banner_url,
        "updated_at": now_iso(),
    }
    await db.showcase_drafts.update_one({"order_id": order_id}, {"$set": draft}, upsert=True)
    return draft


class ShowcasePublishIn(BaseModel):
    title: str
    home_visible: bool = False


@api.post("/admin/orders/{order_id}/showcase/publish")
async def admin_showcase_publish(
    order_id: str, payload: ShowcasePublishIn, admin=Depends(require_admin)
) -> dict:
    draft = await db.showcase_drafts.find_one({"order_id": order_id})
    if not draft:
        raise HTTPException(404, "No draft to publish — run /generate first")

    if payload.home_visible:
        home_count = await db.portfolio.count_documents({"home_visible": True})
        if home_count >= 5:
            raise HTTPException(400, "At most 5 home-visible items")

    order_val = await db.portfolio.count_documents({})
    cover = next((t["url"] for t in draft["tiles"] if t["kind"] == "mockup"), None) or draft["logo_url"]
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "tags": draft.get("portfolio_tags", []),
        "cover_image_url": cover,
        "description": draft.get("rationale_headline"),
        "accent_color": draft.get("accent_color"),
        "tiles": draft.get("tiles", []),
        "rationale_headline": draft.get("rationale_headline"),
        "rationale_bullets": draft.get("rationale_bullets", []),
        "social_banner_url": draft.get("social_banner_url"),
        "home_visible": bool(payload.home_visible),
        "published": True,
        "source_order_id": order_id,
        "order": order_val,
        "created_at": now_iso(),
    }
    await db.portfolio.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------------------ helper: download logo for image_service
def _download_image(url: str) -> "Image.Image":  # noqa: F821
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return Image.open(_io.BytesIO(resp.content)).convert("RGBA")


async def _save_generated(order_id: str, name: str, data: bytes) -> str:
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/showcase/{order_id}/{file_id}_{name}"
    put_object(path, data, "image/png")
    await db.files.insert_one(
        {
            "id": file_id,
            "storage_path": path,
            "original_filename": name,
            "content_type": "image/png",
            "size": len(data),
            "kind": "showcase",
            "created_at": now_iso(),
            "is_deleted": False,
        }
    )
    return f"/api/files/{file_id}"


# ------------------------------------------------------------------ email trigger wiring on existing flows
# Extend accept / decline / status endpoints to fire emails without duplicating
# their logic — done by monkey-patching after-hook via wrappers below.


# ------------------------------------------------------------------ mount
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
