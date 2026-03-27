---
description: Generate a self-contained current-work handoff document so any team member can pick up active tickets without questions. Pulls live Front data, cross-references partner files and Notion, and writes to tracking/handoff.md.
---

# Current Work Handoff

Generate a comprehensive handoff document covering all active partner support
work. The output is self-contained — Andre (or anyone covering) should not
need to ask Mateo any questions to pick up the work.

## Usage

```bash
/ds:current-work
```

---

You are executing the `/ds:current-work` command.

## Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| Front script | `scripts/front-tickets.py` | Live ticket data |
| Handoff file | `tracking/handoff.md` | Output location |
| Partner files | `partners/*.md` | Per-partner context |
| Notion Integration DB | `16ca84ed40248041bf3dd44210a7b002` | Integration records |
| Notion data source | `c5b78e80-0be4-49a9-9590-4d086eccf88d` | For Notion queries |
| Action items | `tracking/action-items.md` | Pending commitments |

## Step 1: Gather Live Ticket Data

Arguments: $ARGUMENTS

Run the Front ticket script to get current ticket state:

```bash
python3 scripts/front-tickets.py --all
```

Parse the output into three groups:

- **Open**: Status category `open` — needs active response
- **Waiting**: Status category `waiting` — awaiting external response
- **Resolved**: Status category `resolved` — recently closed

For each ticket, capture: conversation ID, subject, contact name (no email),
status, tags, ticket IDs (DEV-*, ISS-*), and last activity timestamp.

## Step 2: Enrich with Partner Context

For each ticket from Step 1:

1. **Check partner files**: Read `partners/_index.md` to identify which
   partner this ticket belongs to. If a `partners/<name>.md` file exists,
   read it for:
   - Integration type and status
   - Key contacts and their roles
   - Relationship notes and communication preferences
   - Active issues and history

2. **Check Notion**: If the partner has an integration record, query the
   Notion Integration Partners Database for current status, health, and
   the latest Status Log entry. Use `notion-search` or
   `notion-query-database-view` to find the record.

   **If Notion MCP is unavailable:** Skip this enrichment step and note
   "Notion unavailable — partner status from local files only" in the
   handoff header. Do not fail the entire command.

3. **Read recent messages**: For open tickets where the next action is
   unclear, read the last 2-3 messages to determine what was last said
   and by whom:

   ```bash
   python3 scripts/front-tickets.py --messages <CNV_ID>
   ```

   Only do this for tickets where subject + tags alone are insufficient
   to determine next steps. Limit to 5 message reads maximum to avoid
   slow execution.

## Step 3: Check Pending Commitments

Read `tracking/action-items.md` for any pending commitments that relate
to the tickets found in Step 1. Include these as explicit callouts in
the relevant ticket sections.

## Step 4: Generate Handoff Document

Write the handoff to `tracking/handoff.md` using this structure:

```markdown
# Current Work Handoff — Mateo Mantovano

**Last updated**: [YYYY-MM-DD]
**Purpose**: Full picture of everything Mateo is working on. If Mateo is
out, this document + the partner files + the Front script give Andre
(or anyone) everything needed to cover.

To pull live ticket data: `python3 scripts/front-tickets.py`

---

## Open Tickets (Need Active Response)

### 1. [Partner Name] — [Issue Summary]
- **Front**: `[cnv_id]` ([ticket_id])
- **Partner contacts**: [names and roles — no email addresses]
- **Integration**: [type] — [status]
- **Issue**: [1-2 sentence description]
- **Status**: [current state — what has been done, what remains]
- **Next step**: [specific action with owner and deadline if known]
- **Partner file**: `partners/[name].md`
- **Tags**: [Front tags]

[Repeat for each open ticket]

---

## Waiting Tickets (Awaiting External Response)

### N. [Partner Name] — [Issue Summary]
- **Front**: `[cnv_id]` ([ticket_id])
- **Partner contact**: [name and company]
- **Status**: Waiting — [what we're waiting for and since when]
- **Next step**: [what to do if they respond, or when to follow up]
- **Tags**: [Front tags]

[Repeat for each waiting ticket]

---

## Recently Resolved

### [Partner Name] — [Issue Summary]
- **Front**: `[cnv_id]` ([ticket_id])
- **Contact**: [name]
- **Resolved**: [date]
- **Summary**: [one line — what was done]

[Repeat for each resolved ticket]

---

## Key Relationships to Know

| Partner | Key Contact | Tone | Notes |
|---------|------------|------|-------|
| [name] | [contact] | [tone] | [context] |

[Include only partners with active or waiting tickets]

---

## Internal Context

[List key internal stakeholders and their roles relevant to active work:
engineering escalation contacts, CS/Onboarding alignment needs, etc.]

## Tools Quick Reference
- `python3 scripts/front-tickets.py` — live ticket view
- `python3 scripts/front-tickets.py --messages CNV_ID` — read full thread
- Keystone MCP — codebase and docs queries
- Notion — partner database, playbooks, SOPs
```

## Step 5: Confirm and Offer Updates

After writing the handoff:

1. Output a summary: "[N] open, [N] waiting, [N] resolved tickets
   documented in `tracking/handoff.md`"

2. If any tickets are missing partner files, suggest creating them:
   "These partners don't have local files yet: [list]. Want me to
   create them?"

3. If any partner Notion records have stale status logs (last entry
   older than 7 days and ticket is still active), flag them:
   "These Notion records may need status log updates: [list]"

## Rules

1. **Self-contained**: The handoff must stand alone. Andre should not
   need to open Front, Slack, or Notion to understand what is happening
   and what to do next. Every ticket must have a clear next step.
2. **Specific next steps**: "Monitor for response" is acceptable for
   waiting tickets. Open tickets must have actionable next steps with
   owner (e.g., "Investigate the discrepancy, then align with Courtney
   before responding").
3. **No credentials or PII**: Never include API keys, passwords, or
   customer personal data in the handoff.
4. **Preserve manual edits**: If `tracking/handoff.md` already exists,
   read it first. Preserve any manually added sections (like "Internal
   Context" notes) that are not auto-generated from Front data. Only
   overwrite ticket sections with fresh data.
5. **Partner file references**: Always include `partners/[name].md`
   links for tickets that have corresponding partner files.
6. **Staleness warning**: If the Front script returns no data or errors,
   do not silently write an empty handoff. Report the error and preserve
   the existing handoff file.
7. **Date all entries**: Use absolute dates, not relative references
   like "yesterday" or "last week".
8. **Ticket numbering**: Number tickets sequentially across all sections
   (open 1-N, then waiting continues from N+1). This makes it easy to
   reference specific tickets in conversation.
