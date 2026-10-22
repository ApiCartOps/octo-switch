# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versions follow [semantic versioning](https://semver.org/).

## [0.2.0]

First release on npm. Renamed from `github-multi-mcp` to **Octoswitch** and made it agent-agnostic.

### Added
- `install`, `uninstall`, `config` and `agents` commands that register the server with Claude Code, Claude Desktop, Cursor, VS Code / GitHub Copilot, Windsurf, Cline, Gemini CLI, opencode, Codex CLI and Continue, and print snippets for Hermes, Zed and any other MCP client.
- `init` command that writes a marked instruction block into `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` and a Cursor rule.
- Tools: `gh_get_issue`, `gh_comment_issue`, `gh_list_prs`, `gh_get_pr`, `gh_search_issues`, `gh_get_file`.
- MCP server instructions, four prompts (`gh_accounts`, `gh_triage`, `gh_review_pr`, `gh_new_issue`) and an `octoswitch://accounts` resource.
- Claude Code skill and `/gh-*` slash commands, installed by `install claude-code`.
- Logo, README header and launch copy.

### Changed
- `list` prints a table; `list --json` keeps the previous output.
- Accounts now live in `~/.octoswitch`. An existing `~/.github-multi-mcp` folder and the `GITHUB_MULTI_MCP_HOME` variable are still honoured.

## [0.1.0]

Initial multi-account GitHub MCP server and CLI (published only as source).
