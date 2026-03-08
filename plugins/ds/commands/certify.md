---
description: Validate a partner integration against Thanx API documentation using DataDog traces and generate a certification report.
---

# Certify Partner Integration

Validate a partner's API integration by pulling their actual API calls from DataDog
and checking each one against the official Thanx documentation. The partner provides
the endpoints they use and their credentials — the command finds the real requests
in DataDog, verifies headers, payloads, and field mappings against thanx-docs MCP,
and generates a certification report with PASS/FAIL per check and remediation steps.

## Usage

```bash
/ds:certify <partner> <endpoints_and_credentials>
```

**Required:**
- `partner` — Partner name or Front/Jira URL with certification context
- `endpoints_and_credentials` — List of API endpoints the partner uses and the
  credentials (API key, OAuth client ID, or merchant identifier) they authenticate
  with, so we can find their calls in DataDog

**Optional (inline flags):**
- `--type <integration_type>` — Override integration type detection
- `--recheck` — Re-certification mode: validate only previously failed items plus
  a sanity check on passed items
- `--days <N>` — How many days back to search DataDog (default: 7)

---

You are executing the `/ds:certify` command.

## Step 1: Gather Partner Context

Arguments: $ARGUMENTS

Determine the partner and collect integration context:

| Input Type | How to Parse |
|---|---|
| Partner name | Check if `partners/[name].md` exists — read for integration type and history |
| Front URL (`front.com/...` or `cnv_*`) | Use Front MCP tools to fetch conversation context |
| Jira URL or key (`DEV-*`, `DEVSUPP-*`) | Use Jira MCP tools to fetch issue details |
| Free-text | Parse partner name and integration details directly |

If Front or Jira MCP tools are unavailable or return an error, tell the user which
tool failed and ask them to paste the relevant details. Do not guess.

**Credential handling:** The partner credentials provided (API key, OAuth client ID,
merchant ID) are used solely to query DataDog for their API calls. Redact all
credentials in the certification report and any output. Replace with `[REDACTED]`.
Never include real credentials in emails or tracking updates.

Display the partner summary:

```text
PARTNER CONTEXT
───────────────
Partner:        [name]
Integration:    [type — Native Ordering / Loyalty API / Consumer UX / POS / etc.]
POS Partner:    [if applicable]
Ordering:       [if applicable]
Certification:  [first / re-certification]
Credentials:    [REDACTED — type only: API key / OAuth client / merchant ID]
Endpoints:      [list of endpoints the partner says they use]
```

If integration type is unknown, stop and ask the user before proceeding.

## Step 2: Pull Actual API Calls from DataDog

Using the partner's credentials and endpoint list, query DataDog to find their
actual API requests.

Use Keystone DataDog MCP tools:

1. **`datadog_spans`** — Search for API request spans matching the partner's
   credentials or client identifier. Filter by:
   - Service name (e.g., `thanx-api`, `thanx-core`)
   - Endpoint path (from the endpoints list)
   - Time range (default: last 7 days, or `--days` flag)
   - Partner identifier (API key, client ID, or merchant ID in request attributes)

2. **`datadog_logs`** — If spans do not contain full request/response detail,
   search logs for the same time range and partner identifiers.

For each endpoint the partner listed, capture:

- HTTP method and full URL path
- Request headers (Accept-Version, Content-Type, Authorization type)
- Request body (fields, values, structure)
- Response status code
- Response body (if available in traces)
- Timestamp of the request

Organize into a numbered list:

```text
API CALLS FOUND IN DATADOG
──────────────────────────
1. [METHOD] [endpoint] — [timestamp]
   Status:  [response code]
   Headers: [key headers]
   Body fields: [list of fields sent]
   Response: [summary]

2. [METHOD] [endpoint] — [timestamp]
   ...

ENDPOINTS NOT FOUND
───────────────────
- [any endpoints the partner listed but no DataDog traces were found for]
```

If DataDog MCP tools are unavailable or return an error, tell the user which tool
failed. Ask if they can provide request/response samples manually as a fallback.
Do not proceed without evidence of actual API calls.

**If no traces are found for any endpoint**, report this to the user — the partner
may not have started testing yet, or the credentials may be wrong.

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

**Max 15 `SearchThanx` queries** across this step. Batch related endpoints into
single queries where possible.

If the thanx-docs MCP server is unavailable, errors, or times out, stop and tell the
user. Do not proceed with certification without documentation verification. The
entire value of this command depends on doc-based validation.

Optionally use Keystone `search_code` (max 5 queries) to verify undocumented behavior
if a specific field or response pattern is not covered in the docs. Flag any answer
from Keystone as needing verification.

## Step 4: Validate Each API Call

For every actual API call from DataDog (Step 2), compare against the documentation
(Step 3). Run these checks:

### 4a: Authentication and Headers

| Check | What to Validate |
|---|---|
| Auth type | Correct auth method (OAuth client credentials, API key, bearer token) |
| Auth flow | Token request uses correct grant type and scopes |
| Accept-Version | Correct API version header present |
| Content-Type | `application/json` or as required by endpoint |
| Required headers | All required headers present |

