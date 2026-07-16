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
    # TODO(Phase 3.5): dispatch "Request Accepted" email via Nodemailer/SMTP.
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


# ------------------------------------------------------------------ mount
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
