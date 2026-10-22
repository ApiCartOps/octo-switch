<p align="center"><img src="https://raw.githubusercontent.com/ApiCartOps/github-multi-mcp/main/assets/logo.svg" width="96" alt="Octoswitch logo"></p>

<h1 align="center">Octoswitch</h1>

<p align="center"><b>One MCP server, every GitHub account.</b><br>Routes each call to the right token, for any AI agent.</p>

<p align="center"><img alt="license" src="https://img.shields.io/badge/license-MIT-2dd4bf"> <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-2dd4bf"> <img alt="MCP" src="https://img.shields.io/badge/MCP-stdio-2dd4bf"></p>

An MCP server and CLI for GitHub that manages **multiple accounts** (personal, work, orgs) and routes each call to the right token. It speaks plain MCP over stdio, so it works with any MCP-capable agent: Claude Code and Desktop, Cursor, GitHub Copilot (VS Code), Windsurf, Cline, Gemini CLI, Codex CLI, opencode, Continue, Hermes Agent, Zed and others.

Not affiliated with or endorsed by GitHub.

## Why

Most GitHub MCP setups use one token. This keeps several named accounts and picks one per call:

1. an explicit `account` argument (name or GitHub login), else
2. the account whose login matches the repo owner (`ApiCartOps/demo` uses the `ApiCartOps` account), else
3. the default account.

## Setup

```bash
git clone https://github.com/ApiCartOps/github-multi-mcp.git octoswitch
cd octoswitch
npm install
npm link                      # puts the `octoswitch` command on your PATH

octoswitch add personal --default
octoswitch add work
octoswitch list
```

```text
  NAME      LOGIN
* personal  alice  (default)
  work      acme-corp
```

Without `npm link`, run `node src/cli.js` in place of `octoswitch`.

`add` asks for the token at a hidden prompt (or reads it from an env var with `--token-env=VAR`), checks it against GitHub and stores the login. Tokens are never passed on the command line, never printed, and never returned by any tool. They are stored in `~/.octoswitch/accounts.json` (file mode 600).

Use a fine-grained or classic personal access token per account. For org repos the token must be allowed by the org.

## Connect it to your agent

```bash
octoswitch agents                 # what is supported, and what looks installed
octoswitch install cursor         # or: claude-code, vscode, codex, gemini-cli, ... or: all
octoswitch install cursor --dry-run
octoswitch config hermes          # print the snippet instead of editing anything
```

`install` merges one entry into the agent's user-level MCP config and leaves everything else in the file alone. It refuses to touch a file it cannot parse (for example JSON with comments) and prints the snippet instead. `uninstall <agent>` removes it. Restart the agent afterwards.

| Agent | Id | What `install` does |
|---|---|---|
| Claude Code | `claude-code` | `mcpServers` in `~/.claude.json`, plus the skill and slash commands below |
| Claude Desktop | `claude-desktop` | `mcpServers` in `claude_desktop_config.json` |
| Cursor | `cursor` | `mcpServers` in `~/.cursor/mcp.json` |
| VS Code / GitHub Copilot | `vscode` | `servers` in the user `mcp.json` |
| Windsurf | `windsurf` | `~/.codeium/windsurf/mcp_config.json` |
| Cline | `cline` | `cline_mcp_settings.json` |
| Gemini CLI | `gemini-cli` | `mcpServers` in `~/.gemini/settings.json` |
| opencode | `opencode` | `mcp` in `~/.config/opencode/opencode.json` |
| Codex CLI | `codex` | `[mcp_servers.octoswitch]` in `~/.codex/config.toml` |
| Continue | `continue` | `~/.continue/mcpServers/octoswitch.yaml` |
| Hermes Agent | `hermes` | prints a YAML snippet for `~/.hermes/config.yaml` |
| Zed | `zed` | prints a snippet for `settings.json` |
| anything else | `generic` | prints the standard `mcpServers` JSON |

Config locations differ between versions of these tools, so check the printed path if an agent does not pick it up. Use `--npx` to register `npx -y octoswitch mcp` instead of a path to this checkout (once published), and `--name=NAME` to use a different server name.

### Project instructions

```bash
octoswitch init              # AGENTS.md, plus any of CLAUDE.md / GEMINI.md / copilot / cursor rule that already exist
octoswitch init --all        # write all five
```

This adds a short, marked block telling the agent to use the `gh_*` tools and to confirm the account before any write. Re-running updates the block in place. `AGENTS.md` is read by Codex, Cursor, Copilot, Windsurf, opencode, Zed and others; the other files cover Claude Code (`CLAUDE.md`), Gemini CLI (`GEMINI.md`), GitHub Copilot (`.github/copilot-instructions.md`) and Cursor (`.cursor/rules/octoswitch.mdc`).

## What it exposes

**Tools** (all agents):

| Read | Write (act on a real account; agents are told to confirm first) |
|---|---|
| `gh_list_accounts`, `gh_whoami`, `gh_list_repos`, `gh_get_repo`, `gh_list_issues`, `gh_get_issue`, `gh_list_prs`, `gh_get_pr`, `gh_search_issues`, `gh_get_file` | `gh_create_repo` (private by default), `gh_create_issue`, `gh_comment_issue`, `gh_create_pr` |

**Server instructions**: the same guidance as above is sent in the MCP `initialize` response, so clients that surface it need no extra setup.

**Prompts** (commands, for clients that support MCP prompts): `gh_accounts`, `gh_triage`, `gh_review_pr`, `gh_new_issue`. They take one optional argument such as `owner/repo` or `owner/repo 42`.

**Resource**: `octoswitch://accounts` (names and logins only).

**Claude Code extras** (installed by `install claude-code`): the `octoswitch` skill in `~/.claude/skills/` and the slash commands `/gh-accounts`, `/gh-triage`, `/gh-review-pr`, `/gh-new-issue` in `~/.claude/commands/`. The sources live in [`content/`](content), including a standard `SKILL.md` you can copy into any agent that supports Agent Skills.

## CLI reference

| Command | Description |
|---|---|
| `add <name> [--token-env=VAR] [--default]` | Add or replace an account |
| `list [--json]` | Show accounts (no tokens) |
| `default <name>` | Set the default account |
| `remove <name>` | Remove an account |
| `agents` | List supported agents |
| `install <agent\|all> [--name=N] [--npx] [--dry-run]` | Register the server with an agent |
| `uninstall <agent>` | Remove it |
| `config <agent>` | Print the snippet |
| `init [--dir=.] [--only=a,b] [--all]` | Write project instruction files |
| `mcp` | Run as an MCP server over stdio |

## Test

```bash
npm test
```

Runs against a fake GitHub API with temporary config and home folders; no real accounts or agent configs are touched.

## License

MIT
