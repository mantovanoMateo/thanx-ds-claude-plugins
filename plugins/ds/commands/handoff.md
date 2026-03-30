---
description: Generate a current-work handoff Notion page covering all active Front tickets, cross-team Jira bugs, and Slack threads for the user running the command.
---

# Current Work Handoff

Generate a self-contained handoff document as a Notion page so a teammate
can pick up all of your active work without questions. The command detects
who is running it and pulls their data.

## Usage

```bash
/ds:handoff [--to <name>]
```

**Optional:**

- `--to <name>` - Name of the person receiving the handoff (default:
  teammate). Used in the document header.

---

You are executing the `/ds:handoff` command.

## Configuration

Slack channels and team IDs are maintained in the **ds-team-config skill**.
Reference that skill at runtime for channel IDs, teammate IDs, and Jira
account IDs instead of hardcoding values.

| Constant | Source | Purpose |
|----------|--------|---------|
| DS Team Members | ds-team-config | Detect current user |
| Slack channels | ds-team-config | Channels to scan |
| Front ticket script | `python3 scripts/front-tickets.py` | Live ticket data |
| Partner files dir | `partners/` | Local partner context |

Arguments: $ARGUMENTS

## Step 0: Identify the Current User

Determine who is running this command. Use one of these methods:

1. **Check the ds-team-config skill** for the current user's identity
   (name, Front teammate ID, Jira account ID)
2. **If not available**, check CLAUDE.md or the Second Brain for the
   user's identity
3. **If still unclear**, ask: "Who is generating this handoff?"

You need three pieces of information:

- **Name** (for the document header)
- **Front teammate ID** (e.g., `tea_iqhum` for Mateo, `tea_jtl0e` for Andre)
- **Jira account ID** (for BUGS ticket filtering)

Also determine the **recipient** — if `--to` was provided, use that name.
Otherwise, default to the user's teammate (e.g., if Mateo is running it,
recipient is Andre; if Andre is running it, recipient is Mateo).

## Step 1: Gather Data (In Parallel)

Collect all data sources simultaneously. **If any data source fails after
one retry, do not block the entire handoff.** Include the section header
with a note that data was unavailable (e.g., "⚠️ Front data unavailable —
script returned an error"). Continue with the remaining sources.

### 1a: Front Tickets

Run `python3 scripts/front-tickets.py --all --limit 50` to get the
user's tickets organized by status (open, waiting, resolved).

**Fallback logic:** The Front script is configured per-workspace with a
hardcoded teammate ID. Compare the current user's Front teammate ID
(from Step 0) against the script's configured teammate ID (check the
script source or its output header). If they match, use the script
output. If they differ (e.g., Andre running the command in Mateo's
workspace), use `front_search_conversations` with
`assignee:{user_front_id}` instead.

### 1b: Cross-Team Jira Tickets

Search for active BUGS tickets where the user is assignee or reporter:

```jql
project = BUGS
AND (assignee = "{user_jira_id}" OR reporter = "{user_jira_id}")
AND status NOT IN (Done, "Won't Do", Closed)
ORDER BY updated DESC
```

Only include tickets with status in: Open, In Progress, Blocked, QA,
Under Review, Waiting. Skip Resolved/Closed/Done.

### 1c: Slack Threads

Read the latest 15 messages from each Slack channel listed in
ds-team-config (scan channels: `#partnerships-dev-supp`,
`#rnd-dev-supp`, and any active merchant channels).

For each message, determine if it is actionable using these criteria:

- Contains a question directed at Dev Support or mentions a support keyword
  (integration, API, endpoint, error, bug, certification)
- Is from a partner contact or engineer requesting help
- References an active Front ticket, Jira issue, or known partner
- Has reactions indicating it needs attention (🚨, ❓, 👀)
- Is NOT a bot notification, resolved announcement, or general discussion

For each actionable message:

- Is it resolved or still needs response?
- Does it relate to any active Front ticket or partner?

**Important**: Do NOT mark a thread as "UNANSWERED" without checking
if replies exist. If you only see the top-level message, read the
thread to confirm status.

### 1d: Partner Context

For each open or waiting Front ticket, check if a local partner file
exists in `partners/`. If it does, read it for:

- Integration type
- Key contacts
- Relationship notes
- Tier information

## Step 2: Enrich Tickets

For each **open** and **waiting** ticket, build a summary with:

- **Front conversation ID and ticket ID** (e.g., cnv_xxx, DEV-xxxx)
- **Partner name and contact** (from Front thread + partner file)
- **Integration type** (from partner file or thread context)
- **Current status** with color coding:
  - Open/SLA Applies → `color="red_bg"`
  - Waiting on partner → `color="yellow_bg"`
  - Waiting on engineering → `color="blue_bg"`
- **Issue summary** (1-2 sentences)
- **Next step** with deadline if applicable
- **Tier** if known

For complex tickets (multiple issues, long history), use a table header
with the key fields, then bullet points for details.

For simpler waiting tickets, use a compact bullet format:
`- **Partner / Contact** — summary (cnv_xxx) — waiting since YYYY-MM-DD`

## Step 3: Create Notion Page

Create a Notion page using the Notion MCP `notion-create-pages` tool.

