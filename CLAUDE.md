# Development Guidelines

## Plugin Structure

```text
plugins/ds/
  .claude-plugin/plugin.json   # Plugin manifest
  commands/*.md                # Slash commands
  agents/*.md                  # Agents (launched via Task() from commands)
  skills/*/SKILL.md            # Knowledge bases
```

## Writing Commands

- Every command file must start with YAML frontmatter containing a `description` field
- Use numbered steps (## Step 1, ## Step 2, etc.)
- Reference `$ARGUMENTS` to access user input
- Keep each step deterministic and measurable
- Commands must be safe - no destructive actions without confirmation
- Prefer wrapping existing MCP tools and integrations over building from scratch

## Writing Agents

- Frontmatter must include `description` and `capabilities`
- Define clear input/output contracts
- Include "When to Use This Agent" and "Process" sections

## Writing Skills

- One directory per skill, with a `SKILL.md` inside
- Skills are reference material, not executable workflows
- Keep content factual and up to date

## MCP Access

Commands can use these MCP tools:

- **Front:** Partner conversation search, message history, ticket status
- **Jira:** Ticket lookup, search, status updates (BUGS-*, DEVSUPP-*)
- **Keystone:** Knowledge search, Datadog logs, Sentry issues, Snowflake queries
- **Thanx Docs:** API documentation search
- **Notion:** Documentation search, page creation
- **Slack:** Channel notifications (gated - draft only, human sends)

## Testing

Run `npm test` before every PR. Tests validate:

- JSON schema correctness (`.mcp.json`, `plugin.json`, `marketplace.json`)
- YAML frontmatter presence on commands and agents
- Markdown structure (title heading, no trailing whitespace, no consecutive blank lines)
- Link validity (internal and external)

## Versioning

Update the version in `plugins/ds/.claude-plugin/plugin.json` when merging changes.
Follow semver: patch for fixes, minor for new commands/agents/skills, major for breaking changes.
