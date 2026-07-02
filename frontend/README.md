# Frontend

Next.js dashboard for the FastAPI personal finance backend.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

The frontend proxy expects FastAPI at `http://127.0.0.1:8000` by default. To use another backend URL:

```bash
FASTAPI_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Backend startup from the repository root:

```bash
cd backend/app
fastapi dev app.py
```

## Surfaced backend data

- `GET /balance`: account balances by institution.
- `GET /database`: database connectivity status.
- `POST /refresh`: Lunchflow transaction payload preview.

The schema already includes transactions, merchants, categories, and recurring obligations. Those are represented in the dashboard as backend coverage until FastAPI exposes dedicated read endpoints for them.
