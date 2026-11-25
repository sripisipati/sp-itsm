# ITSM

Enterprise IT service management application. Incident Management and Change Management share one React UI, one NestJS API, and one PostgreSQL database. Problem records are a short list used to link changes. Major Incident Management is still a coming-soon page.

## Stack

- Frontend: React 19, TypeScript, Vite, Material UI, React Router, TanStack Query, TanStack Table, React Hook Form, Zod, Axios
- Backend: NestJS 12, REST, Swagger, class-validator
- Database: PostgreSQL 16, Prisma 7
- Tests: Jest, React Testing Library, Playwright

## Local development

Requirements: Node.js 24 and PostgreSQL 16.

```bash
cp .env.example .env
createdb itsm
createdb itsm_test
psql -d postgres -c "CREATE ROLE itsm LOGIN PASSWORD 'itsm_dev_only' CREATEDB"
npm install
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173. API docs are at http://localhost:3000/api/docs. The Vite dev server proxies `/api` to the API.

Development accounts use the password `ChangeMe!Dev1`. These accounts are for local development only. The API refuses to start in production when `JWT_SECRET` still contains `dev-only`, and the seed script refuses to run when `NODE_ENV=production`.

| Email | Role |
| --- | --- |
| admin@itsm.local | ITSM Administrator |
| manager@itsm.local | Incident Manager |
| agent@itsm.local | Support Agent, Service Desk |
| agent.network@itsm.local | Support Agent, Network |
| agent.apps@itsm.local | Support Agent, Application Support |
| agent.desk@itsm.local | Support Agent, Service Desk |
| agent.infra@itsm.local | Support Agent, Network and Infrastructure |
| requester.finance@itsm.local | Requester |
| requester.hr@itsm.local | Requester |
| requester.sales@itsm.local | Requester |
| readonly@itsm.local | Read only |
| change.manager@itsm.local | Change Manager |
| requester@itsm.local | Change Requester |
| owner@itsm.local | Change Owner |
| tech.approver@itsm.local | Technical Approver |
| biz.approver@itsm.local | Business Approver |
| cab.member@itsm.local | CAB Member |
| implementer@itsm.local | Implementation Lead |
| auditor@itsm.local | Change Auditor |

The seed resets every local user's password to `ChangeMe!Dev1`. It refuses to run when `NODE_ENV=production` or when the database name is not `itsm` or `itsm_test`.

Nest is built with `tsc`. `@nestjs/cli` is not installed because its peer range wants TypeScript 6, and this repo pins TypeScript 5.9.3. Prisma 7 reads `database/prisma.config.ts`. The generated client is written to `backend/src/generated/prisma` and is not committed. Jest 30 on Node 24.2 cannot `require` Nest's ESM files directly, so backend tests transform `@nestjs` packages to CommonJS with `backend/test/esm-to-cjs.cjs`.

## Tests

```bash
npm run test:backend
npm run test:frontend
npm run test:e2e
```

Backend integration tests use the `itsm_test` database, migrate it, and reseed it. They do not write to the `itsm` development database. Playwright reuses the dev servers when they are already running. Install the browser once with `npm run install:browsers -w @itsm/e2e`, then run `npm run test:e2e`. The change lifecycle spec is `e2e/tests/change-lifecycle.spec.ts`. If Playwright's Chromium download is blocked, and Google Chrome is installed, run `PW_CHANNEL=chrome npm test -w @itsm/e2e -- tests/change-lifecycle.spec.ts`.

## Docker Compose

```bash
docker compose up --build
```

The UI is published on http://localhost:8080. Compose starts PostgreSQL, applies migrations, and seeds the development database because `SEED_ON_START=true` and `NODE_ENV=development`. Replace `JWT_SECRET` before any shared or production deployment, set `NODE_ENV=production`, and leave seeding off.

This workspace does not include the Docker CLI, so the compose file is provided for local use and was not executed here.

## Production build

```bash
npm run build
npm run db:migrate:deploy
NODE_ENV=production npm run start -w @itsm/backend
npm run preview -w @itsm/frontend
```

Set a unique `JWT_SECRET` of at least 16 characters. Do not commit `.env`.

## Scope of this release

Incident list, create, edit, detail, assignment, priority matrix, status transitions, work notes, additional comments, attachments, audit history, dashboard metrics, and role checks are implemented against the API. Ticket numbers are generated in the database.

Change Management list, dashboard, create, edit, detail, submit, assessment, approvals, schedule, implementation, close, tasks, tests, notes, PIR, CAB meetings, conflicts, and policy administration are implemented on the API. The UI covers the list, dashboard, create/edit, and the main detail actions. Calendar, CAB, policy administration, and attachment upload are available through the API and are not separate screens. Incident details list related changes. Closing a change does not close the incident.

Problem records can be listed and opened by id, including their related changes. There is no problem workflow. Major Incident Management navigation opens a coming-soon page.

Architecture notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The change module is described in [docs/CHANGE-MANAGEMENT.md](docs/CHANGE-MANAGEMENT.md).
