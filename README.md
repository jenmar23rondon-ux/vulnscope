# VulnScope

VulnScope is a professional vulnerability analysis platform built as a backend and cybersecurity portfolio project.

It is more than a simple port scanner: it combines target scanning, service detection, CVE-style mapping, risk scoring, scan history and report exports inside a full-stack dashboard.

## Features

- JWT authentication with a default admin user
- Role-based access control for analyst/admin scan actions
- Vulnerability scan creation
- Background scan jobs with queued/running/completed states
- Scheduled scan records for recurring analysis workflows
- TCP port scanning for selected targets
- Optional Nmap integration with socket-scanner fallback
- Service detection for common ports
- CVE-style lookup engine with curated demo mappings and optional NVD lookup
- Risk score calculation
- PostgreSQL persistence with SQLAlchemy
- Scan history and dashboard metrics
- Vulnerability listing by severity
- PDF and CSV report exports
- Docker Compose environment
- GitHub Actions CI for backend and frontend validation

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Recharts, Vite |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | PostgreSQL |
| Security | JWT, RBAC, TCP scanning, optional Nmap, service detection, CVE-style lookup, risk scoring |
| DevOps | Docker, Docker Compose, GitHub Actions |

## Architecture

```text
User
  |
  v
React Dashboard
  |
  v
FastAPI Backend
  |-- Scanner
  |-- Service Detector
  |-- CVE Engine
  |-- Risk Calculator
  |-- Report Engine
  |
  v
PostgreSQL
```

## Project Structure

```text
vulnscope/
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- services/
|   |   |-- models/
|   |   |-- database/
|   |   |-- utils/
|   |   `-- main.py
|   |-- Dockerfile
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |-- Dockerfile
|   `-- package.json
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|-- docker-compose.yml
|-- README.md
`-- .gitignore
```

## Run with Docker

```bash
docker compose up --build
```

Open the app:

```text
http://localhost:5174
```

API documentation:

```text
http://localhost:8001/docs
```

Default credentials:

```text
Email: admin@vulnscope.local
Password: Admin1234
```

## Run Locally

### Backend

```bash
cd backend
py -3 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Useful API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/login` | Authenticate and return a JWT |
| POST | `/scans` | Create a vulnerability scan |
| GET | `/scans` | List scan history |
| POST | `/scans/scheduled` | Create a scheduled scan record |
| GET | `/scans/scheduled` | List scheduled scans |
| GET | `/vulnerabilities` | List detected vulnerabilities |
| GET | `/dashboard` | Return dashboard metrics |
| GET | `/reports/scans.csv` | Export scan data as CSV |
| GET | `/reports/scans.pdf` | Export scan data as PDF |

## Safe Usage

Use VulnScope only against systems you own or have explicit permission to test.

The CVE engine uses curated demo mappings for portfolio purposes. It is designed to demonstrate backend architecture, security workflows and reporting, not to replace enterprise vulnerability scanners.

## Railway / Vercel Deployment

This project is also ready for split deployment:

| Service | Platform | Root directory |
| --- | --- | --- |
| Backend API | Railway | `backend` |
| Frontend | Vercel or Railway | `frontend` |

Backend variables:

```env
DATABASE_URL=<Railway PostgreSQL URL>
JWT_SECRET=<long-random-secret>
FRONTEND_ORIGIN=<frontend-url>
USE_NMAP=false
ENABLE_LIVE_CVE_LOOKUP=false
```

Frontend variable:

```env
VITE_API_URL=<backend-api-url>
```

Use `USE_NMAP=false` in cloud environments unless the container image includes
Nmap and the platform allows the scan mode you need.

## Roadmap

- Advanced scan scheduler worker
- Authenticated user management screen
- Report storage
- Cloud deployment hardening
