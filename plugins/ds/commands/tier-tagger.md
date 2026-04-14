---
description: Auto-tag Front conversations with partner tier and merchant tier tags. Supports single-conversation mode (for inline use during ticket workflows) and inbox-wide scan mode.
---

# Tier Tagger

Tag Front conversations with partner tier (Tier 1/2/3) and merchant tier (Gold/Spearmint/Platinum) based on Notion and Salesforce data. Run on a single conversation while working a ticket, or scan the full inbox for missing tags.

## Usage

```bash
/ds:tier-tagger                    # Dry run — scan inbox, show what would be tagged
/ds:tier-tagger --apply            # Apply tags across inbox
/ds:tier-tagger <CNV_ID>           # Tag a single conversation (auto-applies)
/ds:tier-tagger <CNV_ID> --dry-run # Preview tags for a single conversation
```

**Modes:**

- **Inbox scan** (no conversation ID): scans all open + waiting conversations. Dry run by default.
- **Single conversation** (conversation ID provided): tags just that one conversation. Auto-applies by default (skip dry run since you are already working the ticket).

**Optional flags (append to arguments):**

- `--apply` — actually apply tags in inbox scan mode (default is dry run)
- `--dry-run` — preview only in single-conversation mode (default is apply)
- `--limit N` — max conversations to scan in inbox mode (default 100)

---

You are executing the `/ds:tier-tagger` command.

Arguments: $ARGUMENTS

## Step 1: Determine Mode

Parse the arguments:

1. Check if any argument matches the pattern `cnv_*` (a Front conversation ID). If found, set **single-conversation mode** with that ID.
2. In **single-conversation mode**: default to **apply** unless `--dry-run` is present.
3. In **inbox scan mode** (no conversation ID): default to **dry run** unless `--apply` is present.
4. If `--limit N` is present (inbox mode only), use that limit. Otherwise default to 100.

## Step 2: Pre-fetch Reference Data (Query Once, Reuse Everywhere)

Before scanning conversations, build lookup caches to avoid per-conversation API calls.

### 2a: Partner Names and Tiers from Notion

Query the Integration Database **once** to get all partner records:

Use `notion_query_database` with database ID `16ca84ed40248041bf3dd44210a7b002`. **Handle pagination:** Notion returns at most 100 records per page. If the response includes `has_more: true` and a `next_cursor`, issue follow-up queries with `start_cursor` until all records are fetched.

Extract from each record:

- **Partner name** (title property)
- **BD Tier** rollup value (if populated)

Store as a `partner_cache` map: `{ "Kea AI": "2", "Grubbrr": "1", ... }`.

### 2b: Partner Tier Fallback from Notion Partners DB

For any partners where BD Tier was empty in Step 2a, query the Partners Database at `df2c5a6e-5a75-42f5-8985-3fc35899a22b` for the **BD Tier** or **Tier** select property. Merge results into `partner_cache`.

### 2c: Local Mapping Fallback

If either Notion query fails or returns incomplete data, locate the local fallback file `data/tier-mappings.json`. Search for it in these locations (in order):

1. `./data/tier-mappings.json` (current working directory)
2. The directory containing the user's Second Brain repo (check for a `CLAUDE.md` file with "Second Brain" in it — the `data/` folder is a sibling)
3. `~/miami/data/tier-mappings.json`

**Do NOT hardcode personal workspace paths.** Discovery must work for any team member.

If found, load `partner_tiers` into `partner_cache` (only for partners not already cached) and `partner_aliases` for domain/name lookups. Also load `merchant_tiers` into a `merchant_cache` map for use in Step 6.

If no local file is found, report a warning and continue with whatever data was fetched from Notion.

## Step 3: Fetch Conversations

### Single-conversation mode

If a conversation ID was provided in Step 1, fetch that single conversation using `front_get_conversation` with the conversation ID. Extract the same fields listed below and skip to Step 4.

### Inbox scan mode

Search the Developer Support inbox for conversations that need tagging.

Run TWO Front searches (one for each status). Each search uses the full `--limit` value; deduplication and truncation happen after combining:

1. `front_search_conversations` with query: `inbox:inb_ghgim is:open` (limit from Step 1)
2. `front_search_conversations` with query: `inbox:inb_ghgim is:waiting` (limit from Step 1)

If either search returns paginated results (check for `_pagination.next`), follow pagination links to fetch all pages up to a safety limit of 5 pages per search.

