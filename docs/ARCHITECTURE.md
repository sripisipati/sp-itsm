# Architecture

The repository is a modular monolith with separate frontend and backend applications.

```
frontend/src/modules   feature UI (dashboard, incidents, changes, admin, coming-soon modules)
backend/src/modules    feature APIs (auth, users, incidents, changes, configuration, attachments)
database/prisma        schema, migrations, seed
```

Business rules live in backend services and `backend/src/modules/incidents/domain`. React components call the API. Controllers validate DTOs and delegate.

## Incident lifecycle

Statuses: New, Assigned, In Progress, On Hold, Resolved, Closed, Cancelled.

Allowed transitions are rows in `status_transitions`. The API rejects a change that is missing from that table or that the caller's role cannot perform. Closed and Cancelled are terminal. Reopening a resolved incident moves it back to In Progress, clears the resolver, and writes a `REOPENED` history row.

Resolution requires a resolution code and notes of at least 5 characters. Save does not change status unless the client sends a different status on edit. Creating an incident starts as Assigned when a group or assignee is supplied, otherwise New.

## Ticket numbers

`ticket_sequences` stores the next number per prefix. Creation locks the row with `UPDATE ... RETURNING`, then formats `INC` plus a zero-padded sequence (`INC0001001`). The prefix and pad length come from `app_settings`.

## Priority

`priority_matrix` maps impact and urgency to P1–P4. The API calculates priority. The form displays `GET /api/v1/configuration/priority` and does not accept a client-supplied priority.

## Access

Roles: ITSM Administrator, Incident Manager, Support Agent, Requester, Read Only.

Administrators, managers, and read-only users can see every incident. Agents see incidents assigned to them, owned by their groups, or created by or for them. Requesters see incidents they created or called. A hidden incident returns 404.

Work notes are omitted from note lists, incident detail, and history for requester-only users. History stores the note type, not the note body.

Authentication is a JWT bearer token. Local passwords are bcrypt hashes. Login rate limiting is in memory and is disabled when `NODE_ENV=test`.

## API

Incident collection: `GET /api/v1/incidents` with page, pageSize, search, sort, and one filter per column. Sorting fields are whitelisted. The response envelope is `{ data, pagination: { page, pageSize, totalRecords, totalPages } }`.

Other incident routes: summary, export, get, create, patch, status, assign, notes, history, attachments. Reference data is under users, assignment-groups, categories, configuration-items, business-services, and configuration.

Swagger is served at `/api/docs`. Health is `GET /api/v1/health`. Every response can carry `x-correlation-id`. Prisma unique conflicts become 409 and missing rows become 404. Database error text is not returned to the client.

## Files

Attachment bytes are stored on the local filesystem (`STORAGE_DIR`). Metadata is in `incident_attachments`. Uploads are limited to 10 MB and to pdf, png, jpeg, txt, csv, json, and docx, checked against magic bytes. Download requires the bearer token.

## Optimistic concurrency

Each incident has a `version`. Updates include that version. A mismatched version returns 409.

## Change Management

Change state, risk, approval, rollback, and PIR rules are rows in the database. Services in `backend/src/modules/changes` enforce them. The UI displays the API result. See [CHANGE-MANAGEMENT.md](CHANGE-MANAGEMENT.md).

Incident detail includes `relatedChanges`. Change workflow never updates the incident status.

## Other modules

Major Incident Management is a coming-soon page. Problems are a minimal record (`number`, short description, state) with `GET /api/v1/problems` and `GET /api/v1/problems/:id`.
