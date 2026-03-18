---
description: Validate a partner integration against Thanx API documentation using DataDog sandbox traces and logs, then generate a certification report.
---

# Certify Partner Integration

Validate a partner's API integration by pulling their actual API calls from DataDog
sandbox and checking each one against the official Thanx documentation. The user
provides the partner context, credentials or merchant handle, and the endpoints
under review. The command finds real requests in DataDog, verifies headers, payloads,
and field mappings against thanx-docs MCP, and generates a certification report with
PASS/FAIL per check and remediation steps.

## How This Command Works

There are three ways to invoke this command:

1. **No arguments** (`/ds:certify`) — Prints a ready-to-fill intake template with
   all fields explained. Fill it in and re-run.
2. **Partial arguments** — Shows a checklist of what's present vs missing. Fill in
   the gaps and re-run.
3. **Complete intake** — Proceeds through the full certification pipeline:
   gather context → pull DataDog calls → fetch docs → validate → report → draft email.

### Integration Types and DataDog Strategy

The integration type determines how we find the partner's calls in DataDog:

| Integration Type | DataDog Search Strategy | Required Credentials |
|---|---|---|
| **Partner API** (subscriber ingestion, campaign/reward issuance) | Search **logs** by bearer token or client ID in request headers | Access Token + Client ID |
| **POS / Kiosk** (basket lifecycle, provider tickets) | Search **spans** by `@merchant.handle`, then **logs** for params | Merchant Handle |
| **Consumer UX / Custom App** (SSO, rewards, loyalty) | Search **logs** by bearer token or client ID | Access Token + Client ID |
| **Native Ordering** (Olo, menu sync) | Search **spans** by `@merchant.handle` | Merchant Handle |

## Usage

```bash
/ds:certify <structured_intake>
```

### Structured Intake Format

```text
Partner:          [name — or Front/Jira URL for context]
Integration type: [Subscriber Ingestion / POS-Kiosk / Loyalty API / Consumer UX / Native Ordering / Campaign-Reward Issuance]
Merchant:         [merchant handle for POS/Ordering, or merchant_id for Partner API]
Endpoints:        [comma-separated list, e.g. POST /partner/subscribers]
Access Token:     [bearer token — for Partner API / Consumer UX integrations]
Client ID:        [X-ClientId value — for Partner API / Consumer UX integrations]
Front thread:     [optional — DEV-XXXX or cnv_* for conversation context]
```

**Which credentials do I need?**
- **Partner API / Consumer UX**: Access Token + Client ID (these appear in DataDog
  log headers as `Authorization: Bearer {token}` and `X-Clientid: {id}`)
- **POS / Kiosk / Native Ordering**: Merchant Handle (DataDog spans store the
  resolved handle in `@merchant.handle`, not raw API keys)
- **Not sure?** Provide whatever you have — the command will tell you if it needs
  something different.

**Session history note:** Credentials passed as inline arguments may be visible
in Claude session history, terminal scrollback, or screen recordings. For sensitive
credentials, consider providing them via a file reference (e.g., `cat .context/creds.txt`).

**Optional (inline flags):**
- `--type <integration_type>` — Override integration type detection
- `--recheck <path>` — Re-certification mode: provide the path to a prior
  certification report (e.g., `.context/certifications/partner-2026-03-01.md`).
  Validates only previously failed items plus a sanity check on passed items.
- `--days <N>` — How many days back to search DataDog (default: 7, max: 30)

---

You are executing the `/ds:certify` command.

## Step 0: Validate Intake

Arguments: $ARGUMENTS

### If no arguments provided:

Print the intake template and stop:

```text
CERTIFICATION INTAKE
════════════════════
To run a certification, provide the following information:

Partner:          [partner name or Front/Jira URL]
Integration type: [one of the types below]
Merchant:         [merchant handle or merchant_id — see below]
Endpoints:        [comma-separated API endpoints to certify]
Access Token:     [bearer token — Partner API / Consumer UX only]
Client ID:        [X-ClientId — Partner API / Consumer UX only]
Front thread:     [optional — DEV-XXXX or cnv_* ID]

INTEGRATION TYPES
─────────────────
- Subscriber Ingestion    → POST /partner/subscribers
- POS-Kiosk               → basket lifecycle (checkout/billed/completed)
- Loyalty API             → purchases, rewards, user auth
- Consumer UX             → SSO, reward exchange, card linkage
- Native Ordering         → order creation, menu sync
- Campaign-Reward Issuance → campaign creation, reward issuance jobs

WHICH CREDENTIALS?
──────────────────
Partner API / Consumer UX:  Access Token + Client ID
  → Found in DataDog logs as Authorization + X-Clientid headers
POS / Kiosk / Ordering:     Merchant Handle
  → Found in DataDog spans as @merchant.handle

EXAMPLE
───────
/ds:certify
Partner:          Altos Agency (Kelly's Roast Beef)
Integration type: Subscriber Ingestion
Merchant:         wqv1y7qrh9jd0e6
Endpoints:        POST /partner/subscribers
Access Token:     [token from partner credentials]
Client ID:        [client_id from partner credentials]
Front thread:     DEV-9095
```

