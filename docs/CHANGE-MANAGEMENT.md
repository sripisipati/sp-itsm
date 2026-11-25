# Change Management

Change Management is a module on the same ITSM application as Incident Management. It uses the shared users, roles, assignment groups, configuration items, business services, attachment storage, and in-app notifications. Completing a change does not change the linked incident.

## Records

A change number is allocated on the server from `ticket_sequences` (`UPDATE ... RETURNING`) and formatted as `CHG` plus seven digits (`CHG0001001`). The prefix is the sequence row, not a value typed in the form. Tasks use `CTASK`, CAB meetings use `CAB`, and the minimal problem records use `PRB`.

States: Draft, Submitted, Assessment, Pending Approval, Approved, Scheduled, Implementing, Implemented, Failed, Rejected, Deferred, Cancelled, Pending Review, Closed. Allowed moves are rows in `change_state_rules`. A missing rule is rejected. Closed and Cancelled are not hard-deleted.

Normal path: Draft → Submitted → Assessment → Pending Approval → Approved → Scheduled → Implementing → Implemented → Pending Review → Closed.

Other paths: Pending Approval → Rejected; Approved → Deferred; Draft or Submitted → Cancelled; Implementing → Failed; Failed → Pending Review after a required rollback is recorded; Implemented → Pending Review → Closed.

Guards stored on the rule:

| Guard | Meaning |
| --- | --- |
| APPROVALS_COMPLETE | Every required approval is approved |
| HAS_REJECTION | At least one approval is rejected |
| HAS_WINDOW | Planned start and end are set |
| IMPLEMENT_WINDOW | Now is inside the window, or an authorized role supplied an override justification |
| OUTCOME_SUCCESS / OUTCOME_FAILURE | Implementation outcome is present |
| ROLLBACK_IF_REQUIRED | A required backout was executed or the type/risk does not require one |
| CLOSE_READY | Outcome is recorded and a required PIR has a result |

Standard and emergency type policies skip the assessment state. Submit then creates approvals and moves to Pending Approval, or to Approved when the matched policy has no steps. One submit action increments `version` once even when it writes two states. A stale version returns 409.

## Risk and priority

`POST /api/v1/changes/preview-classification` and change create/update call `ChangeRiskService`. Weights, factor scores, user bands, and level thresholds come from `risk_engine_configs` and related tables. A missing default config is an error. The UI shows the returned level and summary. It does not calculate risk itself.

Priority comes from `change_priority_matrix` (impact × urgency → CRITICAL, HIGH, MODERATE, LOW, PLANNING). That table is separate from the incident P1–P4 matrix. Rollback and PIR requirements come from `rollback_requirements` and `change_type_policies`.

## Approvals

Active `approval_policies` for the change type are filtered by risk rank. The policy with the highest minimum risk that still matches wins. Steps can be sequential or parallel. A sequential step stays blocked while an earlier step is pending or waiting for information.

Decisions: approve, reject, request more information, delegate. The requester cannot approve their own change unless both the type policy and the approval policy set `allowSelfApproval`. An administrator does not bypass that rule. The last approval moves the change to Approved inside the same transaction. A rejection sets Rejected. `POST /api/v1/approvals/escalate` notifies change managers about overdue pending approvals. There is no background poller.

## Scheduling

`GET /api/v1/changes/conflicts` reports overlapping Approved, Scheduled, or Implementing changes on the same configuration item or business service, and matching blackout periods. An empty CI and service produces no change-to-change conflict. A time outside a maintenance window is a warning. Scheduling over a conflict requires a justification and a role listed in `change.scheduleOverrideRoles` (ITSM Administrator or Change Manager in the seed). The override is written to history.

## CAB and problems

`/api/v1/cab/meetings` creates a meeting, lists it, and records a decision. A CAB approve or reject also decides a pending CAB approval on the linked change when one exists. A change can appear on more than one meeting.

