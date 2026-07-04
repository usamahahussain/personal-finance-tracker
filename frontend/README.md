# Frontend

Next.js frontend for the FastAPI personal finance backend.

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

## Pages

- `/` and `/transactions`: full transaction table using every field returned by `GET /transactions`.
- `/balances`: account balances from `GET /balance`.
- `/categories`: category create, edit, and delete workflows.
- `/api-status`: backend health checks and route response diagnostics.

## Surfaced backend data

- `GET /database`: database connectivity status.
- `GET /balance`: all account balances.
- `GET /transactions`: all transactions.
- `POST /refresh`: Lunchflow transaction refresh.
- `GET /categories`: category list.
- `POST /categories`: create a category.
- `PUT /categories/{category_id}`: update `category_name` and `budget`.
- `DELETE /categories/{category_id}`: delete a category.
