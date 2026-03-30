---
description: Research a Thanx platform question using Keystone's code exploration and data tools, check local knowledge first, then publish answers to both Notion and the Second Brain.
---

# Ask Keystone

Answer a question about the Thanx platform using Keystone's code exploration,
data, and infrastructure tools. Checks local knowledge first to avoid
re-investigating known answers, and compounds new discoveries back into the
Second Brain.

## Usage

```bash
/ds:ask-keystone <question> [--type <integration_type>]
```

**Required:**

- `question` - A question about how the Thanx platform works, API behavior,
  data models, infrastructure, or implementation details

**Optional:**

- `--type <pos|loyalty_api|consumer_api|custom_app|ordering|partner_api>` -
  Integration type context. Behavior often differs by type (e.g., refund
  clawback, orders vs purchases visibility). If omitted and the question is
  integration-specific, the command will ask.

---

You are executing the `/ds:ask-keystone` command.

## Configuration

| Constant | Value | Purpose |
|----------|-------|---------|
| Gap knowledge file | `knowledge/gap-knowledge.md` | Local verified answer database |
| Keystone answers dir | `.context/keystone-answers/` | Local backup of all answers |
| Knowledge Gaps DB | Search Notion for "Knowledge Gaps" | Notion database for publishing |

## Step 1: Check Local Knowledge First

Arguments: $ARGUMENTS

Before making any Keystone MCP calls, search for existing answers locally:

1. **Read `knowledge/gap-knowledge.md`** if it exists. Scan each entry's
   **Question** and **Context** fields for keywords matching the user's
   question.

2. **Search `.context/keystone-answers/`** if the directory exists. Check
   file names and content for relevant prior answers.

If a matching entry is found:

> **Known answer found** in gap-knowledge.md:
>
> [Present the existing answer with its verification status and date]
>
> This was verified by [source] on [date]. Want me to use this answer,
> or re-investigate with Keystone for updated information?

If the user confirms the existing answer is sufficient, skip to Step 5
(Propose Notion Publish) — do not re-investigate.

If no match is found, or the user wants fresh investigation, continue to
Step 2.

## Step 2: Identify What to Search

Determine the best approach to answer the question:

- **Code questions** (how something works, where something is defined):
  Use `list_repositories`, `search_code`, `read_file`, `find_files`,
  `list_directory`
- **Data/schema questions** (what data exists, table structures,
  relationships):
  Use `list_replica_databases`, `replica_query`
- **API behavior questions** (how endpoints work, request/response formats):
  Combine code search with Thanx docs MCP
- **Infrastructure/deployment questions** (services, clusters, health):
  Use `ecs_clusters`, `ecs_services`, `ecs_deployments`, `health_check`