Do NOT proceed with certification. Wait for the user to provide the intake.

### If partial arguments provided:

Parse what was given and show a checklist:

```text
INTAKE CHECKLIST
────────────────
[✓] Partner:          [parsed value]
[✓] Integration type: [parsed or inferred value]
[ ] Merchant:         [missing — needed for DataDog filtering]
[✓] Endpoints:        [parsed value]
[ ] Access Token:     [missing — needed for Partner API log search]
[ ] Client ID:        [missing — needed for Partner API log search]

Please provide the missing fields to proceed.
```

Do NOT proceed with certification until all required fields for the integration
type are present.

### If complete intake provided:

Proceed to Step 1.

## Step 1: Gather Partner Context

Arguments: $ARGUMENTS (validated in Step 0)

Determine the partner and collect integration context:

| Input Type | How to Parse |
|---|---|
| Partner name | Check if `partners/[name].md` exists — read for integration type and history |
| Front URL (`front.com/...` or `cnv_*`) | Use Front MCP tools to fetch conversation context |
| Jira URL or key (`DEV-*`, `DEVSUPP-*`) | Use Jira MCP tools to fetch issue details |
| Free-text | Parse partner name and integration details directly |

If Front or Jira MCP tools are unavailable or return an error, tell the user which
tool failed and ask them to paste the relevant details. Do not guess.

**Merchant handle:** The `merchant_handle` is used to filter DataDog spans via
`@merchant.handle`. This is NOT the raw Merchant-Key header value — DataDog resolves
the key server-side and stores only the handle (e.g., `skytabpone`) and merchant ID.
If the user provides a raw API key or Merchant-Key, explain that DataDog cannot
filter by raw keys and ask for the merchant handle instead.

**Re-certification mode:** If `--recheck` is provided, read the prior certification
report at the given path. Extract the list of previously failed and passed checks.
If the file does not exist or cannot be parsed, tell the user and fall back to a
full certification. Do not guess at prior results.

Display the partner summary:

```text
PARTNER CONTEXT
───────────────
Partner:        [name]
Integration:    [type — Native Ordering / Loyalty API / Consumer UX / POS / etc.]
POS Partner:    [if applicable]
Ordering:       [if applicable]
Certification:  [first / re-certification]
Merchant Handle: [handle used for DataDog filtering]
Endpoints:      [list of endpoints under review]
Environment:    Sandbox
```

If integration type is unknown, stop and ask the user before proceeding.

## Step 2: Pull Actual API Calls from DataDog

The search strategy depends on the integration type identified in Step 0/1.

### Strategy A: Partner API / Consumer UX (search by credentials)

For integrations using Partner API credentials (bearer token + client ID), search
**logs directly** — they contain full request headers including `Authorization` and
`X-Clientid`, plus `params`, `status`, and `path`.

```
datadog_logs(
  query: "env:sandbox service:thanx-api @data.path:*[endpoint]*",
  from: "now-[days]d",
  to: "now",
  limit: 10
)
```

From each log, capture:
- `headers.Authorization` — bearer token (use to confirm calls belong to partner)
- `headers.X-Clientid` — client ID (second confirmation)
- `headers.Accept-Version` — API version header
- `headers.Content-Type` — **directly observable** (PASS/FAIL, not inferred)
- `headers.User-Agent` — client SDK/tool
- `method`, `path` — endpoint info
- `status` — HTTP response code
- `params` — full request body (all fields, values, nested objects)
- `duration`, `db`, `view` — performance data
- `datetime` — timestamp

**Filtering:** Match logs to the partner by checking `headers.Authorization` contains
the partner's bearer token, OR `headers.X-Clientid` matches the partner's client ID.
Exclude logs from other partners sharing the same endpoint.

