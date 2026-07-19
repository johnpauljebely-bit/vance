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

import json
import logging
import os
import re
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import jwt
import requests
from bson import ObjectId
from dotenv import load_dotenv

# Must run before any local-module import (email_service, image_service) —
# those modules read SMTP/API credentials from os.environ at import time, so
# loading .env after importing them silently bakes in empty defaults.
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Header,
    Query,
    Request,
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
    email_new_message,
    email_order_closed,
    email_order_delivered,
    email_order_status_update,
    email_otp_code,
    email_payment_receipt,
    email_payment_request,
    email_request_accepted,
    email_request_declined,
    email_review_request,
    email_waitlist_slot_open,
)
from invoice_service import generate_receipt_pdf
from image_service import (
    apply_corner_watermark,
    apply_watermark_layers,
    dominant_color_hex,
    generate_logo_kit,
    load_local_asset,
    recolor_logo,
)
from PIL import Image
import io as _io
import secrets

# ------------------------------------------------------------------ env / config
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
APP_NAME = os.environ.get("APP_NAME", "vance")
BRAND_LOGO_WHITE_ID = "brand-logo-white"
BRAND_LOGO_BLACK_ID = "brand-logo-black"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_EXPIRES_MIN = int(os.environ.get("JWT_EXPIRES_MINUTES", "1440"))
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@vance.design")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "changeme")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "hello@vance.design")

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
if STRIPE_SECRET_KEY:
    import stripe

    stripe.api_key = STRIPE_SECRET_KEY

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "zip": "application/zip",
}
IMAGE_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
# Image types (for reference uploads/portfolio) plus common document types
# for message attachments — PDF had a MIME entry above but was never in this
# allowlist, so PDFs were silently rejected.
ALLOWED_UPLOAD_EXTS = {"jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx", "zip"}

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
    interac_email: Optional[str] = None
    business_open: bool = True
    away_message: Optional[str] = None


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
                "business_open": True,
                "away_message": None,
                "default_revision_count": 2,
                "timezone": "America/Vancouver",
                "notify_new_message": True,
                "notify_status_update": True,
                "notify_payment_request": True,
            }
        )
        logger.info("Seeded default settings")

    # Ensure starter quick-reply templates exist (only ever seeded once —
    # admin can freely edit/delete after that without them coming back).
    if await db.templates.count_documents({}) == 0:
        starter_templates = [
            ("Accept confirmation",
             "Excited to bring your vision to life! I've accepted your commission — next step is a 50% deposit to get started. You'll find the payment options in your Client Portal."),
            ("Decline (polite)",
             "Thanks so much for reaching out! Unfortunately I'm not able to take this project on right now — my queue is full. Feel free to check back later or reach out again down the line."),
            ("Need more info / clarification",
             "Thanks for the request! Before I can put together an accurate quote, I need a bit more detail — could you share some reference images or examples of the style you're going for?"),
            ("Deposit reminder",
             "Just a friendly nudge — your 50% deposit is still outstanding. Once it's in, I'll get your project queued up right away!"),
            ("Payment reminder (final)",
             "Your project is ready to go — just need the remaining balance to release the final files. You can pay anytime from your Client Portal."),
            ("Delivery ready",
             "Your design is ready! Head to your Client Portal to check it out and download everything."),
            ("Revision received",
             "Got your revision notes, thank you! I'll get started on these changes and update you here once they're ready to review."),
            ("Revision denied (scope/limit reached)",
             "This request falls outside the revisions included in your package. I'm happy to make this change as a paid add-on — let me know if you'd like to move forward, or reach out if you have questions."),
            ("Order paused notice",
             "Quick heads up — I'm pausing work on this project for now. I'll follow up here as soon as we're ready to pick things back up."),
            ("Thank you / review request follow-up",
             "Thanks again for trusting me with your brand — it's been a pleasure working on this one! If you have a minute, I'd really appreciate a quick review in your Client Portal."),
        ]
        now = now_iso()
        await db.templates.insert_many(
            [
                {"id": str(uuid.uuid4()), "title": title, "body": body, "created_at": now, "updated_at": now}
                for title, body in starter_templates
            ]
        )
        logger.info("Seeded %d starter templates", len(starter_templates))

    # Seed the brand logo files (bundled in backend/assets) into object
    # storage under fixed ids, so BRAND_LOGO_WHITE_URL/BRAND_LOGO_BLACK_URL
    # resolve on first boot without any manual upload step — same pattern
    # as the settings/templates seeds above, just backed by a local file
    # instead of inline data.
    assets_dir = os.path.join(os.path.dirname(__file__), "assets")
    for file_id, filename, storage_name in (
        (BRAND_LOGO_WHITE_ID, "logo-white.png", "logo-white.png"),
        (BRAND_LOGO_BLACK_ID, "logo-black.png", "logo-black.png"),
    ):
        if await db.files.find_one({"id": file_id}):
            continue
        local_path = os.path.join(assets_dir, filename)
        if not os.path.exists(local_path):
            continue
        with open(local_path, "rb") as f:
            data = f.read()
        storage_path = f"{APP_NAME}/brand/{storage_name}"
        put_object(storage_path, data, "image/png")
        await db.files.insert_one(
            {
                "id": file_id,
                "storage_path": storage_path,
                "original_filename": filename,
                "content_type": "image/png",
                "size": len(data),
                "kind": "brand-logo",
                "created_at": now_iso(),
                "is_deleted": False,
            }
        )
        logger.info("Seeded brand logo %s", filename)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    client.close()


# ------------------------------------------------------------------ health
@api.get("/health")
async def health() -> dict:
    return {"ok": True, "storage": _storage_key is not None, "time": now_iso()}


# The client's own "major milestones only" preference only ever suppresses
# these two "minor" email types — request-accepted, deposit-confirmed,
# delivered, and payment-request emails are never touched by it.
_MINOR_NOTIFICATION_KEYS = {"notify_new_message", "notify_status_update"}


async def _notifications_enabled(key: str, client_email: Optional[str] = None) -> bool:
    """Three layers, most-specific-wins: admin's explicit per-client
    override > the client's own stated preference > the global default.
    Only meaningful for emails actually sent to a client; admin-facing
    notifications (e.g. "client sent a message") always use the global
    setting since there's no per-client concept for those."""
    if client_email:
        email = client_email.lower()
        note = await db.client_notes.find_one({"email": email})
        if note:
            override = (note.get("notification_overrides") or {}).get(key)
            if override is not None:
                return override
        if key in _MINOR_NOTIFICATION_KEYS:
            pref = await db.client_preferences.find_one({"email": email})
            if pref and pref.get("notification_level") == "major_milestones_only":
                return False
    doc = await db.settings.find_one({"_id": "singleton"}, {key: 1})
    return doc.get(key, True) if doc else True


