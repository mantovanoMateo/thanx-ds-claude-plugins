---
description: Triage an inbound partner support ticket - classify by Front tag, apply routing rules, check known issues, and draft a response.
---

# Triage Partner Support Ticket

Triage an inbound partner support request: classify, check for known issues, apply routing rules, and draft a response.

## Usage

```bash
/ds:triage <ticket_url_or_description>
```

**Required:**

- `ticket_url_or_description` - A Front conversation URL, Jira ticket URL
  (BUGS-*, DEVSUPP-*), or free-text description of the issue

---

You are executing the `/ds:triage` command.

## Step 1: Parse Input

Arguments: $ARGUMENTS

Determine the input type:

- **Front conversation URL:** Extract the conversation ID. Fetch using the Front MCP tool (`front_get_conversation`, `front_list_messages`).
- **Jira URL:** Extract the issue key (e.g., BUGS-1234). Fetch the issue using the Jira MCP tool (`jira_get_issue`).
- **Free-text:** Treat as the raw issue description. Ask the user for the partner/merchant name if not obvious.

Extract:

- Partner or merchant name
- Issue description
- Error messages or logs (if present)
- Integration involved (POS system, ordering platform, custom app, etc.)
- Reporter and date
- Front conversation link (if available)

If input cannot be parsed:

> Error: Could not parse the input. Please provide a Front conversation URL, Jira URL, or a description of the issue.

## Step 2: Classify by Front Tag

Based on the extracted information, classify the ticket using the exact Front tag categories:

| Front Tag | When to Use |
|-----------|-------------|
| API Support | API-related tickets - endpoint usage, authentication, payload questions |
| Third-Party Integration | Issues with integrating third-party services (Olo, Toast, Square, Shift4, etc.) |
| Bug | Issues in Thanx software that need investigation and potential fix |
| Certification Process | Tickets related to the ongoing certification process |
| Credentials | Credentials resend, sandbox access requests, production credentials after certification |
| Feature Request | New functionalities requested by customers |
| General Issue | Configuration issues, platform usage questions, segment validations |

## Step 2.5: Partner Lookup (Notion Integration Awareness)

After classification, check if this partner has an existing Notion integration record and take the appropriate action.

### 2.5a: Query Notion Integration Partners DB

Search the Integration Partners Database for the partner name extracted in Step 1:

- Use `notion-query-database` with database ID `16ca84ed40248041bf3dd44210a7b002`
- Filter by partner/merchant name (use a contains filter on the Name property)
- If multiple results match, pick the closest match by name

### 2.5b: Existing Partner — Update Status Log

If a matching Notion integration record is found, update it regardless of ticket type.
Bug tickets, credential requests, and other non-integration tags still warrant a
status log entry — it keeps the partner's timeline complete.

1. Read the existing page content to locate the Status Log section
2. Prepare a new status log entry:

```text
**[YYYY-MM-DD]** — New support ticket triaged ([Front tag classification]).
Ticket: [DEV-XXXX or ISS-XXXX](Front conversation link).
Summary: [1-sentence issue summary from Step 1].
```

1. **Present the proposed status log update to the user for confirmation before writing.**
1. On approval: append the entry to the Status Log toggle section using `notion-update-page`
1. Note the Notion record link in the triage summary (Step 9)

### 2.5c: New Partner — Suggest Record Creation

If no matching Notion integration record is found AND the Front tag is one of:

- API Support
- Third-Party Integration
- Certification Process

Then:

1. Flag this in the triage output:

```text
⚠ No Notion integration record found for [partner name].
This ticket is integration-related ([Front tag]) — consider creating a record.
→ Run: /ds:integration-record [partner name]
```

1. Do NOT create the record automatically — suggest the command and let the user decide.

If the Front tag is NOT integration-related (Bug, Credentials, Feature Request, General Issue), skip this step silently.

### 2.5d: Update Local Partner File

If `partners/[name].md` exists in the Second Brain repository:

1. Read the current file content
2. Update the latest ticket status section with:
   - Ticket reference (DEV-XXXX or ISS-XXXX)
   - Classification (Front tag)
   - Date triaged
   - 1-sentence summary
3. **Present the proposed local file update to the user for confirmation before writing.**

If no local partner file exists, skip this step silently.

## Step 3: Apply Routing Rules

Determine whether Dev Support handles this or it needs escalation, following the Developer Support Routing Guide:

**Dev Support handles directly:**

- General platform usage questions
- Segment validations (when routed in Front)
- Facebook Pixel / third-party SDK troubleshooting (investigation and merchant follow-up)
- Google Tag Manager / Google Analytics issues (investigation and merchant follow-up)
- API integration guidance
- Access or permission issues
- Sandbox and production credential provisioning
- Certification process management

**Dev Support escalates to Engineering (only when code-level changes are required):**