**Limit: 10 logs per endpoint.** Mix of successful and error responses.

### Strategy B: POS / Kiosk / Native Ordering (search by merchant handle)

For integrations using merchant-level auth (Merchant-Key header), DataDog resolves
the key server-side and stores the handle in spans. Use **spans for discovery, then
logs for payload detail**.

#### 2b-i: Query Spans (Discovery)

```
datadog_spans(
  query: "resource_name:*[endpoint]* env:sandbox @merchant.handle:[handle]",
  from: "now-[days]d",
  to: "now",
  limit: 10
)
```

From each span, capture:
- `resource_name` — includes API version (e.g., `Api::V1::Baskets POST /baskets`)
- `http.status_code` — response status
- `http.method` — HTTP method
- `http.url` — endpoint path
- `merchant.handle` and `merchant.id` — confirms correct merchant
- `http.request.headers.user-agent` — client SDK/tool
- Timestamps — for cross-referencing with logs

**Limit: 10 spans per endpoint.** Mix of successful and error responses.

#### 2b-ii: Query Logs (Payload Detail)

```
datadog_logs(
  query: "service:thanx-olo env:sandbox [endpoint path]",
  from: "[start timestamp from spans]",
  to: "[end timestamp from spans]",
  limit: 10
)
```

Logs contain:
- `method`, `path` — endpoint info
- `status` — HTTP response code
- `params` — **full request body** including all fields, values, nested objects
  (e.g., `id`, `state`, `subtotal`, `items`, `modifiers`, `rewards`, `payments`)
- `duration`, `db`, `view` — performance data
- `datetime` — timestamp

**Important:** Logs for POS/kiosk integrations cannot be filtered by merchant handle.
Use timestamps from the span results to narrow the time window and match logs to
the correct merchant's calls. If multiple merchants hit the same endpoint in the
same window, cross-reference log `params` (e.g., basket ID patterns) with what you
expect from the partner.

### Query Budget

**Max 2 DataDog queries per endpoint** (Strategy A: 1 log query; Strategy B: 1 span
+ 1 log). **Hard cap: max 40 DataDog queries total.**

### 2c: Deduplication

Before proceeding to validation, group the returned API calls by a composite key:
**HTTP method + endpoint path + response status code + auth scheme + request body
field structure** (set of top-level field names and nesting shape, not values).
This ensures calls that differ in method, status, or auth are not merged — each
representative must cover all dimensions that get validated in Step 4.

For each unique group, keep one representative call and note the count of matching
calls. This prevents validating 200 identical requests while preserving meaningful
variants (e.g., a 201 vs a 400 for the same endpoint are separate groups).

Organize into a numbered list:

```text
API CALLS FOUND IN DATADOG (SANDBOX)
─────────────────────────────────────
1. [METHOD] [endpoint] — [timestamp] ([N] matching calls)
   API Version: [from span resource_name, e.g., V1]
   Status:      [response code]
   User-Agent:  [from span]
   Params:      [key fields from log params]
   Duration:    [from log]

2. [METHOD] [endpoint] — [timestamp] ([N] matching calls)
   ...

ENDPOINTS NOT FOUND
───────────────────
- [any endpoints the partner listed but no DataDog traces were found for]
```

If DataDog MCP tools are unavailable or return an error, tell the user which tool
failed. Ask if they can provide request/response samples manually as a fallback.
If manual samples are used, mark the certification result as `PARTIAL — based on
partner-provided samples, not verified from DataDog traces` so the reviewer knows
the evidence quality is lower.

**If no traces are found for any endpoint**, report this to the user — the partner
may not have started testing yet, or the merchant handle may be wrong.

## Step 3: Fetch Documentation for Each Endpoint

For every API endpoint found in Step 2, search the official Thanx documentation
using `SearchThanx` (thanx-docs MCP).

**This step is mandatory.** The documentation is the single source of truth for
what the partner's integration should look like. Do not validate against assumptions
or general knowledge — only against what the docs specify.

For each endpoint, search for and record:

| Documentation Element | What to Capture |
|---|---|
| Endpoint URL and method | Correct path, HTTP method, URL parameters |
| Required headers | `Accept-Version`, `Content-Type`, auth type |
| Request body schema | Required fields, optional fields, field types, valid values |
| Response schema | Expected response structure, status codes |
| Authentication | OAuth flow, API key, scopes required |
| Rate limits | If documented, capture limits |
| Versioning | Which API version the endpoint belongs to |