async def _log_email(to: str, subject: str, order_id: Optional[str] = None) -> None:
    """Lightweight send audit trail — powers the Clients tab's 'emails sent'
    stat. Written alongside (not inside) the actual send, so it records the
    attempt regardless of whether the send itself succeeds or falls back."""
    await db.email_log.insert_one(
        {"id": str(uuid.uuid4()), "to": to, "subject": subject, "order_id": order_id, "sent_at": now_iso()}
    )


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
        interac_email=doc.get("interac_email") or ADMIN_EMAIL,
        business_open=doc.get("business_open", True),
        away_message=doc.get("away_message"),
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
    request_id: str, payload: RequestActionIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
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
        "quoted_price": None,
        "deposit_paid": False,
        "final_paid": False,
        "delivered_logo_url": None,
        "accent_color_dark": None,
        "accent_color_light": None,
        "full_payment_requested": False,
        "deadline": None,
        "invoices": [],
        "unique_payment_code": f"VC-{uuid.uuid4().hex[:6].upper()}",
        "revision_count": 0,
        "activity": [
            {"at": now, "note": f"Accepted by {admin['sub']}", "actor": "admin"},
        ],
        "reference_file_ids": req.get("reference_file_ids", []),
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order)
    background_tasks.add_task(email_request_accepted, to=req["email"], name=req["name"], order_id=order_id)
    background_tasks.add_task(_log_email, to=req["email"], subject="Commission Accepted", order_id=order_id)
    logger.info("Request %s accepted → order %s created", request_id, order_id)
    return {"ok": True, "order_id": order_id}