### 4b: Endpoint and Method

| Check | What to Validate |
|---|---|
| URL path | Correct endpoint path, correct resource IDs |
| HTTP method | Correct method (POST vs PUT vs PATCH) |
| URL parameters | Required query params present, correct format |

### 4c: Request Body

| Check | What to Validate |
|---|---|
| Required fields | All required fields present per docs |
| Field names | Correct field names (no typos, correct casing) |
| Field types | Correct types (string vs integer vs array) |
| Field values | Values match expected format (ISO dates, valid enums, etc.) |
| Points accrual field | Correct field used — `subtotal` not `amount` (common mistake) |
| Nested objects | Correct nesting structure for complex fields (items, payments) |
| Extra fields | Any fields sent that are not in the docs (may be ignored or cause errors) |

### 4d: Response Handling

| Check | What to Validate |
|---|---|
| Error rate | What percentage of requests return 4xx/5xx |
| Common errors | Recurring error patterns (same error repeated) |
| Retry behavior | Are they retrying failed requests appropriately |

### 4e: Integration-Type-Specific Checks

Based on the integration type from Step 1, apply additional checks:

| Integration Type | Additional Checks |
|---|---|
| Loyalty API Direct | No orders expected (only purchases). Refund clawback does NOT happen automatically. |
| POS / Kiosk | Provider ticket lifecycle (checkout then billed). Payment amount calculation. |
| Consumer UX | Auth flow for end users. Reward exchange flow. Bonus points activation delay (~20 min). |
| Native Ordering | Order creation flow. Menu sync if applicable. |

### 4f: Call Sequencing

Verify the API calls in DataDog follow the correct order:

- Authentication before any data calls
- User lookup/creation before purchases
- Purchase creation before reward checks
- Proper webhook registration if event-driven

For each check, assign a result:

- **PASS** — Matches documentation
- **FAIL** — Does not match documentation (include expected vs actual from DataDog)
- **WARNING** — Not wrong but could cause issues (e.g., deprecated field, missing
  optional but recommended field, high error rate)
- **INSUFFICIENT DATA** — DataDog trace did not contain enough detail to validate

## Step 5: Generate Certification Report

Compile all results into a structured report:

```text
CERTIFICATION REPORT
════════════════════
Partner:        [name]
Integration:    [type]
Date:           [today's date]
Mode:           [first certification / re-certification]
DataDog range:  [date range searched]
Calls analyzed: [N total API calls from DataDog]
────────────────────

SUMMARY
───────
Total checks:   [N]
Passed:         [N]
Failed:         [N]
Warnings:       [N]
Insufficient:   [N]

OVERALL RESULT: [CERTIFIED / NOT CERTIFIED / INCOMPLETE]
────────────────────

DETAILED RESULTS
────────────────

1. Authentication and Headers
   [PASS/FAIL/WARNING/?] Auth type: [result]
   [PASS/FAIL/WARNING/?] Accept-Version: [result]
   [PASS/FAIL/WARNING/?] Content-Type: [result]
   ...

2. Endpoint: [METHOD] [path]
   DataDog trace: [timestamp of example call]
   [PASS/FAIL/WARNING/?] Required fields: [result]
   [PASS/FAIL/WARNING/?] Field mapping: [result]
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
    DataDog found: [what the partner actually sent]
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

## Step 6: Draft Communication

Based on the certification result, draft the appropriate communication.

**Internal details guardrail:** Never include DataDog trace IDs, internal service
names, Keystone code search results, internal repo paths, or system architecture
details in the partner-facing email. Reference only what the partner sent and what
the docs expect.

### CERTIFIED — Confirmation Email

```text
DRAFT CERTIFICATION EMAIL
─────────────────────────
Subject: [Partner Name] — Integration Certified

[Confirmation that integration passed all checks]
[Outline next steps for launch]
[Any warnings to address before going live — not blockers but recommendations]

─────────────────────────
Next step: To send via Front, use /ds:draft-email with the conversation ID.
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
Next step: To send via Front, use /ds:draft-email with the conversation ID.
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
3. **DataDog is required for evidence.** Use `datadog_spans` and `datadog_logs` to
   find the partner's actual API calls. If DataDog MCP tools are unavailable, ask
   the user to provide request/response samples as a manual fallback.
4. **Max 15 SearchThanx queries + 5 Keystone queries** in Step 3. Batch related
   endpoints to stay within budget.
5. **Keystone answers on undocumented behavior need verification.** Flag as needing
   Darren verification before including in the certification result.
6. **Redact all credentials and internal details.** Never include API keys, bearer
   tokens, DataDog trace IDs, internal service names, or system architecture in
   partner-facing output.
7. **Apply boundary doctrine on every communication.** Provide specific remediation
   steps but do not extend scope beyond what was submitted for certification.
8. **Knowledge base files are optional.** If `partners/[name].md`, `knowledge/*.md`,
   or other Second Brain files do not exist, skip them silently and continue.
9. **Do not send any email, update any ticket, or post to Slack.** Present
   everything for human review and approval.
