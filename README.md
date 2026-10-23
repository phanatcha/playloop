# PlayLoop

Reciprocal playtesting platform for indie game developers.

The API is an Express server. Local MongoDB and file storage run in Docker. The client app is not part of this setup.

## Requirements

- Node.js 22 or newer (`nvm use` reads `.nvmrc`)
- Docker Desktop, running

## Run

From the repo root:

```sh
npm install
copy server\.env.example server\.env
npm run services:up
npm run dev
```

On macOS or Linux, copy the env file with `cp server/.env.example server/.env`.

`services:up` starts MongoDB on port 27017 (replica set `rs0`) and local S3-compatible storage on port 9000, then creates the media, builds, and play buckets. `dev` starts the API with `server/.env` and restarts it when server files change.

| URL | What it is |
| --- | --- |
| http://localhost:4000 | API |
| http://localhost:4000/api/docs | Swagger UI |
| http://localhost:4000/api/docs/openapi.json | OpenAPI document |
| http://localhost:4000/api/health | `{ "status": "ok", "db": "connected" }` when MongoDB is up |

Swagger UI is served only when `NODE_ENV` is not `production`. The example env file sets `development`.

Stop the API with Ctrl+C. Stop the containers with:

```sh
npm run services:down
```

Run the server tests with `npm test`.

## API

The contract is `docs/api/openapi.yaml`. Request and response bodies are checked against it outside production. Check the spec with `npm run spec:lint`.

- Base path is `/api`. Paths in the docs are relative to that, so `POST /auth/login` is `POST http://localhost:4000/api/auth/login`.
- `POST /api/auth/register` and `POST /api/auth/login` set an httpOnly cookie named `playloop_token` (7 days). Send later requests with credentials. Swagger UI keeps that cookie in the browser. From another client, store the cookie and send it back.
- Login accepts an email or a username in the `email` field. A wrong email, username, or password returns `401`. A banned or suspended account returns `403`.
- Logged-out calls to protected routes return `401`. Doing someone else's action returns `403`.
- Errors are `{ "code", "message", "details?" }`. `details` is only present for `VALIDATION_ERROR`.
- Lists take `page` (from 1) and `limit` (max 50) and return `{ "items", "page", "limit", "total" }`.
- Uploads go to storage, not through the API body: `POST /api/uploads`, PUT the file to the returned URL, then `POST /api/uploads/{uploadId}/complete`.
- Rate limits return `429` with code `RATE_LIMITED`.
- Payments are not in this version.

In PowerShell, call `curl.exe` so the commands below are not handled by `Invoke-WebRequest`.

```sh
curl.exe http://localhost:4000/api/health
curl.exe -c cookies.txt -H "Content-Type: application/json" -d "{\"username\":\"ada\",\"email\":\"ada@example.com\",\"password\":\"password123\",\"acceptTerms\":true}" http://localhost:4000/api/auth/register
curl.exe -b cookies.txt http://localhost:4000/api/me
```
