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
   - **Integration Status** (select property)
   - **Integration Health** (select — emoji values: 🟢, 🟡, 🔴)
   - **Integration Type** (multi_select property)
   - **Owner** (select — Partner, Merchant, or Thanx)
   - **Kick-Off** (date property)
   - **last_edited_time** (page metadata)
   - **url** (page URL for linking)
1. **Filter out terminal statuses.** Exclude records where
   Integration Status is "Complete", "Archived", or "Cancelled".
   Only active integrations should appear in the report.

If `notion_query_database` is unavailable, report this and stop —
the report cannot be generated without the source data.

## Step 3: Classify Integrations

Using the extracted data, classify each integration into the
following categories:

### New This Week

Integrations where `Kick-Off` date falls within the last 7 days
(on or after the cutoff date).

### Changes This Week

Integrations where `last_edited_time` falls within the last 7 days.
For each, determine what changed:

- If kicked off this week: label as "New — kicked off [date]"
- If Integration Status or Integration Health changed (check
  the page's status log for prior values — Notion queries only return current state): describe the transition
  (e.g., "Health 🟢 → 🟡")
- Otherwise: label as "Record updated" with the edit date

**Note:** `last_edited_time` updates on any property change, including
minor edits. When Integration Status transitions become consistently
populated, prefer those over raw edit timestamps for more precise
change detection.

### Lower Activity

Integrations with Integration Health = 🟡. These are integrations
with less movement or no recent communications — NOT an escalation
signal, just a visibility flag.

**Important:** Do NOT label this section "At Risk", "Critical", or
any alarming language. 🟡 simply means lower activity.

### Paused / No Movement (🔴)

Do NOT create a separate section for 🔴 integrations. These are
known paused integrations. They appear in the "All Active
Integrations" section with their health emoji but do not get called
out separately.

### All Active Integrations

Group all integrations by Integration Type:

- POS
- Ordering
- Marketing
- Custom App
- Kiosk
- Payments
- Data
- Other (Gamification, Segmentation, Merchant UX, etc.)

Each table shows: Partner (linked), Health, Owner, Kick-Off date.

## Step 4: Build Report Summary

The summary section includes exactly three bullet points:

- **X** integration(s) kicked off this week
- **X** integrations with lower activity (🟡)
- **X** integrations with recent movement

Do NOT include total integration count.

## Step 5: Check for Existing Report (Current Week)

Before creating a new report, check for duplicates:

1. Use `notion_query_database` (Keystone MCP) on the Weekly Integration Status
   Tracker (database ID from data_source_id
   `32ea84ed4024809f90e0000b1415bd69`) with a filter on the
   `Name` property containing
   "Week of [Monday date]".
1. If a matching page exists, warn the user and ask for confirmation
   before creating a duplicate.
1. If no match exists, proceed to Step 6.

## Step 6: Create Notion Report Page

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
- **X** integration(s) kicked off this week
- **X** integrations with lower activity (🟡)
- **X** integrations with recent movement

---

## 📈 Changes This Week
Integrations with activity since [cutoff date].

| Partner | Type | Health | What Changed |
|---|---|---|---|
| [Name](url) | Type | emoji | Description |

---

## 🟡 Lower Activity
Integrations with less movement or no recent communications.

| Partner | Type | Owner | Kick-Off |
|---|---|---|---|
| [Name](url) | Type | Owner | date or — |

---

## 📊 All Active Integrations

### [Type]
| Partner | Health | Owner | Kick-Off |
|---|---|---|---|
| [Name](url) | emoji | Owner | date or — |

[Repeat for each type that has integrations]

---

*Report generated on [today] by Dev Support. Source: [Integration Partners Database](https://www.notion.so/16ca84ed40248041bf3dd44210a7b002)*
```

1. If `notion-create-pages` is unavailable, present the report content
   in a code block for manual copy-paste and note the failure.

## Step 7: Draft Slack Notification

Draft a Slack message for the partnerships dev support channel.
Do NOT send it.

```text
Hi team! The weekly integration status report has been uploaded to Notion:
[Notion page URL from Step 6]

Highlights:
• X new integration(s) kicked off ([names])
• X integrations with lower activity ([names])
• X integrations with recent movement

Full details with links to each integration record are in the report.
Let us know if you have any questions!
```

If no integrations were kicked off this week, omit that bullet.
Adjust the other bullets similarly if counts are zero.

## Step 8: Present for Review

Present the following to the user:

1. **Notion page link** — the URL of the created report page
1. **Slack draft** — the message to post, inside a code block
   for easy copy-paste
1. **Data quality notes** — flag any issues found:
   - Integration Status empty for records (common — this field is
     not consistently populated yet)
   - Missing Kick-Off dates
   - Missing Health values

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
1. **Never create a separate section for 🔴 integrations.** Red
   health means paused/known — they appear in the full list but
   don't get called out.
1. **Kicked-off window is strictly 7 days.** Only integrations with
   a Kick-Off date in the last 7 calendar days appear in the "new"
   count and the Changes table.
1. **Changes are based on `last_edited_time`.** Until Integration
   Status is consistently populated, this is the best proxy for
   movement. When status transitions become available, the
   "What Changed" column should show actual transitions
   (e.g., "Kicked Off → In Progress", "Health 🟢 → 🟡").
1. **All partner names must link to their Notion integration page.**
   Use the page URL from the query results.
1. **Be honest about data gaps.** If Integration Status is empty
   across all records, note it in the data quality section — this
   helps the team prioritize backfilling.
1. **One report per week.** Step 5 checks for an existing report
   before creating. If a duplicate is found, warn the user and
   require confirmation.
