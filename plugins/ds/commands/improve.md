---
description: End-of-session compounding improvement loop. Capture learnings, patch commands/skills, and leave the DS plugin better for the next session.
---

# Session Improvement Loop

Capture what this session taught, patch what can be improved, and leave the
Dev Support plugin measurably better for the next session.

**Philosophy:** Small bets, high frequency. Each /ds:improve run compounds. Do not batch improvements - apply them now.

## Step 1: Session Audit

Review the full conversation and identify:

1. **Commands used** - Which `/ds:` commands, MCP tools, or workflows were invoked?
2. **What worked** - Fast paths, good outputs, useful patterns
3. **Friction points** - Where did the session slow down, require retries, or produce wrong output?
4. **Missing capabilities** - What did the user ask for that required manual work instead of a command?
5. **Incorrect assumptions** - What did the agent get wrong about context, partner info, or workflows?
6. **Technical discoveries** - New API behaviors, Front quirks, Jira patterns, MCP limitations, or platform patterns learned

Present findings as a structured table:

```text
| Category | Finding | Action |
|----------|---------|--------|
| Friction | Had to re-explain X context | Add to CLAUDE.md contextual rules |
| Missing  | No command for Y workflow   | Propose new /ds:Y command |
| Pattern  | Z technique worked well     | Capture in skill file |
```

## Step 2: Classify Improvements

Sort each proposed improvement by target:

| Target | File(s) | When to Apply |
|--------|---------|---------------|
| Plugin commands | `plugins/ds/commands/*.md` | New or improved `/ds:` commands |
| Plugin skills | `plugins/ds/skills/` | Knowledge bases for partner integrations, API patterns, troubleshooting |
| Plugin agents | `plugins/ds/agents/*.md` | New specialized agents |
| CLAUDE.md rules | `CLAUDE.md` | New workflow patterns, guardrails, or contextual triggers |
| Plugin README | `plugins/ds/README.md` | Updated command table or documentation |
| Memory files | `~/.claude/projects/.../memory/` | Debugging insights, platform patterns, stable conventions |

## Step 3: Propose Changes

For each improvement, show the exact diff:

```text
### Target: <file_path>
**Why:** <one sentence explaining the improvement>
**Type:** New | Patch | Restructure

[Show the before/after or addition as a diff block]
```

**Rules:**

- Prefer small, targeted patches over large rewrites
- If the same file keeps getting patched, flag it for restructuring
- Every proposed change must include: what changes, why it helps future sessions
- New commands must follow the plugin structure (YAML frontmatter with description, numbered steps)

## Step 4: Apply (With Approval)

Present all proposed changes as a numbered list. Wait for explicit approval before applying.

Format:

```text
## Proposed Improvements (N changes)

1. [plugins/ds/commands/triage.md] Add handling for X edge case
2. [plugins/ds/skills/api-patterns/SKILL.md] New skill: common API integration patterns
3. [CLAUDE.md] Add contextual rule for Y workflow
4. [plugins/ds/README.md] Update command table

Apply all? Or specify numbers to apply (e.g., "1,2,4"):
```

After approval, apply using Edit tool. Preserve existing content structure. Show confirmation for each applied change.

## Step 5: New Command Detection

Check if any repeated pattern from this session (or across recent sessions) should become a new `/ds:` command.

**Threshold test - all must be true:**

- [ ] The pattern is repeatable (not a one-time operation)
- [ ] It's non-trivial (saves >2 minutes per invocation)
- [ ] It's self-contained (can run without extensive setup context)
- [ ] It doesn't duplicate an existing command (`/ds:triage`, etc.)
  or a main plugin command (`/investigate`, `/review`, etc.)

If a new command passes the threshold, draft the `plugins/ds/commands/<name>.md` file and include it in the proposed changes.

## Step 6: Knowledge Capture

Write durable knowledge to the appropriate location:

- **Partner integration patterns** - How specific partners (Toast, Olo, Square) integrate, common failure modes
- **API quirks** - Endpoint behaviors not in docs, edge cases discovered during troubleshooting
- **Debugging shortcuts** - Fastest path to diagnose common issues (Datadog queries, Sentry filters, Jira searches)
- **Playbook gaps** - Issues encountered that don't have a Notion playbook yet (flag for Notion update)
- **Front workflow patterns** - Effective tagging, status management, response templates

Knowledge should be concise. One pattern per entry. Include the date and source.

## Step 7: Session Summary

Output a brief summary:

```text
## /ds:improve Summary

**Session focus:** [What this session accomplished]
**Changes proposed:** N
**Changes applied:** N
**New commands proposed:** N
**Knowledge captured:** N entries

**Compounding impact:** [One sentence on how these changes make future sessions better]
```

---

## Important Notes

- This command reads the FULL conversation history to extract learnings
- Changes to plugin files follow the existing structure (frontmatter, numbered steps)
- New commands are created in `plugins/ds/commands/` directory
- All external communications remain gated (draft-only) per autonomy guardrails
- If past improvements aren't helping, flag them for revert - don't patch forever
- After applying changes, remember to bump the version in `plugins/ds/.claude-plugin/plugin.json`
