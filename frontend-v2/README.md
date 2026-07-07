# Frontend v2

Dark, compact Next.js dashboard for the FastAPI personal finance backend.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

The proxy expects FastAPI at `http://127.0.0.1:8000` by default. To use another backend URL:

```bash
FASTAPI_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Backend startup from the repository root:

```bash
cd backend/app
fastapi dev app.py
```

## Pages

- `/`: monthly dashboard for spend against budgets and uncategorized transactions.
- `/transactions`: detailed transaction review with filters and category assignment.
- `/balances`: account balances from `GET /balance`.
- `/categories`: category and monthly budget CRUD.