Combine results into a single list. **Deduplicate by conversation ID** — a conversation may appear in both searches if its status changed between calls.

Sort the combined list by `last_message_at` descending (most recently updated first) — Front search results may not arrive pre-sorted. If the sorted list exceeds the `--limit` value, truncate to the limit.

### For each conversation, extract:

- Conversation ID
- Subject
- Contact email (from recipient handle)
- Existing tag names and tag IDs

## Step 4: Identify Missing Tags

Use these tag ID sets to check what each conversation already has:

**Partner Tier tags** (under Developer Support folder `tag_5gkgwu`):

| Tag Name | Tag ID |
|----------|--------|
| Partner Tier 1 | `tag_689fku` |
| Partner Tier 2 | `tag_689foe` |
| Partner Tier 3 | `tag_689fq6` |
| Partner Tier - Not Yet Determined | `tag_689ftq` |

**Merchant Tier tags** (under CSM Tier folder `tag_1rhzpn`):

| Tag Name | Tag ID |
|----------|--------|
| Platinum | `tag_1ssaq3` |
| Gold | `tag_1rhzrf` |
| Spearmint | `tag_1rhzt7` |

For each conversation:

- **Has partner tier?** — check if any of the 4 partner tier tag IDs are present
- **Has merchant tier?** — check if any of the 3 merchant tier tag IDs are present

Skip conversations that already have both tags.

## Step 5: Identify Partner

For conversations missing a partner tier tag, identify the partner using this strategy (in order):

### 5a: Contact Email Domain

Extract the domain from the contact email. Match against known partner domains:

| Domain | Partner |
|--------|---------|
| `grubbrr.com` | Grubbrr |
| `shift4.com` | Shift4 |
| `kea.ai` | Kea AI |
| `onosys.com` | Onosys |
| `tabit.cloud` | Tabit |
| `bikky.com` | Bikky |
| `attentive.com` | Attentive |
| `marqii.com` | Marqii |
| `sundayapp.com` / `sunday.de` | Sunday |
| `cardfree.com` / `card-free.com` | Card-Free |
| `scrollmark.com` | ScrollMark |
| `momos.io` | Momos |
| `ovationup.com` | Ovation |
| `klaviyo.com` | Klaviyo |
| `franpos.com` | FranPos |
| `tattle.co` | Tattle |
| `bite.com` | Bite |
| `upngo.com` | Up n Go |
| `3owl.com` | 3Owl |
| `ingest.ai` | Ingest AI |
| `getpokehouse.com` | PokeHouse |

**Primary source for domain lookups:** Use `partner_aliases` from the local mapping file (loaded in Step 2c). The hardcoded table above is a bootstrap fallback — the local mapping file is the maintained source and may contain domains not listed here.

### 5b: Subject Line Match

Search the subject line for known partner names from the `partner_cache` built in Step 2.

### 5c: Existing Tags

Check if any existing tag name matches a known partner name from the `partner_cache`.

If no partner is identified, the conversation may be merchant-only (no partner tier needed). Do NOT tag it as "Not Yet Determined" — skip partner tagging entirely.

> **Important distinction:** "No partner identified" (Step 5 fails) = skip tagging. "Partner identified but tier unknown" (Step 6 cache miss) = tag as "Not Yet Determined." These are different outcomes.

## Step 6: Look Up Partner Tier

For identified partners, look up the tier from the `partner_cache` built in Step 2. **Do NOT query Notion again per partner** — all tier data was pre-fetched.

If a partner is not in the cache, tag as **Partner Tier - Not Yet Determined** (`tag_689ftq`).

Map the tier value to a tag ID:

| Tier | Tag ID |
|------|--------|
| 1 (or "Tier 1") | `tag_689fku` |
| 2 (or "Tier 2") | `tag_689foe` |
| 3 (or "Tier 3") | `tag_689fq6` |
| Unknown | `tag_689ftq` |

## Step 7: Identify and Look Up Merchant Tier

For conversations missing a merchant tier tag:

### 7a: Identify Merchant

1. Check existing conversation tags for names matching known Thanx merchants
2. Search the subject line for merchant names
3. Match the contact email domain against merchant names — normalize both the domain (strip TLD, replace hyphens/dots with spaces) and the merchant name (lowercase, strip punctuation) and check if the normalized domain is a substring of the normalized merchant name. Only accept matches where the domain portion is at least 4 characters to avoid false positives. **Exclude generic prefixes** that pass the length check but are not merchant names: `info`, `mail`, `help`, `team`, `hello`, `admin`, `support`, `contact`.

