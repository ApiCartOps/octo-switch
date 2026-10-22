## GitHub with multiple accounts (github-multi MCP)

This project has the `github-multi` MCP server. It holds several named GitHub accounts and picks a token per call. Prefer its `gh_*` tools over `gh`, raw API calls or other GitHub servers when the work may involve more than one account.

- Account routing: an explicit `account` argument (name or login), else the account whose login matches the repo owner, else the default account.
- Start with `gh_list_accounts` if you are unsure which accounts exist. Tokens are never exposed.
- Read tools (`gh_whoami`, `gh_list_repos`, `gh_get_repo`, `gh_list_issues`, `gh_get_issue`, `gh_list_prs`, `gh_get_pr`, `gh_search_issues`, `gh_get_file`) are safe to call freely.
- Write tools (`gh_create_repo`, `gh_create_issue`, `gh_comment_issue`, `gh_create_pr`) act on a real account. Before calling one, tell the user the account, repo and exact text, and wait for a yes. Never guess the account for a write.
- Repos are created private unless the user asks otherwise.