@api.post("/admin/requests/{request_id}/decline")
async def admin_decline_request(
    request_id: str, payload: RequestActionIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
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
    background_tasks.add_task(
        email_request_declined, to=req["email"], name=req["name"], reason=payload.reason or None
    )
    background_tasks.add_task(_log_email, to=req["email"], subject="Commission Update (Declined)")
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
    order_id: str, payload: OrderStatusIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
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
    # Every status change notifies the client — richer templates for the two
    # milestone transitions, a generic status email for everything else, so
    # coverage is total rather than limited to a couple of special cases.
    if payload.status == "In Queue":
        background_tasks.add_task(
            email_deposit_confirmed, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Deposit Received", order_id=order_id)
    elif payload.status in ("Delivered – Awaiting Final Payment", "Delivered – Awaiting Review"):
        background_tasks.add_task(
            email_order_delivered, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(
            email_review_request, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Design Delivered", order_id=order_id)
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Leave a Review", order_id=order_id)
    elif await _notifications_enabled("notify_status_update", order["client_email"]):
        background_tasks.add_task(
            email_order_status_update,
            to=order["client_email"],
            name=order["client_name"],
            order_id=order_id,
            status=payload.status,
        )
        background_tasks.add_task(
            _log_email, to=order["client_email"], subject="Order Status Update", order_id=order_id
        )
    return {"ok": True, "status": payload.status}


class OrderCloseIn(BaseModel):
    reason: str = Field(default="", max_length=2000)


@api.post("/admin/orders/{order_id}/close")
async def admin_close_order(
    order_id: str, payload: OrderCloseIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
) -> dict:
    """Deliberate admin close (abandoned project, refund, etc.) — distinct
    from the normal client-review-triggered Closed status: takes a reason,
    doesn't require a review on file, and frees up a commission slot."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    now = now_iso()
    reason = payload.reason.strip()
    activity = order.get("activity", [])
    activity.append(
        {"at": now, "note": f"Order closed by admin — {reason or 'no reason given'}", "actor": "admin"}
    )
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "Closed", "close_reason": reason or None, "updated_at": now, "activity": activity}},
    )
    background_tasks.add_task(
        email_order_closed, to=order["client_email"], name=order["client_name"], order_id=order_id, reason=reason or None
    )
    background_tasks.add_task(_log_email, to=order["client_email"], subject="Commission Closed", order_id=order_id)

    settings_doc = await db.settings.find_one({"_id": "singleton"}) or {}
    prev_open_slots = int(settings_doc.get("open_slots", 0))
    total_slots = int(settings_doc.get("total_slots", prev_open_slots))
    new_open_slots = min(prev_open_slots + 1, total_slots) if total_slots else prev_open_slots + 1
    if new_open_slots != prev_open_slots:
        await db.settings.update_one(
            {"_id": "singleton"}, {"$set": {"open_slots": new_open_slots, "last_content_updated": now}}
        )
        if prev_open_slots <= 0 and new_open_slots > 0:
            await _notify_waitlist(background_tasks)

    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


class OrderPricingIn(BaseModel):
    quoted_price: float = Field(..., ge=0)


@api.patch("/admin/orders/{order_id}/pricing")
async def admin_update_order_pricing(
    order_id: str, payload: OrderPricingIn, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one(
        {"id": order_id}, {"$set": {"quoted_price": payload.quoted_price, "updated_at": now_iso()}}
    )
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


class OrderAccentColorsIn(BaseModel):
    accent_color_dark: Optional[str] = None
    accent_color_light: Optional[str] = None


def _validate_hex(value: Optional[str], field: str) -> Optional[str]:
    if value is None or value == "":
        return None
    value = value.strip()
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        raise HTTPException(400, f"{field} must be a hex color like #1A1A1A")
    return value.upper()


@api.patch("/admin/orders/{order_id}/accent-colors")
async def admin_update_accent_colors(
    order_id: str, payload: OrderAccentColorsIn, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    dark = _validate_hex(payload.accent_color_dark, "accent_color_dark")
    light = _validate_hex(payload.accent_color_light, "accent_color_light")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"accent_color_dark": dark, "accent_color_light": light, "updated_at": now_iso()}},
    )
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


class OrderDeadlineIn(BaseModel):
    deadline: Optional[str] = None  # ISO date string, e.g. "2026-08-01"


@api.patch("/admin/orders/{order_id}/deadline")
async def admin_update_deadline(order_id: str, payload: OrderDeadlineIn, admin=Depends(require_admin)) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    deadline = payload.deadline.strip() if payload.deadline else None
    if deadline:
        try:
            datetime.fromisoformat(deadline)
        except ValueError:
            raise HTTPException(400, "deadline must be an ISO date, e.g. 2026-08-01")
    await db.orders.update_one({"id": order_id}, {"$set": {"deadline": deadline, "updated_at": now_iso()}})
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


class OrderDeliveredLogoIn(BaseModel):
    delivered_logo_url: str


@api.patch("/admin/orders/{order_id}/delivered-logo")
async def admin_update_delivered_logo(
    order_id: str, payload: OrderDeliveredLogoIn, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one(
        {"id": order_id}, {"$set": {"delivered_logo_url": payload.delivered_logo_url, "updated_at": now_iso()}}
    )
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


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
    interac_email: Optional[str] = None
    business_open: Optional[bool] = None
    away_message: Optional[str] = None
    default_revision_count: Optional[int] = None
    timezone: Optional[str] = None
    notify_new_message: Optional[bool] = None
    notify_status_update: Optional[bool] = None
    notify_payment_request: Optional[bool] = None


@api.get("/admin/settings")
async def admin_get_settings(admin=Depends(require_admin)) -> dict:
    doc = await db.settings.find_one({"_id": "singleton"})
    if not doc:
        raise HTTPException(500, "Settings uninitialized")
    doc.pop("_id", None)
    return doc


async def _notify_waitlist(background_tasks: BackgroundTasks) -> None:
    """Email everyone on the waitlist, in join order, then clear it — a
    one-time "a slot opened up" ping, not an ongoing subscription."""
    entries = await db.waitlist.find({}, {"_id": 0}).sort("joined_at", 1).to_list(1000)
    for entry in entries:
        background_tasks.add_task(email_waitlist_slot_open, to=entry["email"], name=entry["name"])
        background_tasks.add_task(_log_email, to=entry["email"], subject="A Commission Slot Is Open")
    if entries:
        await db.waitlist.delete_many({})


@api.patch("/admin/settings")
async def admin_update_settings(
    payload: SettingsUpdateIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
) -> dict:
    current = await db.settings.find_one({"_id": "singleton"}) or {}
    prev_open_slots = int(current.get("open_slots", 0))

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
    if payload.interac_email is not None:
        updates["interac_email"] = payload.interac_email.strip()
    if payload.business_open is not None:
        updates["business_open"] = payload.business_open
    if payload.away_message is not None:
        updates["away_message"] = payload.away_message.strip() or None
    if payload.default_revision_count is not None:
        if payload.default_revision_count < 0:
            raise HTTPException(400, "default_revision_count must be ≥ 0")
        updates["default_revision_count"] = int(payload.default_revision_count)
    if payload.timezone is not None:
        updates["timezone"] = payload.timezone.strip()
    if payload.notify_new_message is not None:
        updates["notify_new_message"] = payload.notify_new_message
    if payload.notify_status_update is not None:
        updates["notify_status_update"] = payload.notify_status_update
    if payload.notify_payment_request is not None:
        updates["notify_payment_request"] = payload.notify_payment_request
    if not updates:
        raise HTTPException(400, "No changes provided")
    updates["last_content_updated"] = now_iso()
    await db.settings.update_one({"_id": "singleton"}, {"$set": updates})

    new_open_slots = updates.get("open_slots", prev_open_slots)
    if prev_open_slots <= 0 and new_open_slots > 0:
        await _notify_waitlist(background_tasks)

    doc = await db.settings.find_one({"_id": "singleton"})
    doc.pop("_id", None)
    return doc


class WaitlistJoinIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=200)


@api.post("/waitlist")
async def join_waitlist(payload: WaitlistJoinIn) -> dict:
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address")
    existing = await db.waitlist.find_one({"email": email})
    if existing:
        return {"ok": True, "already_joined": True}
    await db.waitlist.insert_one(
        {"id": str(uuid.uuid4()), "name": payload.name.strip(), "email": email, "joined_at": now_iso()}
    )
    return {"ok": True, "already_joined": False}


@api.get("/admin/waitlist")
async def admin_list_waitlist(admin=Depends(require_admin)) -> dict:
    entries = await db.waitlist.find({}, {"_id": 0}).sort("joined_at", 1).to_list(1000)
    return {"count": len(entries), "entries": entries}


def _safe_str_eq(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0


# ------------------------------------------------------------------ client portal auth (email + 6-digit OTP)
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


class PortalVerifyOtpIn(BaseModel):
    email: EmailStr
    code: str


OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 3
OTP_RESEND_COOLDOWN_SECONDS = 45


@api.post("/portal/login")
async def portal_login(payload: PortalLoginIn) -> dict:
    """Email a 6-digit one-time code. Requires a prior commission request on
    file for this address — same "no account" behavior as before, just
    without leaking which emails exist (still returns a generic error only
    when there truly is no request, matching the pre-existing UX)."""
    email = payload.email.lower()
    req = await db.requests.find_one({"email": email})
    if not req:
        raise HTTPException(404, "You need to create an order first.")

    existing = await db.otp_codes.find_one({"email": email}, sort=[("created_at", -1)])
    if existing:
        last_sent = datetime.fromisoformat(existing["created_at"])
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
            wait = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(429, f"Please wait {wait}s before requesting another code")

    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.otp_codes.insert_one(
        {
            "email": email,
            "code": code,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat(),
            "attempts": 0,
            "used": False,
            "created_at": now_iso(),
        }
    )
    email_otp_code(to=email, name=req["name"], code=code)
    return {"sent": True, "expires_in_minutes": OTP_EXPIRY_MINUTES}


@api.post("/portal/verify-otp")
async def portal_verify_otp(payload: PortalVerifyOtpIn) -> dict:
    email = payload.email.lower()
    record = await db.otp_codes.find_one({"email": email, "used": False}, sort=[("created_at", -1)])
    if not record:
        raise HTTPException(400, "No active code — request a new one")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Code expired — request a new one")
    if record["attempts"] >= OTP_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many attempts — request a new code")

    if payload.code.strip() != record["code"]:
        await db.otp_codes.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        remaining = OTP_MAX_ATTEMPTS - (record["attempts"] + 1)
        if remaining <= 0:
            raise HTTPException(429, "Too many attempts — request a new code")
        raise HTTPException(400, f"Incorrect code — {remaining} attempt(s) left")

    await db.otp_codes.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    req = await db.requests.find_one({"email": email})
    name = req["name"] if req else email.split("@")[0]
    return {"access_token": create_client_token(email, name), "email": email}


@api.get("/portal/me")
async def portal_me(client=Depends(require_client)) -> dict:
    return {"email": client["sub"], "name": client.get("name"), "role": client["role"]}


class ClientPreferencesIn(BaseModel):
    notification_level: str  # "all" | "major_milestones_only"


@api.get("/portal/preferences")
async def portal_get_preferences(client=Depends(require_client)) -> dict:
    pref = await db.client_preferences.find_one({"email": client["sub"].lower()}, {"_id": 0})
    return {"notification_level": pref.get("notification_level", "all") if pref else "all"}


@api.patch("/portal/preferences")
async def portal_update_preferences(payload: ClientPreferencesIn, client=Depends(require_client)) -> dict:
    if payload.notification_level not in ("all", "major_milestones_only"):
        raise HTTPException(400, "Invalid notification_level")
    email = client["sub"].lower()
    await db.client_preferences.update_one(
        {"email": email},
        {"$set": {"email": email, "notification_level": payload.notification_level, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"notification_level": payload.notification_level}


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


# ------------------------------------------------------------------ revision annotation pins
ANNOTATABLE_STATUSES = {"Final Review", "Delivered – Awaiting Review"}


class AnnotationIn(BaseModel):
    x_pct: float = Field(..., ge=0, le=1)
    y_pct: float = Field(..., ge=0, le=1)
    comment: str = Field(..., min_length=1, max_length=1000)


@api.get("/portal/orders/{order_id}/annotations")
async def portal_list_annotations(order_id: str, client=Depends(require_client)) -> List[dict]:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    return await db.annotations.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api.post("/portal/orders/{order_id}/annotations")
async def portal_create_annotation(
    order_id: str, payload: AnnotationIn, background_tasks: BackgroundTasks, client=Depends(require_client)
) -> dict:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("status") not in ANNOTATABLE_STATUSES:
        raise HTTPException(400, "Annotations are only available during Final Review or after delivery")
    if not order.get("delivered_logo_url"):
        raise HTTPException(400, "No preview image attached to this order yet")
    doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "x_pct": payload.x_pct,
        "y_pct": payload.y_pct,
        "comment": payload.comment.strip(),
        "created_by": "client",
        "created_at": now_iso(),
    }
    await db.annotations.insert_one(doc)
    doc.pop("_id", None)
    if await _notifications_enabled("notify_new_message", order["client_email"]):
        background_tasks.add_task(
            email_new_message,
            to=ADMIN_EMAIL,
            name="Vance",
            order_id=order_id,
            preview=f"New revision pin: {payload.comment.strip()[:150]}",
            from_side="client",
        )
    return doc


@api.get("/admin/orders/{order_id}/annotations")
async def admin_list_annotations(order_id: str, admin=Depends(require_admin)) -> List[dict]:
    return await db.annotations.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api.delete("/admin/orders/{order_id}/annotations/{annotation_id}")
async def admin_delete_annotation(order_id: str, annotation_id: str, admin=Depends(require_admin)) -> dict:
    result = await db.annotations.delete_one({"id": annotation_id, "order_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Annotation not found")
    return {"ok": True}


# ------------------------------------------------------------------ payments
DEPOSIT_STAGE_STATUS = "Accepted – Awaiting Deposit"
FINAL_STAGE_STATUS = "Delivered – Awaiting Final Payment"


def _payment_amount_cents(order: dict, stage: str) -> int:
    price = order.get("quoted_price")
    if not price:
        raise HTTPException(400, "This order hasn't been quoted a price yet")
    full_payment = stage == "deposit" and order.get("full_payment_requested")
    return round(float(price) * (1.0 if full_payment else 0.5) * 100)


async def _confirm_payment(order_id: str, stage: str, *, method: str, background_tasks: BackgroundTasks) -> None:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return
    now = now_iso()
    full_payment = stage == "deposit" and order.get("full_payment_requested")
    field = "deposit_paid" if stage == "deposit" else "final_paid"
    next_status = "In Queue" if stage == "deposit" else "Delivered – Awaiting Review"
    payment_status = "Paid in Full" if full_payment else ("Deposit Paid" if stage == "deposit" else "Paid in Full")
    note = "Full payment" if full_payment else f"{stage.title()} payment"

    updates = {
        field: True,
        "status": next_status,
        "payment_status": payment_status,
        "payment_confirmation_requested": None,
        "full_payment_requested": False,
        "updated_at": now,
    }
    if full_payment:
        updates["final_paid"] = True

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": updates,
            "$push": {"activity": {"at": now, "note": f"{note} confirmed via {method}", "actor": "system"}},
        },
    )
    if stage == "deposit":
        background_tasks.add_task(
            email_deposit_confirmed, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Deposit Received", order_id=order_id)
    else:
        background_tasks.add_task(
            email_order_delivered, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(
            email_review_request, to=order["client_email"], name=order["client_name"], order_id=order_id
        )
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Design Delivered", order_id=order_id)
        background_tasks.add_task(_log_email, to=order["client_email"], subject="Leave a Review", order_id=order_id)

    # Auto-generate a PDF receipt for every confirmed payment, regardless of
    # method (Stripe/Interac/Robux all funnel through this one function) —
    # attached to its own email and made downloadable from the Client Portal.
    price = order.get("quoted_price") or 0
    receipt_amount = float(price) if full_payment else float(price) * 0.5
    receipt_stage = "full" if full_payment else stage
    receipt_number = f"{order.get('unique_payment_code', order_id[:8])}-{receipt_stage.upper()}"
    pdf_bytes = generate_receipt_pdf(
        order=order, stage=receipt_stage, amount=receipt_amount, method=method, receipt_number=receipt_number
    )
    receipt_url = await _save_generated(
        "receipts", f"{receipt_number}.pdf", pdf_bytes, content_type="application/pdf", kind="receipt"
    )
    receipt_file_id = receipt_url.rsplit("/", 1)[-1]
    await db.orders.update_one(
        {"id": order_id},
        {
            "$push": {
                "invoices": {
                    "stage": receipt_stage,
                    "file_id": receipt_file_id,
                    "receipt_number": receipt_number,
                    "amount": receipt_amount,
                    "method": method,
                    "created_at": now,
                }
            }
        },
    )
    background_tasks.add_task(
        email_payment_receipt,
        to=order["client_email"],
        name=order["client_name"],
        order_id=order_id,
        amount=receipt_amount,
        receipt_number=receipt_number,
        pdf_bytes=pdf_bytes,
    )
    background_tasks.add_task(_log_email, to=order["client_email"], subject="Payment Receipt", order_id=order_id)


class CreatePaymentIntentIn(BaseModel):
    stage: str  # "deposit" | "final"


@api.post("/portal/orders/{order_id}/payment/create-intent")
async def portal_create_payment_intent(
    order_id: str, payload: CreatePaymentIntentIn, client=Depends(require_client)
) -> dict:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe is not configured yet")
    if payload.stage not in ("deposit", "final"):
        raise HTTPException(400, "stage must be 'deposit' or 'final'")

    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")

    amount_cents = _payment_amount_cents(order, payload.stage)
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        metadata={"order_id": order_id, "stage": payload.stage},
        automatic_payment_methods={"enabled": True},
    )
    return {"client_secret": intent.client_secret, "amount_cents": amount_cents}


@api.post("/webhooks/stripe")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks) -> dict:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe is not configured")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            # No webhook secret configured yet (local dev without `stripe listen`) —
            # accept the payload unverified so the flow is still testable.
            event = json.loads(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid webhook payload: {exc}") from exc

    if event.get("type") == "payment_intent.succeeded":
        intent = event["data"]["object"]
        metadata = intent.get("metadata", {})
        order_id, stage = metadata.get("order_id"), metadata.get("stage")
        if order_id and stage:
            await _confirm_payment(order_id, stage, method="stripe", background_tasks=background_tasks)
    return {"received": True}


class MarkPaymentRequestedIn(BaseModel):
    stage: str  # "deposit" | "final"
    method: str = "robux"


@api.post("/portal/orders/{order_id}/payment/mark-requested")
async def portal_mark_payment_requested(
    order_id: str, payload: MarkPaymentRequestedIn, background_tasks: BackgroundTasks, client=Depends(require_client)
) -> dict:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    now = now_iso()
    activity = order.get("activity", [])
    activity.append(
        {
            "at": now,
            "note": f"Client marked {payload.stage} payment as sent via {payload.method} — awaiting confirmation",
            "actor": "client",
        }
    )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "payment_confirmation_requested": {
                    "method": payload.method,
                    "stage": payload.stage,
                    "requested_at": now,
                },
                "status": "Awaiting Manual Payment Confirmation",
                "updated_at": now,
                "activity": activity,
            }
        },
    )
    msg = await _persist_message(
        order_id,
        "client",
        "",
        [],
        kind="payment_confirmation",
        payload={"stage": payload.stage, "method": payload.method},
    )
    if await _notifications_enabled("notify_new_message"):
        background_tasks.add_task(
            email_new_message,
            to=ADMIN_EMAIL,
            name="Vance",
            order_id=order_id,
            preview=f"Payment confirmation requested — {payload.method} {payload.stage}",
            from_side="client",
        )
    return msg


class ConfirmPaymentIn(BaseModel):
    stage: str
    method: str = "manual"


@api.post("/admin/orders/{order_id}/confirm-payment")
async def admin_confirm_payment(
    order_id: str, payload: ConfirmPaymentIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    await _confirm_payment(order_id, payload.stage, method=payload.method, background_tasks=background_tasks)
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return doc


# ------------------------------------------------------------------ messages (shared: admin + client)
class MessageIn(BaseModel):
    body: str = Field(default="", max_length=10000)
    attachment_file_ids: List[str] = Field(default_factory=list)


async def _persist_message(
    order_id: str, from_side: str, body: str, attachments: list, *, kind: str = "text", payload: Optional[dict] = None
) -> dict:
    if kind == "text" and not body.strip() and not attachments:
        raise HTTPException(400, "Message needs text or an attachment")

    # Denormalize filename/content-type onto the message so the frontend can
    # render an inline image preview vs. a document link without a second
    # round-trip per attachment.
    attachment_meta = []
    for file_id in attachments:
        record = await db.files.find_one({"id": file_id, "is_deleted": False})
        if record:
            attachment_meta.append(
                {
                    "file_id": file_id,
                    "filename": record.get("original_filename", file_id),
                    "content_type": record.get("content_type", "application/octet-stream"),
                }
            )

    doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "from_side": from_side,  # "admin" | "client"
        "kind": kind,  # "text" | "payment_request"
        "body": body,
        "payload": payload,
        "attachment_file_ids": attachments,
        "attachments": attachment_meta,
        "read_by_admin": from_side == "admin",
        "read_by_client": from_side == "client",
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


# Slash-command registry for the admin message composer — general pattern so
# new payment-request types (or other embed-card commands) are one line to
# add, not a one-off hardcoded to "-deposit".
PAYMENT_COMMAND_STAGES = {"deposit": "deposit", "final": "final", "invoice": "final", "payment": "payment"}
_COMMAND_RE = re.compile(r"^-(\w+)$")


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
    order_id: str, payload: MessageIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    command_match = _COMMAND_RE.match(payload.body.strip())
    stage = PAYMENT_COMMAND_STAGES.get(command_match.group(1).lower()) if command_match else None
    if stage:
        if not order.get("quoted_price"):
            raise HTTPException(400, "Set a quoted price for this order before requesting payment")

        # "-payment" auto-resolves to whichever payment is actually
        # outstanding: the full amount in one shot if nothing's been paid
        # yet (rides the existing "deposit" checkout stage, just charging
        # 100% instead of 50% via the full_payment_requested flag), or the
        # normal remaining balance if the deposit's already in.
        full_payment = False
        if stage == "payment":
            if order.get("deposit_paid"):
                stage = "final"
            else:
                stage = "deposit"
                full_payment = True

        amount = round(order["quoted_price"] * (1.0 if full_payment else 0.5), 2)

        # Re-running -deposit/-final/-payment while a payment is still just
        # "awaiting confirmation" (not yet actually confirmed) reopens the
        # checkout — bring the order back to the pre-payment status
        # automatically. Once the payment is genuinely confirmed
        # (deposit_paid/final_paid), there's nothing to reopen, so this
        # never fires past that point.
        already_paid = order.get("deposit_paid") if stage == "deposit" else order.get("final_paid")
        now = now_iso()
        order_set = {"full_payment_requested": full_payment, "updated_at": now}
        activity = order.get("activity", [])
        if order.get("status") == "Awaiting Manual Payment Confirmation" and not already_paid:
            order_set["status"] = "Accepted – Awaiting Deposit" if stage == "deposit" else "Delivered – Awaiting Final Payment"
            order_set["payment_confirmation_requested"] = None
            activity.append(
                {"at": now, "note": f"Payment confirmation reset — {stage} checkout reopened", "actor": "admin"}
            )
            order_set["activity"] = activity
        await db.orders.update_one({"id": order_id}, {"$set": order_set})

        display_stage = "full" if full_payment else stage
        msg = await _persist_message(
            order_id, "admin", "", [], kind="payment_request", payload={"stage": display_stage, "amount": amount}
        )
        if await _notifications_enabled("notify_payment_request", order["client_email"]):
            background_tasks.add_task(
                email_payment_request,
                to=order["client_email"],
                name=order["client_name"],
                order_id=order_id,
                stage=display_stage,
                amount=amount,
            )
            background_tasks.add_task(
                _log_email, to=order["client_email"], subject="Payment Requested", order_id=order_id
            )
        return msg

    msg = await _persist_message(order_id, "admin", payload.body, payload.attachment_file_ids)
    # Genuinely fire-and-forget: email fires after the response is sent, so a
    # slow/blocking SMTP round-trip never delays message delivery.
    if await _notifications_enabled("notify_new_message", order["client_email"]):
        background_tasks.add_task(
            email_new_message,
            to=order["client_email"],
            name=order["client_name"],
            order_id=order_id,
            preview=payload.body,
            from_side="admin",
        )
        background_tasks.add_task(_log_email, to=order["client_email"], subject="New Message", order_id=order_id)
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
    order_id: str, payload: MessageIn, background_tasks: BackgroundTasks, client=Depends(require_client)
) -> dict:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    msg = await _persist_message(order_id, "client", payload.body, payload.attachment_file_ids)
    if await _notifications_enabled("notify_new_message"):
        background_tasks.add_task(
            email_new_message,
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


# ------------------------------------------------------------------ brand kit (6 flat logo variants, zipped)
async def _build_brand_kit_zip(order: dict) -> bytes:
    logo_url = order.get("delivered_logo_url")
    if not logo_url:
        raise HTTPException(400, "No delivered logo attached to this order yet")

    logo_pil = await _download_image(logo_url)
    dark_hex = order.get("accent_color_dark") or dominant_color_hex(logo_pil)
    light_hex = order.get("accent_color_light") or "#FFFFFF"
    variants = generate_logo_kit(logo_pil, dark_accent_hex=dark_hex, light_accent_hex=light_hex)

    buf = _io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, data in variants.items():
            zf.writestr(filename, data)
    return buf.getvalue()


@api.get("/portal/orders/{order_id}/brand-kit")
async def portal_download_brand_kit(order_id: str, client=Depends(require_client)) -> Response:
    order = await db.orders.find_one({"id": order_id, "client_email": client["sub"]})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("status") != "Closed":
        raise HTTPException(400, "Brand kit is available once your order is Closed")
    zip_bytes = await _build_brand_kit_zip(order)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="VanceLogo_BrandKit.zip"'},
    )


class SendKitIn(BaseModel):
    delivered_logo_url: Optional[str] = None
    message: str = Field(default="Here's your brand kit!", max_length=2000)


@api.post("/admin/orders/{order_id}/send-kit")
async def admin_send_kit(
    order_id: str, payload: SendKitIn, background_tasks: BackgroundTasks, admin=Depends(require_admin)
) -> dict:
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")

    if payload.delivered_logo_url:
        await db.orders.update_one(
            {"id": order_id}, {"$set": {"delivered_logo_url": payload.delivered_logo_url, "updated_at": now_iso()}}
        )
        order["delivered_logo_url"] = payload.delivered_logo_url

    zip_bytes = await _build_brand_kit_zip(order)
    zip_url = await _save_generated(
        "brand-kits", "VanceLogo_BrandKit.zip", zip_bytes, content_type="application/zip", kind="brand-kit"
    )
    file_id = zip_url.rsplit("/", 1)[-1]

    msg = await _persist_message(order_id, "admin", payload.message, [file_id])
    background_tasks.add_task(
        email_new_message,
        to=order["client_email"],
        name=order["client_name"],
        order_id=order_id,
        preview=payload.message,
        from_side="admin",
    )
    background_tasks.add_task(_log_email, to=order["client_email"], subject="New Message (Brand Kit)", order_id=order_id)
    return msg


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


# ------------------------------------------------------------------ portfolio publish flow
# Simple flow (replaces the old mockup/auto-showcase system): admin uploads a
# finished project photo, names it, and publishing auto-stamps a small
# brightness-matched corner logo — no mockups, no per-mockup color variants,
# no perspective warping.
class PortfolioPublishIn(BaseModel):
    image_url: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    home_visible: bool = False


@api.post("/admin/portfolio/publish")
async def admin_publish_portfolio(payload: PortfolioPublishIn, admin=Depends(require_admin)) -> dict:
    if payload.home_visible:
        home_count = await db.portfolio.count_documents({"home_visible": True})
        if home_count >= 5:
            raise HTTPException(400, "At most 5 items can be home-visible. Un-toggle one first.")

    try:
        raw = await _download_image(payload.image_url)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Could not load image: {exc}") from exc

    try:
        watermarked = apply_corner_watermark(raw)
        final_url = await _save_generated("portfolio", "cover.png", watermarked, kind="portfolio-cover")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Watermarking failed: {exc}") from exc

    order_val = await db.portfolio.count_documents({})
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "tags": payload.tags,
        "cover_image_url": final_url,
        "description": payload.description,
        "accent_color": dominant_color_hex(raw),
        "home_visible": payload.home_visible,
        "published": True,
        "order": order_val,
        "created_at": now_iso(),
    }
    await db.portfolio.insert_one(doc)
    doc.pop("_id", None)
    return doc


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


# ------------------------------------------------------------------ automation settings (watermark)
class WatermarkInstance(BaseModel):
    x_pct: float = Field(ge=0, le=1)
    y_pct: float = Field(ge=0, le=1)
    w_pct: float = Field(gt=0, le=1)
    h_pct: float = Field(gt=0, le=1)


class AutomationSettingsIn(BaseModel):
    watermark_opacity: Optional[float] = Field(default=None, ge=0.05, le=1.0)
    watermark_instances: Optional[List[WatermarkInstance]] = None


DEFAULT_WATERMARK_INSTANCE = {"x_pct": 0.325, "y_pct": 0.325, "w_pct": 0.35, "h_pct": 0.35}


@api.get("/admin/automation")
async def admin_get_automation(request: Request, admin=Depends(require_admin)) -> dict:
    doc = await db.settings.find_one({"_id": "singleton"}) or {}
    return {
        "watermark_opacity": doc.get("watermark_opacity", 0.35),
        "watermark_instances": doc.get("watermark_instances") or [DEFAULT_WATERMARK_INSTANCE],
        # Resolved from the incoming request rather than hardcoded, so this
        # points at whichever backend is actually serving the admin UI
        # (local in dev, live in prod) instead of always the live one.
        "watermark_url": f"{str(request.base_url).rstrip('/')}/api/files/{BRAND_LOGO_WHITE_ID}",
        "mockup_count": await db.mockups.count_documents({}),
    }


@api.patch("/admin/automation")
async def admin_update_automation(payload: AutomationSettingsIn, admin=Depends(require_admin)) -> dict:
    updates: dict = {}
    if payload.watermark_opacity is not None:
        updates["watermark_opacity"] = payload.watermark_opacity
    if payload.watermark_instances is not None:
        updates["watermark_instances"] = [i.model_dump() for i in payload.watermark_instances]
    if not updates:
        raise HTTPException(400, "No changes provided")
    updates["last_content_updated"] = now_iso()
    await db.settings.update_one({"_id": "singleton"}, {"$set": updates})
    return await admin_get_automation(admin=admin)


# ------------------------------------------------------------------ auto-watermark preview
class WatermarkPreviewIn(BaseModel):
    logo_url: str
    instances: Optional[List[WatermarkInstance]] = None
    opacity: Optional[float] = Field(default=None, ge=0.05, le=1.0)


@api.post("/admin/watermark/preview")
async def admin_watermark_preview(payload: WatermarkPreviewIn, admin=Depends(require_admin)) -> Response:
    settings = await db.settings.find_one({"_id": "singleton"}) or {}
    opacity = payload.opacity if payload.opacity is not None else float(settings.get("watermark_opacity", 0.35))
    instances = (
        [i.model_dump() for i in payload.instances]
        if payload.instances is not None
        else (settings.get("watermark_instances") or [DEFAULT_WATERMARK_INSTANCE])
    )
    wm_logo = load_local_asset("logo-white.png")
    try:
        data = apply_watermark_layers(payload.logo_url, wm_logo, opacity=opacity, instances=instances)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Watermark failed: {exc}") from exc
    return Response(content=data, media_type="image/png")


# ------------------------------------------------------------------ helper: download logo for image_service
_SELF_FILE_URL_RE = re.compile(r"^(?:https?://[^/]+)?/api/files/([0-9a-fA-F-]{36})$")


async def _download_image(url: str) -> "Image.Image":  # noqa: F821
    """Fetch an image for processing. URLs pointing at our OWN /api/files/{id}
    proxy are read straight from object storage instead of round-tripping
    through HTTP — an async handler blocking on `requests.get` back into its
    own single-worker server would otherwise deadlock waiting on a request
    the server can never get around to serving."""
    self_match = _SELF_FILE_URL_RE.match(url)
    if self_match:
        record = await db.files.find_one({"id": self_match.group(1), "is_deleted": False})
        if not record:
            raise ValueError("Referenced file not found")
        data, _content_type = get_object(record["storage_path"])
        return Image.open(_io.BytesIO(data)).convert("RGBA")

    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return Image.open(_io.BytesIO(resp.content)).convert("RGBA")


async def _save_generated(
    namespace: str, name: str, data: bytes, *, content_type: str = "image/png", kind: str = "generated"
) -> str:
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/{namespace}/{file_id}_{name}"
    put_object(path, data, content_type)
    await db.files.insert_one(
        {
            "id": file_id,
            "storage_path": path,
            "original_filename": name,
            "content_type": content_type,
            "size": len(data),
            "kind": kind,
            "created_at": now_iso(),
            "is_deleted": False,
        }
    )
    return f"/api/files/{file_id}"


# ------------------------------------------------------------------ email trigger wiring on existing flows
# Extend accept / decline / status endpoints to fire emails without duplicating
# their logic — done by monkey-patching after-hook via wrappers below.


# ------------------------------------------------------------------ templates (quick-reply CRUD)
class TemplateIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=5000)


class TemplateUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    body: Optional[str] = Field(default=None, min_length=1, max_length=5000)


@api.get("/admin/templates")
async def admin_list_templates(admin=Depends(require_admin)) -> List[dict]:
    return await db.templates.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)


@api.post("/admin/templates")
async def admin_create_template(payload: TemplateIn, admin=Depends(require_admin)) -> dict:
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "body": payload.body.strip(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/templates/{template_id}")
async def admin_update_template(template_id: str, payload: TemplateUpdateIn, admin=Depends(require_admin)) -> dict:
    existing = await db.templates.find_one({"id": template_id})
    if not existing:
        raise HTTPException(404, "Template not found")
    updates: dict = {"updated_at": now_iso()}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.body is not None:
        updates["body"] = payload.body.strip()
    await db.templates.update_one({"id": template_id}, {"$set": updates})
    doc = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return doc


@api.delete("/admin/templates/{template_id}")
async def admin_delete_template(template_id: str, admin=Depends(require_admin)) -> dict:
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


# ------------------------------------------------------------------ calendar
class CalendarEventIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    date: str  # ISO date, "2026-08-01"
    time: Optional[str] = None  # "HH:MM"
    color: str = Field(default="#6366F1")
    description: Optional[str] = Field(default=None, max_length=2000)
    link: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=200)


class CalendarEventUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[str] = None
    time: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    link: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=200)


@api.post("/admin/calendar-events")
async def admin_create_calendar_event(payload: CalendarEventIn, admin=Depends(require_admin)) -> dict:
    try:
        datetime.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(400, "date must be an ISO date, e.g. 2026-08-01")
    doc = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "date": payload.date,
        "time": payload.time,
        "color": payload.color,
        "description": payload.description,
        "link": payload.link,
        "location": payload.location,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.calendar_events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/calendar-events/{event_id}")
async def admin_update_calendar_event(
    event_id: str, payload: CalendarEventUpdateIn, admin=Depends(require_admin)
) -> dict:
    existing = await db.calendar_events.find_one({"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")
    updates: dict = {"updated_at": now_iso()}
    for field in ("title", "date", "time", "color", "description", "link", "location"):
        value = getattr(payload, field)
        if value is not None:
            updates[field] = value.strip() if isinstance(value, str) and field != "description" else value
    await db.calendar_events.update_one({"id": event_id}, {"$set": updates})
    doc = await db.calendar_events.find_one({"id": event_id}, {"_id": 0})
    return doc


@api.delete("/admin/calendar-events/{event_id}")
async def admin_delete_calendar_event(event_id: str, admin=Depends(require_admin)) -> dict:
    result = await db.calendar_events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


@api.get("/admin/calendar")
async def admin_get_calendar(admin=Depends(require_admin)) -> dict:
    open_orders = await db.orders.find(
        {"status": {"$nin": ["Closed", "Declined"]}, "deadline": {"$ne": None}},
        {"_id": 0, "id": 1, "client_name": 1, "commission_type": 1, "deadline": 1, "status": 1},
    ).to_list(500)

    today = datetime.now(timezone.utc).date()
    deadline_events = []
    for o in open_orders:
        try:
            due = datetime.fromisoformat(o["deadline"]).date()
        except (ValueError, TypeError):
            continue
        days_left = (due - today).days
        color = "#EF4444" if days_left < 0 else "#F59E0B" if days_left <= 5 else "#22C55E"
        deadline_events.append(
            {
                "id": f"deadline-{o['id']}",
                "type": "deadline",
                "order_id": o["id"],
                "title": f"{o['client_name']} — {o.get('commission_type') or 'Project'}",
                "date": o["deadline"],
                "time": None,
                "color": color,
                "description": f"Status: {o['status']}",
                "link": None,
                "location": None,
            }
        )

    custom_docs = await db.calendar_events.find({}, {"_id": 0}).to_list(1000)
    custom_events = [{**doc, "type": "custom"} for doc in custom_docs]

    return {"events": deadline_events + custom_events}


# ------------------------------------------------------------------ analytics
_PAYMENT_ACTIVITY_RE = re.compile(r"^(Deposit|Final|Full) payment confirmed via (\w+)$")


def _order_revenue_events(order: dict) -> List[dict]:
    """Derive real payment events from an order's activity log — the only
    place payment confirmations are actually recorded with a timestamp."""
    price = order.get("quoted_price")
    if not price:
        return []
    events = []
    for entry in order.get("activity", []):
        m = _PAYMENT_ACTIVITY_RE.match(entry.get("note", ""))
        if not m:
            continue
        kind, method = m.group(1), m.group(2)
        amount = float(price) if kind == "Full" else float(price) * 0.5
        events.append(
            {
                "at": entry["at"],
                "amount": amount,
                "method": method,
                "client_email": order.get("client_email"),
                "client_name": order.get("client_name"),
                "commission_type": order.get("commission_type") or "Other",
            }
        )
    return events


@api.get("/admin/analytics")
async def admin_get_analytics(admin=Depends(require_admin)) -> dict:
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    request_docs = await db.requests.find({}, {"_id": 0, "email": 1, "created_at": 1}).to_list(5000)

    revenue_events: List[dict] = []
    for o in orders:
        revenue_events.extend(_order_revenue_events(o))

    def month_key(iso_str: str) -> str:
        return iso_str[:7]

    revenue_by_month: dict = {}
    method_totals: dict = {}
    type_totals: dict = {}
    client_totals: dict = {}
    client_names: dict = {}
    for ev in revenue_events:
        k = month_key(ev["at"])
        revenue_by_month[k] = revenue_by_month.get(k, 0) + ev["amount"]
        method_totals[ev["method"]] = method_totals.get(ev["method"], 0) + ev["amount"]
        type_totals[ev["commission_type"]] = type_totals.get(ev["commission_type"], 0) + ev["amount"]
        client_totals[ev["client_email"]] = client_totals.get(ev["client_email"], 0) + ev["amount"]
        client_names[ev["client_email"]] = ev["client_name"]

    status_counts: dict = {}
    for o in orders:
        s = o.get("status", "Unknown")
        status_counts[s] = status_counts.get(s, 0) + 1

    turnaround_by_month: dict = {}
    for o in orders:
        created = o.get("created_at")
        if not created:
            continue
        delivered_at = None
        for entry in o.get("activity", []):
            if entry.get("note", "").startswith("Status → Delivered"):
                delivered_at = entry["at"]
                break
        if not delivered_at:
            continue
        try:
            days = (datetime.fromisoformat(delivered_at) - datetime.fromisoformat(created)).days
        except ValueError:
            continue
        turnaround_by_month.setdefault(month_key(delivered_at), []).append(days)

    first_seen: dict = {}
    for r in request_docs:
        email, created = r.get("email"), r.get("created_at")
        if not email or not created:
            continue
        if email not in first_seen or created < first_seen[email]:
            first_seen[email] = created
    new_clients_by_month: dict = {}
    for created in first_seen.values():
        k = month_key(created)
        new_clients_by_month[k] = new_clients_by_month.get(k, 0) + 1

    top_clients = sorted(
        (
            {"email": e, "name": client_names.get(e) or e, "revenue": round(v, 2)}
            for e, v in client_totals.items()
        ),
        key=lambda x: x["revenue"],
        reverse=True,
    )[:10]

    return {
        "total_revenue": round(sum(ev["amount"] for ev in revenue_events), 2),
        "revenue_by_month": [{"month": k, "revenue": round(v, 2)} for k, v in sorted(revenue_by_month.items())],
        "orders_by_status": [{"status": s, "count": c} for s, c in status_counts.items()],
        "payment_methods": [{"method": m, "amount": round(v, 2)} for m, v in method_totals.items()],
        "revenue_by_type": [{"type": t, "revenue": round(v, 2)} for t, v in type_totals.items()],
        "turnaround_trend": [
            {"month": k, "avg_days": round(sum(v) / len(v), 1)} for k, v in sorted(turnaround_by_month.items())
        ],
        "new_clients_trend": [{"month": k, "count": c} for k, c in sorted(new_clients_by_month.items())],
        "top_clients": top_clients,
    }


# ------------------------------------------------------------------ clients
@api.get("/admin/clients")
async def admin_list_clients(admin=Depends(require_admin)) -> List[dict]:
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    request_docs = await db.requests.find({}, {"_id": 0}).to_list(5000)
    email_log_docs = await db.email_log.find({}, {"_id": 0, "to": 1}).to_list(20000)

    emails_sent_count: dict = {}
    for e in email_log_docs:
        emails_sent_count[e["to"]] = emails_sent_count.get(e["to"], 0) + 1

    clients: dict = {}
    for r in request_docs:
        email = r.get("email")
        if not email:
            continue
        c = clients.setdefault(
            email,
            {"email": email, "name": r.get("name"), "first_seen": r["created_at"], "last_activity": r["created_at"], "order_count": 0, "lifetime_paid": 0.0},
        )
        if r["created_at"] < c["first_seen"]:
            c["first_seen"] = r["created_at"]
        if r["created_at"] > c["last_activity"]:
            c["last_activity"] = r["created_at"]

    for o in orders:
        email = o.get("client_email")
        if not email:
            continue
        c = clients.setdefault(
            email,
            {"email": email, "name": o.get("client_name"), "first_seen": o["created_at"], "last_activity": o["created_at"], "order_count": 0, "lifetime_paid": 0.0},
        )
        c["name"] = c["name"] or o.get("client_name")
        c["order_count"] += 1
        for ev in _order_revenue_events(o):
            c["lifetime_paid"] += ev["amount"]
        updated = o.get("updated_at") or o["created_at"]
        if updated > c["last_activity"]:
            c["last_activity"] = updated
        if o["created_at"] < c["first_seen"]:
            c["first_seen"] = o["created_at"]

    result = []
    for email, c in clients.items():
        c["lifetime_paid"] = round(c["lifetime_paid"], 2)
        c["emails_sent"] = emails_sent_count.get(email, 0)
        result.append(c)
    result.sort(key=lambda c: c["last_activity"], reverse=True)
    return result


@api.get("/admin/clients/{email}")
async def admin_get_client(email: str, admin=Depends(require_admin)) -> dict:
    email = email.lower()
    orders = await db.orders.find({"client_email": email}, {"_id": 0}).sort("created_at", -1).to_list(500)
    if not orders:
        req = await db.requests.find_one({"email": email}, {"_id": 0})
        if not req:
            raise HTTPException(404, "Client not found")

    order_ids = [o["id"] for o in orders]
    messages = await db.messages.find({"order_id": {"$in": order_ids}}, {"_id": 0}).sort("created_at", 1).to_list(2000) if order_ids else []
    request_docs = await db.requests.find({"email": email}, {"_id": 0}).sort("created_at", 1).to_list(100)
    email_log_docs = await db.email_log.find({"to": email}, {"_id": 0}).sort("sent_at", -1).to_list(500)
    note_doc = await db.client_notes.find_one({"email": email}, {"_id": 0})

    lifetime_paid = 0.0
    for o in orders:
        for ev in _order_revenue_events(o):
            lifetime_paid += ev["amount"]

    name = orders[0]["client_name"] if orders else (request_docs[0]["name"] if request_docs else email)
    first_seen = min([r["created_at"] for r in request_docs] + [o["created_at"] for o in orders], default=None)

    return {
        "email": email,
        "name": name,
        "first_seen": first_seen,
        "orders": orders,
        "requests": request_docs,
        "messages": messages,
        "email_log": email_log_docs,
        "lifetime_paid": round(lifetime_paid, 2),
        "notes": note_doc.get("notes") if note_doc else "",
        # null/missing per key = follow the global Settings toggle; true/false
        # explicitly overrides it for just this client.
        "notification_overrides": (note_doc.get("notification_overrides") if note_doc else None) or {},
    }


class ClientNotesIn(BaseModel):
    notes: str = Field(default="", max_length=5000)


@api.patch("/admin/clients/{email}/notes")
async def admin_update_client_notes(email: str, payload: ClientNotesIn, admin=Depends(require_admin)) -> dict:
    email = email.lower()
    await db.client_notes.update_one(
        {"email": email},
        {"$set": {"email": email, "notes": payload.notes.strip(), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "notes": payload.notes.strip()}


class ClientNotificationOverridesIn(BaseModel):
    notify_new_message: Optional[bool] = None
    notify_status_update: Optional[bool] = None
    notify_payment_request: Optional[bool] = None


@api.patch("/admin/clients/{email}/notification-overrides")
async def admin_update_client_notification_overrides(
    email: str, payload: ClientNotificationOverridesIn, admin=Depends(require_admin)
) -> dict:
    email = email.lower()
    # Sent as a full replacement of the three keys — a key set to null here
    # clears that override back to "follow the global setting" rather than
    # leaving a stale true/false behind.
    overrides = {
        "notify_new_message": payload.notify_new_message,
        "notify_status_update": payload.notify_status_update,
        "notify_payment_request": payload.notify_payment_request,
    }
    await db.client_notes.update_one(
        {"email": email},
        {"$set": {"email": email, "notification_overrides": overrides, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "notification_overrides": overrides}


# ------------------------------------------------------------------ mount
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
