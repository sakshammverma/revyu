# Revyu

> Compliant Google Review collection & customer engagement hub for single-outlet local businesses.

---

## Overview

**Revyu** is built for independent local business owners (dentists, cafes, salons, retail outlets) in India and global markets to turn offline customer visits into authentic Google reviews and repeat visits.

### Core Highlights

- **100% Policy Compliant**: Strict adherence to Google's anti-gating policies (CR-1 to CR-6). The option to leave a public Google review is always accessible at every rating level.
- **Frictionless Customer Journey**: Clean, lightweight mobile web flow (`/r/[slug]`) triggered via physical QR codes without requiring app installations or forced sign-ups.
- **Smart Draft Suggestions**: Generates customized draft review text from customer-selected tags to remove reviewer friction.
- **Private Feedback Loop**: Direct channel for constructive customer suggestions and private issue resolution.
- **Customer Hub**: Lightweight digital hub for menus, loyalty punch cards, and social/contact links.
- **Owner Dashboard & Analytics**: Real-time scan metrics, rating distributions, tag frequencies, and printable QR standees.

---

## Architecture & Tech Stack

- **Backend**:
  - Python 3.11+ / FastAPI
  - SQLAlchemy 2.0 (async engine) & PostgreSQL
  - Alembic for database migrations
  - APScheduler for background jobs & advisory lock management
  - Pytest with transactional rollback test fixtures
- **Frontend**:
  - Next.js 16 (App Router) & React 19
  - Tailwind CSS 4
  - Playwright for end-to-end compliance test suites
- **Documentation**:
  - Comprehensive PRD, SRS, compliance specifications, and data models in [`documents/`](documents/).

---

## Getting Started

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# Activate virtual environment:
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

pip install -e .[dev]
alembic upgrade head

# Seed initial plans and demo outlet
python -m app.seeds.plans
python -m app.seeds.dev_outlet

# Start backend server
uvicorn app.main:app --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on [http://localhost:3000](http://localhost:3000) and proxy `/api/*` requests to FastAPI on port 8000.

---

## Testing

- **Backend Tests**:
  ```bash
  cd backend
  pytest tests -q
  ```
- **Frontend E2E Tests**:
  ```bash
  cd frontend
  npm run test:e2e
  ```

---

## License

Proprietary - All rights reserved.
