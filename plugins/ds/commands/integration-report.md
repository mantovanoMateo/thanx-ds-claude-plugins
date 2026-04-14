---
description: Generate a weekly integration status report from the Notion Integration Partners Database, upload it to the Weekly Integration Status Tracker, and draft a Slack notification.
---

# Integration Report

Generate a weekly integration status report by pulling live data from the
Notion Integration Partners Database, creating a report page in the Weekly
Integration Status Tracker, and drafting a Slack message for the
partnerships channel.

## Usage

```bash
/ds:integration-report
```

---

You are executing the `/ds:integration-report` command.

## Step 1: Determine Report Window

Calculate the report window based on today's date:

- **Report week**: The current Monday-to-Sunday week containing today
- **Change detection cutoff**: 7 calendar days before today
  (e.g., if today is March 26, cutoff is March 19)
- **Kicked-off cutoff**: Same as change detection cutoff — only show
  integrations kicked off within the last 7 days
- **Recently certified window**: 30 calendar days before today —
  integrations certified within this window appear in the
  "Recently Certified" section

Announce:

> Generating **Weekly Integration Report** for the week of
> [Monday date of current week].

## Step 2: Query Integration Partners Database

Pull all integration records from the Notion Integration Partners Database.

1. Use `notion_query_database` (Keystone MCP) with database ID
   `16ca84ed40248041bf3dd44210a7b002` and `page_size: 100`
1. If `has_more` is true in the response, continue querying with
   `start_cursor` set to the returned `next_cursor` value.
   Repeat until `has_more` is false.
1. Combine all pages of results before proceeding.
   Save to a file and extract the properties listed below.
1. For each record, extract:
   - **Name** (title property)
   - **Integration Status** (status property)
   - **Integration Health** (select — emoji values: 🟢, 🟡, 🔴)
   - **Integration Type** (multi_select property)
   - **Built By** (select — Platform Partner, Merchant-Specific, or Thanx)
   - **Kick-Off** (date property)
   - **Target Date** (date property)
   - **Certification Date** (date property)
   - **last_edited_time** (page metadata)
   - **url** (page URL for linking)

If `notion_query_database` is unavailable, report this and stop —
the report cannot be generated without the source data.

## Step 3: Gather Weekly Change Summaries

For each active integration (non-terminal status), generate a
one-sentence summary of what changed this week. This is a key
deliverable — stakeholders want to see progress at a glance
without clicking into individual records.

### How to determine what changed

For each integration, check these sources in order:

1. **Front threads (primary)**: Run the Front ticket script to list
   recent activity across all assigned threads. Match partner names
   to active integrations. If a Front thread for this partner was
   updated in the last 7 days, summarize the latest exchange.

   ```bash
   python3 scripts/front-tickets.py
   ```

   This returns all open, waiting, and recently resolved tickets.
   Match each ticket's contact or subject to active integrations.
   For matched threads, read messages with:
   `python3 scripts/front-tickets.py --messages <CNV_ID>`
2. **Status Log**: Use `notion_get_page_content` to read the most
   recent Status Log entry on the partner's Notion page. If the
   latest entry is dated within the last 7 days, summarize it.
3. **`last_edited_time`**: If the page was edited in the last 7
   days but no Front activity or Status Log entry exists, note
   "Record updated" with the edit date.
4. **No change**: If none of the above sources show recent activity,
   write "No change this week."

### Writing the summary

- One sentence max, ~10-15 words
- Lead with the action or state change
- Use plain language, not jargon
- Examples:
  - "Moved to Under Certification after sandbox testing completed"
  - "Waiting on partner to submit updated API headers"
  - "Certification meeting scheduled for April 15"
  - "Sandbox credentials provided, partner building integration"
  - "No change this week"
  - "Kicked off March 27 — initial scope call completed"

### Performance note

Reading Status Logs for every integration can be slow. To manage
this:
- Prioritize integrations with `last_edited_time` in the last 7
  days — these are most likely to have meaningful updates
- **Caveat:** `last_edited_time` can reflect bulk property updates
  (e.g., health re-evaluations) rather than meaningful content
  changes. Always cross-reference with Front threads before
  defaulting to "Record updated."