### 7b: Batch Look Up Merchant Tiers in Salesforce

After identifying merchants across ALL conversations, **collect the unique merchant names** and issue a single batched Salesforce query:

```sql
SELECT Name, Customer_Success_Tier__c FROM Account WHERE Name IN ('Merchant A', 'Merchant B', 'Merchant C') LIMIT 200
```

**Important:** Sanitize merchant names before interpolation — escape single quotes by doubling them (e.g., `O'Brien` → `O''Brien`) and strip any characters outside `[a-zA-Z0-9 '.&-/]`. **Log a warning** when sanitization alters a name so misses are debuggable (e.g., `"Sanitized: 'Cafe Lua' -> 'Caf La'"`).

If the unique merchant list exceeds 50 names, split into batches of 50 and issue multiple queries.

If the query returns a match, map the tier to a tag ID:

| CS Tier | Tag ID |
|---------|--------|
| Platinum | `tag_1ssaq3` |
| Gold | `tag_1rhzrf` |
| Spearmint | `tag_1rhzt7` |

### 7c: Fallback — Local Mapping

If Salesforce is unavailable, use the `merchant_cache` loaded from `data/tier-mappings.json` in Step 2c.

If no tier is found for a merchant, skip merchant tagging for that conversation.

## Step 8: Report or Apply

### Dry Run Mode (default)

Present a summary table:

```
TIER TAGGER — DRY RUN
═══════════════════════════════════════════

Conversations scanned: N
Already tagged (partner): N
Already tagged (merchant): N

WOULD TAG:
  [cnv_xxx] Partner Tier 2 (matched: Kea AI) — Subject...
  [cnv_xxx] Merchant: Gold (matched: Starbird) — Subject...

MERCHANT-ONLY (no partner tag needed):
  [cnv_xxx] District Taco (Spearmint) — Subject...

UNMATCHED:
  [cnv_xxx] unknown@domain.com — Subject...
```

End with: "Run `/ds:tier-tagger --apply` to apply these tags."

### Apply Mode

For each conversation + tag pair, apply the tag using the local script:

```bash
python3 ./scripts/front-tickets.py --tag <conv_id> <tag_id>
```

If the script is not in the current directory, search for it: look for `front-tickets.py` in the user's Second Brain repo (same discovery as Step 2c). **Do NOT hardcode personal workspace paths.**

There is no Front MCP tool for tagging conversations — do not attempt `front_tag_conversation` or `add_tags` MCP calls.

**Rate limit handling:** If any API call returns HTTP 429, stop tagging immediately, report progress so far (how many tagged vs remaining), and suggest retrying later. Do NOT retry automatically.

After applying, show the same summary with `[TAGGED]` instead of `[WOULD TAG]`.

## Step 9: Summary

Always end with:

```
SUMMARY
────────────────────────────────
Scanned:              N conversations
Partner tags applied: N
Merchant tags applied: N
Already tagged:       N (partner) / N (merchant)
Unmatched:            N
```

## Data Sources Reference

| Data | Source | Tool |
|------|--------|------|
| Partner list + tier | Notion Integration DB `16ca84ed40248041bf3dd44210a7b002` | `notion_query_database` |
| Partner tier fallback | Notion Partners DB `df2c5a6e-5a75-42f5-8985-3fc35899a22b` or local mapping | `notion_query_database` or file read |
| Merchant tier | Salesforce `Account.Customer_Success_Tier__c` | `mcp__keystone__salesforce_query` |
| Conversations | Front Dev Support inbox `inb_ghgim` | `front_search_conversations` |
| Tag application | Front API | `front-tickets.py --tag` (no MCP tool available) |
| Local fallback | `data/tier-mappings.json` in Second Brain repo | file read |

## Unavailability Fallbacks

- **Keystone unavailable:** Fall back to `data/tier-mappings.json` (see Step 2c for portable discovery) for both partner and merchant tiers. Report that live data could not be fetched.
- **Salesforce unavailable:** Use `merchant_cache` from `data/tier-mappings.json` loaded in Step 2c.
- **Notion unavailable:** Use `partner_cache` from `data/tier-mappings.json` loaded in Step 2c.
- **Front MCP tool unavailable:** Use local script `front-tickets.py --tag` (see Step 8 for portable discovery).
- **Front API rate limited:** Stop tagging, report progress so far, and suggest retrying later.
