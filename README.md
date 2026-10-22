# github-multi-mcp

A small MCP server and CLI for GitHub that manages **multiple accounts** (personal, work, orgs) and routes each call to the right token.

Not affiliated with or endorsed by GitHub.

## Why

Most GitHub MCP setups use one token. This keeps several named accounts and picks one per call:

1. an explicit `account` argument (name or GitHub login), else
2. the account whose login matches the repo owner (`ApiCartOps/demo` uses the `ApiCartOps` account), else
3. the default account.

## Setup

```bash
npm install
node src/cli.js add personal --default
node src/cli.js add work
node src/cli.js list
```

`add` asks for the token at a hidden prompt (or reads it from an env var with `--token-env=VAR`), checks it against GitHub and stores the login. Tokens are never passed on the command line, never printed, and never returned by any tool. They are stored in `~/.github-multi-mcp/accounts.json` (file mode 600).

Use a fine-grained or classic personal access token per account. For org repos the token must be allowed by the org.

| Command | Description |
|---|---|
| `add <name> [--token-env=VAR] [--default]` | Add or replace an account |
| `list` | Show accounts (no tokens) |
| `default <name>` | Set the default account |
| `remove <name>` | Remove an account |
| `mcp` | Run as an MCP server over stdio |

## MCP tools

Read: `gh_list_accounts`, `gh_whoami`, `gh_list_repos`, `gh_get_repo`, `gh_list_issues`.
Write: `gh_create_repo` (private by default), `gh_create_issue`, `gh_create_pr`.

Write tools act on the real account, so clients should confirm the account and details with the user first.

```bash
claude mcp add github-multi --scope user -- node /absolute/path/to/github-multi-mcp/src/cli.js mcp
```

## Test

```bash
npm test
```

Runs against a fake GitHub API with a temporary config folder; no real accounts are touched.

## License

MIT
