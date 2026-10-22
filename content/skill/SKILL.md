---
name: octoswitch
description: Work with GitHub across several accounts (personal, work, orgs) through the octoswitch MCP server. Use when the user asks to list, read, search, file or comment on GitHub repos, issues or pull requests, or mentions more than one GitHub account.
---

# GitHub with multiple accounts

Use the `octoswitch` MCP server (`gh_*` tools). It stores several named accounts and routes each call:

1. the `account` argument (name or GitHub login), else
2. the account whose login equals the repo owner, else
3. the default account.

## Workflow

1. If the account is unclear, call `gh_list_accounts` (names and logins only; tokens are never shown).
2. Read first: `gh_get_repo`, `gh_list_issues`, `gh_get_issue`, `gh_list_prs`, `gh_get_pr` (use `include_diff` for review), `gh_search_issues`, `gh_get_file`.
3. Every response includes the `account` that was used. Mention it when reporting results.
4. Before any write (`gh_create_repo`, `gh_create_issue`, `gh_comment_issue`, `gh_create_pr`), show the user the account, repo, and exact title/body, and wait for confirmation. Do not infer the account for writes when more than one could apply.
5. New repos default to private. Only set `private: false` when asked.

## Errors

- `Unknown account`: run `gh_list_accounts` and ask the user which one.
- `GitHub 401/403/404`: the token for that account may lack scope or org approval. Say which account was used; do not retry with a different account without asking.
- `No accounts configured`: tell the user to run `octoswitch add <name>` in a terminal. Never ask them to paste a token into chat.