**Max 20 `SearchThanx` queries** across this step. Batch related endpoints into
single queries where possible.

If the thanx-docs MCP server is unavailable, errors, or times out, stop and tell the
user. Do not proceed with certification without documentation verification. The
entire value of this command depends on doc-based validation.

Optionally use Keystone `search_code` (max 5 queries) to verify undocumented behavior
if a specific field or response pattern is not covered in the docs. Flag any answer
from Keystone as needing verification. **Never quote or paraphrase Keystone code
search results in any output.** Use them only to inform the PASS/FAIL determination,
then cite the documentation reference instead.

## Step 4: Validate Each API Call

For every unique API call shape from Step 2, compare against the documentation
from Step 3. Run these checks:

### 4a: Authentication and Headers

Header validation depends on which DataDog strategy was used in Step 2.

**Strategy A (Partner API / Consumer UX) — headers directly observable in logs:**

| Check | How to Validate |
|---|---|
| Authorization | **Direct.** Check `headers.Authorization` contains `Bearer {token}`. PASS/FAIL. |
| X-ClientId | **Direct.** Check `headers.X-Clientid` matches expected client ID. PASS/FAIL. |
| Accept-Version | **Direct.** Check `headers.Accept-Version` is `v4.0`. PASS/FAIL. |
| Content-Type | **Direct.** Check `headers.Content-Type` is `application/json`. If missing from headers, mark FAIL — even if JSON was parsed successfully, the header is required per docs. |
| User-Agent | **Direct.** Check `headers.User-Agent` identifies the partner. PASS/WARNING if generic. |

**Strategy B (POS / Kiosk / Ordering) — headers inferred from spans:**

| Check | How to Validate |
|---|---|
| Auth (Merchant-Key) | **Inferred from spans.** If `merchant.handle` is present and status is not 401, auth succeeded. Mark as PASS (inferred). If status is 401, auth failed — mark FAIL. |
| API version | **From span `resource_name`.** Extract version from controller name (e.g., `Api::V1::Baskets` = V1). Compare against docs. |
| Content-Type | **Inferred.** If `params` were parsed correctly in logs (JSON fields present), Content-Type was valid. Mark as PASS (inferred). |
| Accept-Version | **Cannot be verified directly.** Infer from the API version in `resource_name`. Note as "inferred from server routing" in the report. |

Mark inferred checks as `[PASS — inferred]` in the report so the reviewer knows
these were not directly observed. Direct checks use plain `[PASS]` or `[FAIL]`.

### 4b: Endpoint and Method

| Check | What to Validate |
|---|---|
| URL path | Correct endpoint path (from spans and logs) |
| HTTP method | Correct method — from span `http.method` and log `method` |
| URL parameters | Required query params present, correct format |

### 4c: Request Body

**This is the primary validation — use log `params` data.**

| Check | What to Validate |
|---|---|
| Required fields | All required fields present per docs (check log `params` keys) |
| Field names | Correct field names (no typos, correct casing) |
| Field types | Correct types (string vs integer vs array) |
| Field values | Values match expected format (ISO dates, valid enums, etc.) |
| State transitions | For baskets: correct lifecycle (`checkout` → `placed` → `billed` → `completed`) |
| Points accrual field | Correct field used — `subtotal` not `amount` (common mistake) |
| Nested objects | Correct nesting structure for complex fields (items, payments, modifiers) |
| Extra fields | Any fields sent that are not in the docs (may be ignored or cause errors) |

### 4d: Response Handling

| Check | What to Validate |
|---|---|
| Error rate | What percentage of requests return 4xx/5xx (from spans) |
| Common errors | Recurring error patterns — same status code repeated (from spans) |
| Retry behavior | Are they retrying failed requests appropriately (from span timestamps) |

### 4e: Integration-Type-Specific Checks

Based on the integration type from Step 1, apply additional checks:

| Integration Type | Additional Checks |
|---|---|
| Loyalty API Direct | No orders expected (only purchases). Refund clawback does NOT happen automatically. |
| POS / Kiosk | Provider ticket lifecycle (checkout then billed). Payment amount calculation. Check log `params.state` values. |
| Consumer UX | Auth flow for end users. Reward exchange flow. Bonus points activation delay (~20 min). |
| Native Ordering | Order creation flow. Menu sync if applicable. |

### 4f: Call Sequencing

Verify the API calls in DataDog follow the correct order (use timestamps from logs):