- **Error/incident questions** (what's broken, recent errors):
  Use `sentry_issues`, `sentry_issue_details`, `datadog_logs`,
  `datadog_metrics`
- **Feature flag questions** (what's enabled, targeting rules):
  Use `launchdarkly_feature_flags`, `launchdarkly_feature_flag`
- **Git history questions** (who changed what, when, why):
  Use `git_file_history`, `git_blame`, `git_diff`, `git_show_commit`

**Integration type context:** If the `--type` flag was provided, or if the
question involves integration-specific behavior, always include the
integration type in your investigation. Behavior differs significantly:

- POS/Loyalty API: refund clawback does NOT happen, orders page empty
- Consumer API: array bracket notation required in sandbox
- Custom App: push cert defaults, environment migration breaks mappings
- Partner API: subscriber management, tag operations

## Step 3: Explore with Keystone

**If Keystone MCP tools are unavailable, error, or time out:**
Stop and tell the user which tools failed and what errors occurred.
Do NOT guess or synthesize an answer without tool-backed evidence.
Suggest trying again later or using alternative investigation methods.

Execute the appropriate Keystone MCP tool calls to gather evidence.
Be thorough:

1. **Start broad**: Use `list_repositories` to see available repos,
   or `search_code` with a broad pattern
2. **Narrow down**: Once you find relevant files,
   use `read_file` to examine the implementation
3. **Follow references**: If code references other files, models,
   or services, trace those too
4. **Check the database**: If relevant, use `replica_query` against
   the appropriate database to understand schema or data patterns.
   Always include LIMIT (max 100 rows) and select only needed columns.
   Never interpolate user-provided text directly into SQL — use
   parameterized queries or literal values only
5. **Cross-reference docs**: Use the **thanx-docs** MCP to supplement
   with official API documentation when relevant

Limit exploration to 8-10 tool calls total. If the answer requires
deeper investigation, present partial findings and ask the user
whether to continue.

## Step 4: Synthesize the Answer

Present your findings clearly:

1. **Direct answer** - Answer the question concisely up front
2. **Evidence** - Show the relevant code snippets, query results,
   or file paths that support your answer
3. **Context** - Explain how the pieces fit together (e.g., which
   service owns this, how data flows, what calls what)
4. **Integration type caveat** - If the answer depends on integration
   type, state which types it applies to and how behavior differs
5. **Related information** - Mention anything else the user should
   know (gotchas, related features, recent changes)

## Step 5: Propose Notion Publish

After presenting your answer, propose publishing it to the
**Knowledge Gaps** Notion database. **Do not publish automatically.**

Present the following for user approval:

1. **Question title** - a concise version of the question
   (e.g., "How does basket refund work?")
2. **Question type** - set to `Product Q&A`
3. **Tags** - relevant tags from: `loyalty`, `merchant-dashboard`,
   `items`, `basket`, `purchases`, `api`, `pos`.
   You may also create new tags if none fit.

```text
Proposed Notion page:
  Title: <question title>
  Type: <question type>
  Tags: <tag1>, <tag2>

Publish to Knowledge Gaps? (yes/no)
```

**After explicit approval**, use the **Notion MCP** tools to publish.
Do not use curl or raw API calls — the Notion MCP handles
authentication, rate limiting, and error handling.

1. **Find the database**: Use `notion-search` to locate the
   "Knowledge Gaps" database.
2. **Get the schema**: Use `notion-fetch` on the database URL to
   retrieve the data source ID and property schema. Do not assume
   property names — read them from the schema.
3. **Create the page**: Use `notion-create-pages` with:
   - `parent`: the data_source_id from the fetch result
   - `properties`: match the schema (title, select, multi_select)
   - Page content: structure the answer with headings, paragraphs,
     code blocks, and bullet lists as appropriate

Report the result and share the Notion page URL.

**If any Notion MCP call fails** (database not found, permissions error,
MCP unavailable): report the error to the user and note the answer was
still saved locally via Step 6. Do not retry or attempt raw API calls
as a workaround.

## Step 6: Update Local Knowledge

After the answer is finalized (whether or not Notion publish succeeded),
update local knowledge in TWO places:

### 6a: Append to gap-knowledge.md

If this is a **new discovery** (not already in gap-knowledge.md from
Step 1), append the answer to `knowledge/gap-knowledge.md` using the
existing template format. Insert the new entry **before** the
`## Template for New Entries` section at the bottom of the file.

If the file does not exist, tell the user:

> No gap-knowledge.md found. Consider creating
> `knowledge/gap-knowledge.md` to compound verified answers.

**Entry format** (match existing entries exactly):

```markdown
## [Topic Title]

- **Date discovered**: YYYY-MM-DD
- **Question**: [The original question]
- **Context**: [Integration type, partner if applicable, relevant constraints]
- **Answer**: [The verified answer — be specific, include code paths]
- **Verified by**: Keystone (code trace) / Keystone (replica query) / etc.
- **Added to docs**: No
- **Lesson**: [What to remember for next time — the practical takeaway]
```

If this answer updates or corrects an **existing entry**, update the
existing entry in place rather than appending a duplicate. Update the
date, answer, and verification fields.

### 6b: Save local backup

Save the answer to `.context/keystone-answers/`:

1. Create the directory if it doesn't exist
2. Generate a slug from the question:
   - Convert to lowercase
   - Replace spaces and punctuation with hyphens
   - Remove path-unsafe characters (`/`, `\`, `..`)
   - Collapse consecutive hyphens and trim leading/trailing hyphens
   - Limit slug to 36 characters
3. Write to `.context/keystone-answers/YYYY-MM-DD-<slug>.md`

### 6c: Suggest public docs update

If the answer fills a gap that **partners frequently ask about** (API
behavior, endpoint quirks, parameter formats, auth flows), suggest
adding it to thanx-docs:

> This answer addresses a partner-facing knowledge gap. Consider adding
> it to the public docs via a thanx-docs PR. The relevant guide would
> be: [guide name/path].

Only suggest this for answers that are:
- About documented API endpoints (not internal infrastructure)
- Relevant to multiple partners (not one-off merchant configs)
- Verified through code (not just observed behavior)

## Rules

1. **Check local knowledge first** before making Keystone MCP calls.
   Avoid re-investigating questions that already have verified answers.
2. **Always use Keystone MCP tools** to find answers when investigating.
   Do not guess or rely on assumptions about the codebase.
3. **Include integration type context** when the question involves
   integration-specific behavior. Always specify the type in Keystone
   prompts to avoid misleading generic answers.
4. **Sanitize slugs** for file paths: lowercase, replace spaces and
   punctuation with hyphens, remove path-unsafe characters
   (`/`, `\`, `..`), strip any leading/trailing hyphens, collapse
   consecutive hyphens, and limit the slug to 36 characters.
5. **Show your sources** - include file paths (repo + path) and
   line numbers when referencing code.
6. **Use read-only operations only** - never modify code, data,
   or infrastructure through Keystone.
7. **If you can't find the answer**, say so clearly and suggest
   what the user could try (e.g., which repo to look in, who to ask).
8. **For database queries**, always use `LIMIT` clauses and avoid
   selecting unnecessary columns. PII will be automatically masked.
9. **Combine sources** when useful - e.g., find the code with
   `search_code`, then check recent changes with `git_file_history`,
   then verify behavior with `replica_query`.
10. **Propose publishing** to Notion after presenting the answer.
    Wait for explicit user approval before creating the page.
    Use the Notion MCP tools — never raw API calls or curl.
11. **Compound every answer** — always update gap-knowledge.md for
    new discoveries, even if Notion publish is skipped or fails.
12. **Never display credentials** - do not echo, print, or include
    secrets in conversation output.