`/api/v1/problems` lists and reads a minimal problem (number, short description, state) and its related changes. There is no problem workflow product.

## Notes, files, and audit

Work notes are returned only to users who hold an operational role (administrator, change manager, owner, approver, CAB member, implementation lead, auditor, incident manager, or support agent). Requesters and read-only users do not receive them and cannot create them. Auditors can read history and work notes. They cannot edit.

Attachments reuse the local filesystem storage adapter. The API checks authentication, MIME type, and size. Email and Teams are not sent.

History rows record the action, field, old value, new value, user, and time. The same facts are copied to `audit_logs` for change entities.

## API

Collection responses use `{ data, pagination: { page, pageSize, totalRecords, totalPages } }`.

- `GET/POST /api/v1/changes`
- `GET /api/v1/changes/summary`
- `GET /api/v1/changes/calendar`
- `GET /api/v1/changes/conflicts`
- `GET /api/v1/changes/export`
- `POST /api/v1/changes/preview-classification`
- `GET/PATCH /api/v1/changes/:id`
- `PATCH /api/v1/changes/:id/state`
- `POST /api/v1/changes/:id/submit`
- `POST /api/v1/changes/:id/assess`
- `POST /api/v1/changes/:id/assign`
- `GET/POST /api/v1/changes/:id/approvals`
- `POST /api/v1/changes/:id/approvals/:approvalId/decision`
- `GET /api/v1/changes/:id/history`
- `GET/POST /api/v1/changes/:id/tasks` and `PATCH .../tasks/:taskId`
- `GET/POST /api/v1/changes/:id/test-cases`
- `GET/POST /api/v1/changes/:id/notes`
- `POST /api/v1/changes/:id/pir`
- `GET/POST /api/v1/changes/:id/attachments`
- `GET/POST /api/v1/cab/meetings`, `GET /api/v1/cab/meetings/:id`, `POST /api/v1/cab/meetings/:id/decisions`
- `GET /api/v1/change-categories`
- `GET/POST /api/v1/approval-policies` and `POST /api/v1/approval-policies/:id/steps`
- `GET/PATCH /api/v1/risk-engine`
- `GET/POST /api/v1/change-state-rules` and `PATCH /api/v1/change-state-rules/:id`
- `POST /api/v1/approvals/escalate`

List filters: `search`, `number`, `shortDescription`, `type`, `categoryId`, `riskLevel`, `impact`, `priority`, `requestedById`, `assignedToId`, `assignmentGroupId`, `approvalStatus`, `state`, `plannedStartFrom`, `plannedStartTo`, `plannedEndFrom`, `plannedEndTo`, `createdById`, `createdFrom`, `createdTo`, `updatedById`, `updatedFrom`, `updatedTo`, `sortBy`, `sortOrder`, `page`, `pageSize`, `view` (`all`, `mine`, `pending_approvals`, `scheduled`, `emergency`, `closed`). A date-only upper bound includes the whole UTC day. Sort fields are whitelisted. CSV export is capped at 5,000 rows.

## Roles

ITSM Administrator, Change Manager, Change Requester, Change Owner, Technical Approver, Business Approver, CAB Member, Implementation Lead, Change Auditor, and Read Only. Mutating routes and the service both check the role. Read-only users and auditors cannot create, approve, schedule, implement, or close.

## What the UI covers

The change list has the heading, subtitle, Add Change, Export, and Refresh, dashboard cards, status/type/risk/group/month/outcome charts, recent and upcoming tables, server filters under each column, search, pagination, and CSV export. Create and edit cover the main description, type, impact, probability, window, and backout fields, with an unsaved-change warning. Detail shows risk text, workflow buttons, approvals, tasks, notes, and PIR when present.

These parts are API-backed and not separate screens: calendar, CAB meetings, approval-policy administration, attachment upload, the full task and test-case editors, and user autocomplete on the list filters. People filters accept a user id. State accepts a comma-separated list.