- For integrations with no recent edits, skip the Status Log read
  and default to "No change this week"
- Run page content reads in parallel where possible

## Step 4: Classify Integrations

Using the extracted data, classify each integration into the
following sections. The report should only show integrations that
are **actively in progress or recently completed** — not every
integration ever tracked.

### Filtering Rules

**Include in the report:**
- Integration Status IN: Not started, Kicked-Off, In progress,
  Under Certification, Partial Certification
- Integration Status = Done AND Certification Date within the
  last 30 days (recently certified)
- Integration Status = Paused (visibility for stalled work)

**Exclude from the report:**
- Integration Status = Done with Certification Date older than
  30 days (long-certified — no longer needs weekly tracking)
- Integration Status = Done with no Certification Date AND
  Kick-Off older than 90 days (likely long-certified, date missing)
- Integration Status IN: Declined, Complete, Archived, Cancelled

### Section: Active Integrations

All integrations with status IN: Not started, Kicked-Off,
In progress, Under Certification, Partial Certification.

Sort by status priority:
1. Under Certification (closest to completion)
2. In progress
3. Partial Certification
4. Kicked-Off
5. Not started

Each table row shows: Partner (linked), Type, Status, Health,
Target Date (or —), **This Week** (one-sentence summary from
Step 3).

### Section: Recently Certified (Last 30 Days)

Integrations with status = Done AND Certification Date within the
last 30 days.

Each table row shows: Partner (linked), Type, Certified date.

### Section: Paused / Stalled

Integrations with status = Paused.

