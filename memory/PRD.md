# VANCE — Product Requirements Document

## Original problem statement
Solo designer's commission platform (VANCE). Public marketing site + admin dashboard + client portal. Slot-based commissions, mandatory review to close orders, auto-generated showcase portfolio from delivered work.

**Design system**: Poppins/Lora typography, warm off-white (#F7F5F2) background, charcoal ink (#1A1A1A), orange accent (#FF6B35), pill buttons, 12/24/999px radii, gradient-tile feature icons (5 uploaded PNGs — 4 more pending), DesignJoy-style layout with generous whitespace, restrained motion (fade-up on scroll, subtle hover only).

**Stack**: React 19 + FastAPI + Mongo + Emergent Object Storage. Real-time will use native FastAPI WebSockets (Phase 6). Emergent LLM Key not needed (no AI features). Auth: JWT for admin (single user), magic-link for clients (Phase 6).

## User personas
- **Vance (admin)**: sole designer; needs an inbox for requests, a task board, orders, messages, analytics; wants the portfolio to update itself when a project closes.
- **Prospective client (public visitor)**: sees the site, submits a commission request.
- **Active client (portal user)**: paid a deposit, logs in via magic-link to see order status, message Vance, upload references, receive files, submit a mandatory review.

## Core requirements (static — don't change unless user says so)
- Canonical 10-state order status list (single source of truth across UI).
- 50% deposit / 50% on delivery across Stripe, Interac, and Robux.
- Mandatory review before an order can reach "Closed."
- Auto-generated showcase case studies (watermark, mockups w/ perspective warp, typography specimen, pattern tile, etc.).
- On-brand 404 for all surfaces (public, admin, portal).
- Passwordless magic-link for client portal; single-admin JWT for staff.
- No password self-serve reset — intentional out of scope.

---

## ✅ Implemented (Phase 1 + 2 — 2026-02-16)

### Backend (`/app/backend/server.py`)
- Health check, public settings (open_slots seeded to 3), testimonials + portfolio listing (empty until Phase 5 populates them).
- Commission request create + count endpoints (writes to Mongo `requests` with canonical status `New`).
- Reference-image upload via Emergent Object Storage (10MB image cap, extension validation, file DB record with soft-delete flag).
- File download endpoint (public — matches request-form purpose).
- Admin JWT login (single admin, env-driven credentials, constant-time compare).
- `GET /api/auth/me` for token verification.
- Auto-seeded settings singleton on first startup.

### Frontend
- Full design system in Tailwind + CSS (Poppins Bold headlines, Lora italic accent, `#FF6B35` primary, pill buttons, 24px feature tiles).
- 8-section homepage: Hero (with mascot + slot indicator + dashed pull-quote), Portfolio (bento grid + filter tabs), Services (5 gradient feature tiles + services/pricing list), How It Works (4-step timeline), Testimonials (empty-state), FAQ (accordion), Commission Form (name/email/type/desc/budget/refs), Footer.
- Terms + Privacy pages with dynamic `Last updated` date from settings.
- On-brand 404 page (mascot, orange accent, home/work buttons).
- Staff login page (JWT stored in `localStorage`).
- Client Portal login page (magic-link scaffold — real send in Phase 6).
- Sonner toasts, reveal-on-scroll animation with `prefers-reduced-motion` guard.
- Responsive navbar (sticky glass-blur, mobile menu).
- `data-testid` on every interactive + surface element.

### Tests (from testing subagent, iteration 1)
- 16/16 backend pytest cases pass.
- All frontend flows verified: home render, portfolio filters, FAQ expand, commission form submit → success, terms/privacy, 404, staff login (success + failure), client portal scaffold, mobile menu.

---

## 🟡 Deferred / next up (in doc order — build phases)

### Phase 3 — Internal Dashboard (`/admin`)
- Sidebar-nav shell, 9 sections (Dashboard, Requests inbox, Orders/Clients, Messages, Task Board, Calendar, Templates, Analytics, Settings).
- Requests inbox: Gmail-style, Accept/Decline actions, unread badge.
- Orders: activity log, revision counter, Showcase-Safe toggle, mandatory-review-to-close.
- Task Board: kanban across statuses In Queue → Delivered.
- Templates (canned messages), Analytics (revenue MTD, accept/decline rate).
- Settings: slot count, SMTP, watermark opacity/size, portfolio tags.

### Phase 4 — Payments
- Stripe (embedded Payment Element, NOT redirect), two Payment Intents (deposit + final), webhook handlers for `payment_intent.succeeded` / `payment_intent.payment_failed`.
- Interac e-Transfer (self-declared Canada checkbox, manual admin mark-paid).
- Robux (existing Discord webhook, manual admin match; USD→Robux ~80/$ rate w/ disclaimer).

### Phase 5 — Showcase Automation
- Watermarking (Sharp/Pillow), color-variant generation, flat + angled (OpenCV perspective warp) mockup placement.
- Mockup template metadata (background/logo color reqs, placement zones).
- Fallback filtering, Preview-before-publish flow (paste hex codes, write rationale, upload social banner, assign tags).

### Phase 6 — Client Portal, Messages, Real-Time
- Client portal (magic-link auth, order detail view, status bar, files, review submission).
- Messages (markdown, attachments, unread badges, real-time sync).
- Platform-wide FastAPI WebSockets for live updates (Messages, order status, Task Board, Dashboard stats).

### Phase 1 asset polish
- Batch 2 gradient icon PNGs (lightning, star, grid, board) — currently substituted with CSS-gradient tiles + lucide icons that match the uploaded lock tile's aesthetic. Swap in real assets when uploaded.

### Nice-to-haves flagged during code review
- Migrate `@app.on_event` → lifespan context.
- Hash `ADMIN_PASSWORD` with bcrypt (passlib already installed).
- Async httpx for storage calls (currently blocking `requests`).
- Move admin JWT to httpOnly cookie for XSS resistance.

---

## ✅ Iteration 2 (2026-02-16 — later same day)

### Design overhaul
- New **Numbers** section (solid `#1A1A1A` bg) between Services and Process — big-stat "By the numbers · A studio built for momentum" callout, matches the strategic-black rhythm the user requested.
- **Footer** switched to black bg (`#1A1A1A`) with white/orange text; the uploaded smiley mascot peeks from the bottom-right corner; adds a big "Let's build the brand you actually want" CTA row.
- **Services / feature tiles** — Batch 2 icons (lightning/star/grid/board PNGs) integrated; icons roughly doubled in size (128–160px). Grid is asymmetric: one wide highlight tile + one tall + three regulars.
- **Pricing** cards — no longer uniform white rectangles: one dark "Most Requested" card w/ orange CTA, one standard, one numbered "02", one dashed-border "Something else?" card.
- **FAQ** — replaced shadcn accordion cards with a numbered hairline-divider list style + plus/minus circle toggle + a dashed pull-quote in the left column. Reads long-form, not templated.
- **Hero mascot** scaled 1.25× on md+ breakpoints per user note.
- **Smooth momentum scroll** via Lenis, with `prefers-reduced-motion` opt-out.

### Phase 3 — Internal Dashboard
- Sidebar-nav layout (9 numbered sections) + sticky admin header w/ time-of-day greeting + auth guard (redirects to `/staff/login` if no token).
- **Dashboard home**: 4 stat tiles + Recent Requests feed + black Quick Actions card.
- **Requests inbox**: Gmail-style list + detail; **Accept auto-creates an Order** and updates status per canonical list; Decline stores optional reason.
- **Orders**: filterable table across all canonical statuses, semantic status pills.
- **Task Board**: 5-column kanban (In Queue → Del. Awaiting Review) with arrow-based advance/back (no DnD yet — deferred to next iteration).
- **Settings**: open_slots, total_slots, and portfolio_tags editors — writes back to singleton doc, updates `last_content_updated` so the public Terms/Privacy dates roll.
- **Messages / Calendar / Templates / Analytics**: on-brand placeholder cards showing which phase each will ship in.

### Tests (iteration 2)
- 25/25 backend pytest pass (16 prior + 9 new admin).
- Frontend flows verified end-to-end via testing subagent, including auth guard, request-accept → order-created, task-board advance, settings save, dashboard stats.

### Fresh deferrals
- Task Board drag-and-drop (currently arrow-nav — mentioned in the section copy).
- Order detail page (Orders list is view-only for now; deep-dive activity log + revision counter ships alongside Messages in Phase 6).
- Race-condition-safe `$push` for order activity log (currently full-array `$set`) — noted from code review.
