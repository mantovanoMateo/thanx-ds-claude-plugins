---
description: Create a structured Jira bug ticket in the BUGS project - gather evidence, classify severity, and generate a ready-to-file ticket with triage message.
---

# Create Bug Ticket

Generate a complete, structured Jira bug ticket for the BUGS project with evidence gathering, severity classification, and optional triage message.

## Usage

```bash
/ds:bug-ticket <description_or_front_url>
```

**Required:**

- `description_or_front_url` - A Front conversation URL (DEV-*, ISS-*),
  Jira ticket URL, or free-text description of the bug

---

You are executing the `/ds:bug-ticket` command.

**Autonomy guardrail:** This command is read-and-draft only. It reads
from external systems (Front, Jira, Keystone, Datadog, Sentry) for
context gathering but NEVER writes to them. Do not create Jira tickets,
post to Slack, send Front messages, or make any external write API calls.
All outputs are presented for human review and manual action.

**Privacy guardrail:** Never include raw PII or secrets in outputs
(auth tokens, API keys, session IDs, full email addresses, phone
numbers, passwords). Redact sensitive values and prefer internal IDs
and admin links instead.

## Step 1: Parse Input and Gather Context

Arguments: $ARGUMENTS

Determine the input type and extract context:

- **Front conversation URL or ticket ID (DEV-*, ISS-*):** Search using
  `front_get_conversation`, then fetch messages with
  `front_list_messages`. Extract the bug details from the thread.
- **Jira URL or issue key:** Fetch with `jira_get_issue`. Validate
  that the issue belongs to an expected project (BUGS, DEVSUPP, OPS)
  before proceeding. Extract the existing description and comments.
- **Free-text:** Parse the description directly.

Extract the following. If a field cannot be determined, mark it as
"UNKNOWN - input needed":

- Issue description (what is broken)
- Affected merchant(s) and merchant ID(s)
- Affected user(s) (if applicable)
- Environment (production, sandbox, staging)
- Error messages, status codes, or unexpected responses
- Steps to reproduce (if provided)
- Front conversation link (if available)
- Reporter and date reported
- Integration type (POS, ordering, loyalty API, custom app, etc.)

## Step 2: Gather Evidence

Search available tools to collect supporting evidence. Skip any source that
is not relevant to the issue.

1. **Merchant lookup:** Query `replica_query` on the nucleus database to
   confirm merchant details (name, handle, ID, state). Always escape
   merchant name/ID values before passing to `replica_query` — do not
   interpolate raw user input into SQL strings.
   If `replica_query` is unavailable, ask the user to provide the
   merchant ID directly or skip merchant verification and note it in
   the Evidence section.
2. **Thanx docs:** Use `search_thanx` to find the relevant endpoint
   documentation and confirm expected behavior.
3. **Codebase:** Use `search_code` and `read_file` to trace the code path
   and identify the root cause if possible. Document the file and line
   number.
4. **Datadog:** If the issue involves API errors, search `datadog_logs`
   for matching error patterns.
5. **Sentry:** If error messages are present, search `sentry_issues` for
   matching exceptions.
6. **Jira BUGS project:** Search `jira_search_issues` with JQL
   `project = BUGS AND text ~ "<keywords>" AND created >= -100d ORDER BY created DESC`
   to check for recent duplicates. Sanitize keywords before embedding
   in JQL — strip double quotes and JQL reserved words (AND, OR, NOT)
   from extracted search terms.

For each source checked, note:

- Whether evidence was found
- Link or reference to the finding
- Whether a duplicate exists (and its status)
- Any sensitive fields redacted before output

If a duplicate is found, stop and present it to the user before proceeding.

**If Keystone MCP is unavailable:** Skip evidence-gathering steps that
require it. Note which steps were skipped and proceed with the information
available.

## Step 3: Classify Severity

Apply the Thanx severity scale based on the evidence gathered:

| Level | Name | Criteria |
|-------|------|----------|
| L1 | Critical | Service down, data loss, or security vulnerability affecting all users. Requires immediate response. |
| L2 | High | Major feature broken for a significant number of users or merchants. No workaround available. |
| L3 | Medium | Feature partially broken or behaving incorrectly. Workaround exists but is not ideal. |
| L4 | Low | Minor issue, cosmetic problem, or edge case affecting few users. Workaround available. |
| L5 | Trivial | Documentation error, minor UI inconsistency, or improvement suggestion. |

If the user specified a severity, validate that it is one of `L1`, `L2`,
`L3`, `L4`, or `L5`. If invalid, mark severity as "UNKNOWN - input needed"
and propose an evidence-based severity until the user confirms. Otherwise, propose one based on
the evidence and explain the reasoning.

## Step 4: Detect Category

Automatically classify the bug into a **primary** category. Optionally
include secondary categories when needed. Include category-specific fields
only for the primary category unless explicitly requested:

| Category | Additional Fields |
|----------|------------------|
| API / Endpoint | Endpoint path, HTTP method, request/response samples, code path |
| Ordering | Ordering provider (Olo, Toast, etc.), affected locations, basket IDs |
| Rewards / Campaigns | Campaign ID, reward template ID, program ID, affected users |
| Points | Points experience ID, points product IDs, balance discrepancy |
| Data | Report link, expected vs actual values, query or dashboard |
| UX / Branded App | Device, OS version, app version, screenshots |
| Dashboard / Admin | Dashboard URL, admin page, scope of impact |
| Authentication | Auth flow, token type, error response |

## Step 5: Generate Bug Ticket

Present the complete ticket in this format. Do NOT create the Jira ticket
directly — present it for human review.

```text
==============================================================================
  JIRA BUG TICKET DRAFT
==============================================================================
  Project: BUGS
  Severity: [L1-L5] - [Critical/High/Medium/Low/Trivial]
  Primary category: [detected category]
  Secondary categories: [optional list, or "None"]
==============================================================================

Title: [Short, specific title - under 80 characters]

------------------------------------------------------------------------------
Summary
------------------------------------------------------------------------------
[One-sentence summary of the bug]

Source: [Front thread link or reporter info]

------------------------------------------------------------------------------
Description
------------------------------------------------------------------------------
[Detailed explanation of what is happening and why it matters.
Include timestamps, merchant context, and integration type.
Reference code paths if traced (repo/file:line).
Do not include raw PII or credentials; use redacted references only.]

------------------------------------------------------------------------------
Expected vs Actual
------------------------------------------------------------------------------
Expected: [What should happen based on docs/code]
Actual: [What is happening instead]

------------------------------------------------------------------------------
Steps to Reproduce
------------------------------------------------------------------------------
1. [Step 1]
2. [Step 2]
3. [Step 3]

------------------------------------------------------------------------------
Affected Resources
------------------------------------------------------------------------------
- Merchant(s): [name (ID)] - [admin link]
- User(s): [if applicable]
- Environment: [production / sandbox / staging]
- Endpoint: [if applicable]
- Integration type: [if applicable]

------------------------------------------------------------------------------
Evidence
------------------------------------------------------------------------------
- [Source 1]: [finding + link]
- [Source 2]: [finding + link]
- Code path: [repo/file:line - description]

------------------------------------------------------------------------------
Category-Specific Information
------------------------------------------------------------------------------
[Only include fields relevant to the primary category]

------------------------------------------------------------------------------
Impact
------------------------------------------------------------------------------
[Business consequences, scope, frequency.
How many merchants/users are affected?
Is there a workaround?]

------------------------------------------------------------------------------
Proposed Fix (if identified)
------------------------------------------------------------------------------
[If the code investigation revealed a clear fix, describe it here.
Otherwise, omit this section.]
```

## Step 6: Generate Triage Message

Draft a triage message for the appropriate Slack channel. For L1/L2
severity, note that the message should target the critical bug triage
channel. For L3-L5, target the standard triage channel. Reference the
`ds-team-config` skill for channel IDs before posting.

```text
Triage Message:
------------------------------------------------------------------------------
Hi team, I drafted a bug ticket for review regarding [summary].

[Concise explanation of the issue with facts. Describe how it impacts the
merchant/partner. Include the code path if traced.
Do not include raw PII or credentials; use redacted references only.]

[If reported by a partner via Front, note the Front thread.]

Let me know if you have any questions.
[Jira link placeholder]
------------------------------------------------------------------------------
```

## Step 7: Generate Follow-Up Communications (Optional)

If the bug was reported by a partner or merchant, draft two additional
messages. Follow the boundary doctrine: do not commit to specific fix
dates or timelines on behalf of engineering. Use language like "we will
provide an update as our team investigates."

**Partner/Merchant Update:**

A 2-3 sentence response acknowledging the issue, confirming it has been
flagged for engineering investigation, and noting that we will follow up
with an update. Do not promise a specific fix date.

**Internal Comment (for CS/Front thread):**

A 1-2 sentence summary noting the Jira ticket was filed and what the
expected next step is.

## Step 8: Present Summary

```text
==============================================================================
  BUG TICKET SUMMARY
==============================================================================
  Title: [title]
  Severity: [L1-L5]
  Primary category: [category]
  Secondary categories: [optional list, or "None"]
  Duplicate found: [Yes (link) / No]
  Evidence sources checked: [list]
  Triage channel: [standard / critical]
==============================================================================

Suggested Actions:
- [ ] Create Jira ticket in BUGS project
- [ ] Post triage message to appropriate channel
- [ ] [Update Front thread / Reply to partner - if applicable]
- [ ] [Add Jira link to Front conversation - if applicable]
==============================================================================
```

Do not create the Jira ticket, post to Slack, or send any message. Present
everything for human review and approval.