- Authentication before any data calls
- User lookup/creation before purchases
- Basket state transitions: `checkout` → `placed` → `billed` → `completed`
- Proper webhook registration if event-driven

For each check, assign a result:

- **PASS** — Matches documentation (directly verified from DataDog data)
- **PASS (inferred)** — Cannot be directly observed but inferred from successful
  responses (used for headers only)
- **FAIL** — Does not match documentation (include expected vs actual from DataDog)
- **WARNING** — Not wrong but could cause issues (e.g., deprecated field, missing
  optional but recommended field, high error rate)
- **INSUFFICIENT DATA** — DataDog trace/log did not contain enough detail to validate

## Step 5: Generate Certification Report

**Pre-output verification:** Before generating the report, scan all content you are
about to include for credential patterns (API keys, bearer tokens, base64 strings
longer than 20 characters, OAuth secrets). If any are found, replace with
`[REDACTED]`. This is a mandatory check, not optional.

Determine the overall result using these deterministic criteria:

- **CERTIFIED** — All checks PASS or PASS (inferred). Warnings allowed. No FAIL or
  INSUFFICIENT on required endpoints.
- **NOT CERTIFIED** — Any check is FAIL on any endpoint
- **INCOMPLETE** — No FAIL results, but any required endpoint has INSUFFICIENT DATA
  or was not found in DataDog
- **PARTIAL** — Manual fallback samples were used instead of DataDog traces (lower
  evidence quality)

Compile all results into a structured report:

```text
CERTIFICATION REPORT
════════════════════
Partner:        [name]
Integration:    [type]
Date:           [today's date]
Mode:           [first certification / re-certification]
Environment:    Sandbox
Merchant:       [handle]
DataDog range:  [date range searched]
Calls analyzed: [N unique shapes from N total calls]
Data sources:   Spans (merchant filter, status codes, API version) +
                Logs (request params, field values)
────────────────────

SUMMARY
───────
Total checks:   [N]
Passed:         [N] ([M] inferred)
Failed:         [N]
Warnings:       [N]
Insufficient:   [N]

OVERALL RESULT: [CERTIFIED / NOT CERTIFIED / INCOMPLETE / PARTIAL]
────────────────────

DETAILED RESULTS
────────────────

1. Authentication and Headers
   [PASS — inferred] Auth: merchant.handle resolved, no 401s
   [PASS — inferred] API Version: V1 (from resource_name: Api::V1::*)
   [PASS — inferred] Content-Type: params parsed successfully
   ...

2. Endpoint: [METHOD] [path] ([N] calls in period)
   API Version: [from span resource_name]
   Representative call: [timestamp]
   [PASS/FAIL/WARNING/?] Required fields: [result]
   [PASS/FAIL/WARNING/?] Field mapping: [result]
   [PASS/FAIL/WARNING/?] State transitions: [result]
   [PASS/FAIL/WARNING/?] Points accrual: [result]
   ...
   Documentation reference: [doc page or section from SearchThanx]

3. [repeat for each endpoint]
   ...

────────────────────

FAILURES — REMEDIATION REQUIRED
────────────────────────────────
[For each FAIL:]

F1: [check name]
    Endpoint:     [METHOD] [path]
    DataDog found: [what the partner actually sent — from log params]
    Docs expect:   [what the documentation says]
    Fix:           [specific remediation — field name, value, format]
    Doc ref:       [documentation reference]

F2: ...

────────────────────

WARNINGS
────────
[For each WARNING:]

W1: [description]
    Recommendation: [what to improve]

────────────────────

MISSING EVIDENCE
────────────────
[For each INSUFFICIENT DATA or endpoint not found in DataDog:]

M1: [what could not be validated]
    Needed: [what we need — partner to make test calls, or provide samples]
```

Save the certification report to `.context/certifications/[partner-slug]-[date].md`
for future `--recheck` reference.

## Step 6: Draft Communication

Based on the certification result, draft the appropriate communication.

**Internal details guardrail:** Never include DataDog trace IDs, internal service
names, merchant handles, Keystone code search results, internal repo paths, or
system architecture details in the partner-facing email. Reference only what the
partner sent and what the docs expect.

### CERTIFIED — Confirmation Email

```text
DRAFT CERTIFICATION EMAIL
─────────────────────────
Subject: [Partner Name] — Integration Certified

[Confirmation that integration passed all checks]
[Outline next steps for launch]
[Any warnings to address before going live — not blockers but recommendations]

─────────────────────────
To send: use /ds:draft-email with the conversation ID, or copy and paste manually.
```

