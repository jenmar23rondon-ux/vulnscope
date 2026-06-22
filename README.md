# VulnScope

VulnScope is a professional vulnerability analysis platform built as a backend and cybersecurity portfolio project.

It is more than a simple port scanner: it combines target scanning, service detection, CVE-style mapping, risk scoring, scan history and report exports inside a full-stack dashboard.

## Features

- JWT authentication with a default admin user
- Vulnerability scan creation
- TCP port scanning for selected targets
- Service detection for common ports
- CVE-style lookup engine with curated demo mappings
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
| Security | JWT, TCP scanning, service detection, CVE-style lookup, risk scoring |
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
| GET | `/vulnerabilities` | List detected vulnerabilities |
| GET | `/dashboard` | Return dashboard metrics |
| GET | `/reports/scans.csv` | Export scan data as CSV |
| GET | `/reports/scans.pdf` | Export scan data as PDF |

## Safe Usage

Use VulnScope only against systems you own or have explicit permission to test.

The CVE engine uses curated demo mappings for portfolio purposes. It is designed to demonstrate backend architecture, security workflows and reporting, not to replace enterprise vulnerability scanners.

## Roadmap

- Real Nmap integration
- Public CVE API integration
- Scheduled scans
- Role-based access control
- Background scan jobs
- Report storage
- Cloud deployment
