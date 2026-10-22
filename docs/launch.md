# Octoswitch launch copy

**Tagline:** One MCP server, every GitHub account.

**One-liner (npm / registries):** Octoswitch is an MCP server and CLI that keeps several GitHub accounts (personal, work, orgs) and routes each call to the right token. Works with Claude, Cursor, Copilot, Codex, Gemini CLI, Windsurf, Hermes and any MCP client.

**Short pitch:** Most GitHub MCP setups use a single token, so working across a personal account and a work org means swapping config. Octoswitch stores named accounts locally and picks one per call: an explicit `account`, else the account matching the repo owner, else your default. Tokens stay in a mode-600 file and are never printed or returned by a tool. One command, `octoswitch install <agent>`, wires it into your agent.

**Post draft:**
> Octoswitch: one MCP server for all your GitHub accounts. It routes each call to the right token (repo owner match, explicit account, or default), and `octoswitch install cursor|claude-code|codex|...` sets it up in 13 agents. Writes always ask for confirmation. MIT, Node 20+.

**Keywords:** mcp, github, multi-account, claude, cursor, copilot, codex, gemini, windsurf, hermes

**Name use:** Not affiliated with or endorsed by GitHub. Do not use GitHub's logos or the Octocat in any asset.