### NOT CERTIFIED — Failure Email with Remediation

```text
DRAFT REMEDIATION EMAIL
───────────────────────
Subject: [Partner Name] — Certification Results: Action Required

[Brief summary: N checks passed, N need remediation]

[For each failure:]
Issue [N]: [clear description]
- What we found: [actual behavior — described without exposing DataDog internals]
- What is expected: [per documentation]
- How to fix: [specific steps — endpoint, field, value]

[Set expectation for re-submission]
[Offer to answer questions]

───────────────────────
Boundary Doctrine: applied (specific remediation, no scope creep)
To send: use /ds:draft-email with the conversation ID, or copy and paste manually.
```

### INCOMPLETE — Missing Evidence Request

```text
DRAFT EVIDENCE REQUEST
──────────────────────
Subject: [Partner Name] — Additional Testing Needed for Certification

[List what was validated and passed so far]
[List endpoints with no DataDog traces — partner needs to make test calls]
[Request specific test scenarios to complete validation]

──────────────────────
```

## Step 7: Update Tracking

Propose updates for the user to review and manually apply:

```text
PROPOSED PARTNER FILE UPDATE
─────────────────────────────
File: partners/[name].md
Update certification status to: [CERTIFIED / NOT CERTIFIED / INCOMPLETE]
Add certification date: [today]
Add certification notes: [summary of results]
```

If there are action items (re-certification deadline, follow-up needed), propose
an `action-items.md` entry.

If re-certification (`--recheck` flag), note which previously failed items now pass
and which still need work.

## Rules

1. **thanx-docs MCP is the single source of truth.** Every validation must be checked
   against the official documentation. Do not validate against assumptions, general
   knowledge, or Keystone code alone.
2. **If thanx-docs MCP is unavailable, stop.** Do not proceed with certification
   without documentation verification. Tell the user and suggest retrying later.
3. **DataDog spans + logs are complementary.** Spans provide merchant filtering,
   status codes, and API version. Logs provide full request params for field
   validation. Always query both. If DataDog MCP tools are unavailable, accept
   manual samples as a fallback but mark the result as PARTIAL.
4. **Always filter DataDog to sandbox environment.** Certification is validated
   against sandbox traces only. Never pull production traces for certification.
5. **Max 20 SearchThanx queries + 5 Keystone queries** in Step 3. Max 2 DataDog
   queries per endpoint in Step 2. Limit results to 10 spans per endpoint.
6. **Header observability depends on integration type.** Partner API / Consumer UX
   logs contain full request headers (Authorization, X-Clientid, Accept-Version,
   Content-Type, User-Agent) — validate directly and mark as PASS/FAIL. POS / Kiosk
   logs do NOT contain raw headers — infer from spans and mark as "inferred".
7. **Credential requirements depend on integration type.** Partner API / Consumer UX
   need bearer token + client ID (searchable in log headers). POS / Kiosk / Ordering
   need merchant handle (searchable in span `@merchant.handle`). If the user provides
   the wrong credential type for their integration, explain what's needed and why.
8. **Keystone answers on undocumented behavior need engineering verification.** Flag
   as needing verification before including in the certification result. Never quote
   or paraphrase Keystone code in any output.
9. **Redact all credentials and internal details.** Never include API keys, bearer
   tokens, merchant handles, DataDog trace IDs, internal service names, or system
   architecture in partner-facing output. Run a pre-output verification scan.
10. **Apply boundary doctrine on every communication.** Provide specific remediation
    steps but do not extend scope beyond what was submitted for certification.
11. **Deterministic certification criteria.** Any FAIL = NOT CERTIFIED. Any
    INSUFFICIENT on required endpoint = INCOMPLETE. All PASS (including inferred) =
    CERTIFIED. Manual samples only = PARTIAL.
12. **`--days` flag maximum is 30.** If the user provides a value over 30, cap it
    at 30 and inform them.
13. **Knowledge base files are optional.** If `partners/[name].md`, `knowledge/*.md`,
    or other Second Brain files do not exist, skip them silently and continue.
14. **Do not send any email, update any ticket, or post to Slack.** Present
    everything for human review and approval.
13. **Required headers missing = FAIL, not WARNING.** If the docs list a header as
    required (Content-Type, Accept-Version, Authorization, X-ClientId, User-Agent)
    and it is absent from the request, mark it FAIL regardless of whether the API
    accepted the request. The API being lenient does not make the header optional.
