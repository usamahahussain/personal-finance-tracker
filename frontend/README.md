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

- `GET /database`: database connectivity status.
- `GET /balance`: all account balances.
- `GET /balance/{account_id}`: one account balance by account id.
- `POST /refresh`: Lunchflow transaction payload.
- `GET /categories`: category list.
- `PUT /categories/{category_id}`: update `category_name` and `budget`.
- `DELETE /categories/{category_id}`: delete a category.

The dashboard mirrors the routes currently exposed by `backend/app/app.py`. Category creation is not shown because the backend does not currently expose `POST /categories`.