**Parent page:** Use `data_source_id: c5b78e80-0be4-49a9-9590-4d086eccf88d`
as the parent (the Dev Support Notion workspace). If a "Handoffs" database
or parent page has been configured in ds-team-config, use that instead.

**Error handling:** If `notion-create-pages` fails, stop and report the
error to the user. Do NOT proceed to Step 4 without a confirmed page URL.
Verify the response contains a valid page ID/URL before continuing.

**Page properties:**

- **Title**: `Current Work Handoff — {user_name} to {recipient_name} (YYYY-MM-DD)`
- **Icon**: 📋

**Page content structure** (in this exact order):

```markdown
**Last updated**: YYYY-MM-DD HH:MM PT
**From**: {user_name}
**To**: {recipient_name}
**Purpose**: Full picture of everything {user_name} is working on.
If {user_name} is out, this document gives {recipient_name} everything
needed to cover without questions.

---

# {user_name}'s Open Tickets (Need Active Response)

[For each open ticket: table header + bullet details]
[If none: "No open tickets requiring immediate response."]

---

# {user_name}'s Waiting Tickets (Awaiting External Response)

[For each waiting ticket: table or compact format depending on
complexity]

---

# {user_name}'s Recently Resolved

[Bullet list of resolved tickets from the last 14 days]
[Format: **Partner** (TICKET-ID) — Brief description — Resolved DATE]

---

# Cross-Team Jira Tickets (BUGS)

[Table with columns: Ticket (linked), Summary, Status (color-coded),
Assigned To, Context]
[If none: "No active cross-team tickets."]

---

# Active Slack Threads

## #partnerships-dev-supp

[Callout blocks for urgent/unanswered items]
[Bullet list for recent activity with dates]

## #rnd-dev-supp

[Bullet list for recent activity with dates]

## #[merchant-channel] (if relevant activity)

[Bullet list for recent activity with dates]

---

# Key Relationships

[Table with columns: Partner, Key Contact, Notes]
[Only include partners with active open/waiting tickets]
```

## Step 4: Present and Confirm

After creating the Notion page:

1. Share the Notion page URL with the user
2. Summarize what's included: number of open tickets, waiting tickets,
   BUGS tickets, and Slack threads
3. Flag any sections where data was unavailable (from Step 1 failures)
4. Ask if any corrections are needed

## Step 5: Draft Handoff Notification

After the Notion page is created and confirmed, draft a Slack message
to send to the recipient. This message is a heads-up with a link to
the full handoff — not a duplicate of the document.

**Message template:**

```text
Hey {recipient_name}!

I've put together a handoff doc covering everything I'm working on —
should have all the context you need if anything comes up.

:clipboard: {notion_page_url}

Quick summary:
• {N} open ticket(s) needing response [{list top 1-2 by name if any}]
• {N} waiting tickets
• {N} active BUGS ticket(s) [{list status: in QA, blocked, etc.}]
• Slack threads flagged from #partnerships-dev-supp and #rnd-dev-supp

The doc has next steps and deadlines for everything — let me know if
you have any questions. Thanks!
```

**Formatting rules:**

- Open with a warm greeting
- Link the Notion page prominently
- Summarize counts (open, waiting, BUGS) with the most urgent callouts
- Close warmly — keep it conversational, not a status report
- If there are urgent items (SLA Applies, open tickets), call them out
  by partner name in the summary

**Present the draft** to the user for review. After approval, offer to
send it as a DM to the recipient via Slack.

**Do NOT send without explicit approval.**

## Rules

1. **Detect the current user.** Do not hardcode names or IDs. The
   command works for any DS team member.
2. **This is the user's handoff TO their teammate.** Do not include
   the recipient's tickets, internal contact lists, or tools reference
   — the recipient already knows those.
3. **Cross-team Jira only.** Include BUGS project tickets only, NOT
   DEVSUPP internal tickets. The handoff is about work that touches
   other teams.
4. **Verify Slack thread status.** Never mark a thread as "UNANSWERED"
   without reading the thread replies. Check if someone has already
   responded.
5. **Color-code statuses** in tables for quick scanning:
   - Red (`color="red_bg"`): needs immediate response
   - Yellow (`color="yellow_bg"`): waiting on external party
   - Blue (`color="blue_bg"`): with engineering/QA
6. **Include next steps with deadlines.** Every open and waiting ticket
   must have a concrete next step. If there's a follow-up date, state it.
7. **Never include credentials** or sensitive data in the handoff.
8. **Recently resolved = last 14 days.** Don't include older resolved
   tickets — they're noise.
9. **Key Relationships table** should only include partners with active
   (open or waiting) tickets. Don't list every partner ever.
10. **Output is a Notion page**, not a local file. The handoff lives in
    Notion so the recipient can access it from anywhere.
11. **Keep it self-contained.** The recipient should not need to ask
    the sender any questions after reading this document.
12. **Graceful degradation on data source failures.** If any source
    (Front, Jira, Slack) fails after one retry, include the section
    header with a "⚠️ Data unavailable" note. Do not block the entire
    handoff on a single failed source.
13. **One handoff per day per user.** Before creating, search Notion
    for an existing page titled "Current Work Handoff — {user_name}*"
    with today's date. If found, warn the user and ask before creating
    a duplicate.