- Platform usage questions requiring code changes
- Pixel/SDK issues requiring code changes
- GTM/GA issues requiring code changes
- API service down or returning errors requiring backend fixes

**Dev Support does NOT handle (redirect to proper process):**

- Bug reports from merchants - they should follow the bug process
- Feature requests or enhancements - they should follow the process
- Data discrepancies or reporting issues - reporter should create a bug
- Platform outages or critical incidents - reporter should create a critical bug

## Step 4: Apply Custom App Philosophy

If the ticket involves a partner who built their own app/UX, apply this framework:

> When a merchant or agency builds their own UX, they are responsible for
> integrating with Thanx APIs in a way that delivers the full loyalty
> experience. We provide the building blocks (APIs), not the full system.

**Our responsibility:**

- Ensure our APIs work as documented
- Provide guidance on how to use our APIs to support a loyalty experience
- Support feature requests only when our APIs are insufficient

**Not our responsibility:**

- Supporting or debugging third-party app behavior or delivery logic (APNs, Firebase)
- Investigating SMS or Push notification deliverability when we do not control the app
- Acting as a proxy for partner integrations outside our scope

**Validation check:** If our API sent the request successfully and returned the
expected response, our job is done. The partner owns everything downstream.

## Step 5: Check Known Issues

Search for related context across available tools:

1. **Jira BUGS project:** Search for similar recent issues using the Jira MCP
   (`jira_search_issues`). Look for same partner, error, or integration in the last 90 days.
2. **Keystone Knowledge:** Use `knowledge_search` to check if this issue pattern has been documented.
3. **Thanx Docs:** Use `SearchThanx` to find relevant API documentation.
4. **Sentry:** If error messages are present, search Sentry for matching exceptions using `sentry_issues`.
5. **Datadog:** If the issue involves API failures or timeouts, check recent logs using `datadog_logs`.

For each source, note:

- Whether a match was found
- Link to the matching issue/entry
- Whether it was resolved (and how)

## Step 6: Handle Bug Detection

If the issue is confirmed as a software bug (not configuration, not partner-side):

1. Guide the user to create a Jira bug in the BUGS project using the bug template
2. Suggest the #triage Slack message using this template:

```text
Hi team, I've created a bug ticket regarding an issue at
[merchant/location] where [describe impact on merchant/partner].
[Give details about the issue with facts.
Describe how this bug is affecting the merchant.]
Let me know if you have any questions or need further information.
[Jira link]
```

1. For critical bugs, direct to #triage-critical-bug instead

## Step 7: Draft Response

Based on classification, routing decision, and known issue search, draft a response.

**Response rules:**

- Professional and friendly tone
- Be specific about what is known and what is being investigated
- Include a timeline commitment based on SLAs:
  - Initial response: within 1 business day (24 hours)
  - Certification feedback: within 2 weeks
  - Escalation to engineering: feedback within 48 hours
- If a known fix exists, include it
- If escalation is needed, state what is being escalated and to whom
- Do not make commitments about fixes or timelines that require engineering approval
- If the issue is outside our scope (custom app philosophy), politely redirect with documentation links

**Response format:**

```text
Hi [Partner Contact],

[Acknowledgment of the issue in 1-2 sentences]

[What we know so far / what we found]

[Next steps with timeline]

Best regards
```

## Step 8: Suggest Slack Status

Suggest the emoji for the #developer-support-tickets Slack thread:

- **Taking a look** - use the eyes emoji
- **Waiting for response** - use the envelope emoji
- **Solved** - use the checkmark emoji

## Step 9: Report Summary

Present to the user:

```text
Triage Summary
--------------
Partner/Merchant: {name}
Front Tag: {API Support | Third-Party Integration | Bug | Certification Process | Credentials | Feature Request | General Issue}
Routing: {DS handles | Escalate to Eng | Redirect to process}
Integration: {integration if applicable}

Notion Integration Record: {Found — [link] | Not found | N/A}
Status Log Updated: {Yes (pending confirmation) | Skipped — no record}
Local Partner File: {Updated (pending confirmation) | Not found | N/A}

Known Issues Found: {count}
{list of links if any}

Custom App Philosophy Applies: {Yes/No}

Draft Response:
{response text}

Suggested Actions:
- [ ] {action 1 - e.g., "Assign ticket in Front"}
- [ ] {action 2 - e.g., "React with eyes emoji in #developer-support-tickets"}
- [ ] {action 3 - e.g., "Approve Notion status log update" — if applicable}
- [ ] {action 4 - e.g., "Approve local partner file update" — if applicable}
- [ ] {action 5 - e.g., "Run /ds:integration-record [partner]" — if new integration partner}
```

Do not send any message, update any ticket, or post to Slack. Present everything for human review and approval.