Each table row shows: Partner (linked), Type, Health,
**This Week** (one-sentence summary — often "No change" for paused
integrations, but check in case there's a reactivation signal).

### Section: Lower Activity (🟡)

Integrations with Integration Health = 🟡 that are NOT paused
(paused integrations already appear in their own section).

**Important:** Do NOT label this section "At Risk", "Critical", or
any alarming language. 🟡 simply means lower activity.

## Step 5: Build Report Summary

The summary section includes exactly four bullet points:

- **X** active integrations (in progress, under certification,
  kicked-off, etc.)
- **X** recently certified (last 30 days)
- **X** paused / stalled
- **X** with lower activity (🟡)

If any count is zero, omit that bullet.

## Step 6: Data Quality Checks

Before creating the report, scan for data anomalies:

1. **Future certification dates**: Status = Done but Certification
   Date is in the future — likely a data entry error
2. **Missing Target Dates**: Count how many active integrations
   (non-Done, non-Paused, non-Declined) have no Target Date
3. **Missing Kick-Off dates**: Any integration with a non-terminal
   status but no Kick-Off date
4. **Stale statuses**: Integrations with status = Kicked-Off but
   Kick-Off date older than 90 days (may have progressed)

Include findings in the data quality notes (Step 10).

## Step 7: Check for Existing Report (Current Week)

Before creating a new report, check for duplicates:

1. Use `notion_query_database` (Keystone MCP) on the Weekly Integration Status
   Tracker (database ID from data_source_id
   `32ea84ed4024809f90e0000b1415bd69`) with a filter on the
   `Name` property containing
   "Week of [Monday date]".
1. If a matching page exists, warn the user and ask for confirmation
   before creating a duplicate.
1. If no match exists, proceed to Step 8.

## Step 8: Create Notion Report Page

Create a new page in the Weekly Integration Status Tracker database.

1. Use `notion-create-pages` (Notion MCP) with:
   - **Parent**: data_source_id `32ea84ed4024809f90e0000b1415bd69`
   - **Properties**:
     - `Name`: "Weekly Integration Report — Week of
       [Monday date, e.g., March 24, 2026]"
     - `date:Status Date:start`: today's date in ISO format (YYYY-MM-DD)
     - `date:Status Date:is_datetime`: 0
   - **Icon**: 📋
1. **Verify the response.** Confirm the API returned a valid page URL.
   If creation fails (error response or missing URL), present the report
   content in a code block for manual copy-paste and note the failure.
   Do NOT proceed to draft the Slack notification with a broken link.
1. **Page content** must follow this exact structure:

```markdown
## Summary
- **X** active integrations
- **X** recently certified (last 30 days)
- **X** paused / stalled
- **X** with lower activity (🟡)

---

## 📊 Active Integrations
Integrations currently in progress, under certification, or kicked off.

| Partner | Type | Status | Health | Target Date | This Week |
|---|---|---|---|---|---|
| [Name](url) | Type | Status | emoji | date or — | one-sentence summary |

---

## ✅ Recently Certified (Last 30 Days)

| Partner | Type | Certified |
|---|---|---|
| [Name](url) | Type | date |

---

## ⏸️ Paused / Stalled

| Partner | Type | Health | This Week |
|---|---|---|---|
| [Name](url) | Type | emoji | one-sentence summary |

---

## 🟡 Lower Activity
Integrations with less movement or no recent communications.

| Partner | Type | Status | Health | Target Date | This Week |
|---|---|---|---|---|---|
| [Name](url) | Type | Status | emoji | date or — | one-sentence summary |

---

*Report generated on [today] by Dev Support. Source: [Integration Partners Database](https://www.notion.so/16ca84ed40248041bf3dd44210a7b002)*
```

1. If `notion-create-pages` is unavailable, present the report content
   in a code block for manual copy-paste and note the failure.

## Step 9: Draft Slack Notification

Draft a Slack message for the partnerships dev support channel.
Do NOT send it. Use Slack embedded link format: `<url|display text>`.

```text
Hi team! The weekly integration status report has been uploaded:
<[Notion page URL]|📋 Weekly Integration Report — Week of [date]>

Highlights:
• X active integrations ([names closest to completion])
• X recently certified ([names])
• X paused / stalled

Browse all integrations anytime: <https://www.notion.so/thanxwiki/16ca84ed40248041bf3dd44210a7b002?v=334a84ed4024817cb076000c2d6b6d25|Integrations Dashboard>
Let us know if you have any questions!
```

If any count is zero, omit that bullet.
Adjust the highlight names to focus on what's most relevant this week.

## Step 10: Present for Review

Present the following to the user:

1. **Notion page link** — the URL of the created report page
1. **Slack draft** — the message to post, inside a code block
   for easy copy-paste
1. **Data quality notes** — flag any issues found in Step 6:
   - Future certification dates on Done integrations
   - Missing Target Dates (count and list)
   - Missing Kick-Off dates
   - Stale statuses (Kicked-Off but old)
1. **Status Log updates** — for any integration where Front thread
   activity was found but the Notion Status Log is stale, present
   draft Status Log entries (date + summary) for manual paste into
   each partner's Notion page. Link to each page for quick access.

Do not send any Slack message, update any external system, or take
any action beyond creating the Notion page. The Slack message is
draft-only for human review.

## Rules

1. **Never send Slack messages directly.** This command creates the
   Notion report and drafts the Slack notification. The user posts
   manually.
1. **Never label 🟡 as "at risk" or "critical."** The correct
   framing is "lower activity" — it means less movement, not an
   emergency.
1. **Show only active and recent integrations.** Long-certified
   partners (>30 days) do not appear in the report. The report
   answers: what's on track, what's close to GA, what's slipping.
1. **Always include Target Date column.** Even if most are empty,
   the column must appear — it signals the data gap and encourages
   backfilling.
1. **Always include "This Week" column.** Every active integration
   must have a one-sentence summary of what changed. This is the
   most valuable column for stakeholders — they should never need
   to click into a partner page to understand current status.
1. **Kicked-off window is strictly 7 days.** Integrations kicked off
   within the last 7 days should note this in their "This Week"
   summary (e.g., "Kicked off April 3 — scope call completed").
   The main Active Integrations table shows ALL active integrations
   regardless of kick-off date.
1. **All partner names must link to their Notion integration page.**
   Use the page URL from the query results.
1. **Be honest about data gaps.** Surface missing dates and anomalies
   in the data quality section — this helps the team prioritize
   backfilling.
1. **One report per week.** Step 7 checks for an existing report
   before creating. If a duplicate is found, warn the user and
   require confirmation.
1. **Certification date definitions.** Certification Start = first
   review meeting or first build submission for testing.
   Certification Date (end) = when production credentials are
   provided or the integration is posted in #releases.
