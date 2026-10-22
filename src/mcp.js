import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listAccounts } from "./store.js";
import * as g from "./github.js";
import { commands, instructions } from "./content.js";

const wrap = (fn) => async (args) => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn(args), null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: String(e.message ?? e) }] };
  }
};

const account = z.string().optional().describe(
  "Account name or GitHub login. If omitted, the account matching the repo/org owner is used, else the default account.",
);
const repo = z.string().describe('Repository as "owner/name"');

export async function serve() {
  const server = new McpServer({ name: "octoswitch", title: "Octoswitch", version: "0.2.0" }, { instructions: instructions() });

  server.tool("gh_list_accounts", "List configured GitHub accounts (names and logins only, never tokens) and which is the default.", {}, wrap(async () => listAccounts()));
  server.tool("gh_whoami", "Show the GitHub user behind an account.", { account }, wrap(g.whoami));
  server.tool("gh_list_repos", "List repositories for an account, or for an org/user via `owner`.",
    { account, owner: z.string().optional(), limit: z.number().int().min(1).max(100).default(30) }, wrap(g.listRepos));
  server.tool("gh_get_repo", "Get repository details.", { account, repo }, wrap(g.getRepo));
  server.tool("gh_list_issues", "List issues in a repository.", { account, repo, state: z.enum(["open", "closed", "all"]).default("open") }, wrap(g.listIssues));

  server.tool("gh_create_repo",
    "Create a repository for the user or in an org. Outward-facing: confirm account, owner, name and visibility with the user first. Defaults to private.",
    { account, org: z.string().optional().describe("Org login; omit for the account's own user"), name: z.string(), description: z.string().optional(), private: z.boolean().default(true) },
    wrap(g.createRepo));
  server.tool("gh_create_issue", "Create an issue. Confirm the account and text with the user first.",
    { account, repo, title: z.string(), body: z.string().optional() }, wrap(g.createIssue));
  server.tool("gh_create_pr", "Open a pull request. Confirm the account, branches and text with the user first.",
    { account, repo, title: z.string(), head: z.string(), base: z.string(), body: z.string().optional() }, wrap(g.createPr));

  const num = z.number().int().positive().describe("Issue or pull request number");
  server.tool("gh_get_issue", "Get one issue (title, state, labels, body).", { account, repo, number: num }, wrap(g.getIssue));
  server.tool("gh_list_prs", "List pull requests in a repository.", { account, repo, state: z.enum(["open", "closed", "all"]).default("open") }, wrap(g.listPrs));
  server.tool("gh_get_pr", "Get one pull request; set include_diff to also get per-file patches for review.",
    { account, repo, number: num, include_diff: z.boolean().default(false) }, wrap(g.getPr));
  server.tool("gh_search_issues", 'Search issues and PRs with GitHub search syntax, e.g. "repo:owner/name is:open label:bug".',
    { account, query: z.string(), limit: z.number().int().min(1).max(100).default(20) }, wrap(g.searchIssues));
  server.tool("gh_get_file", "Read a file (or list a directory) in a repository.",
    { account, repo, path: z.string(), ref: z.string().optional().describe("Branch, tag or commit") }, wrap(g.getFile));
  server.tool("gh_comment_issue", "Comment on an issue or pull request. Confirm the account and text with the user first.",
    { account, repo, number: num, body: z.string() }, wrap(g.commentIssue));

  // Prompts: the same workflows as the shipped slash commands, for any MCP client that supports prompts.
  for (const c of commands()) {
    server.prompt(c.name.replace(/-/g, "_"), c.description, { arguments: z.string().optional().describe("e.g. owner/repo or owner/repo 42") },
      ({ arguments: a }) => ({ messages: [{ role: "user", content: { type: "text", text: c.body.replaceAll("$ARGUMENTS", a ?? "(ask me)") } }] }));
  }

  server.resource("accounts", "octoswitch://accounts", { description: "Configured accounts (no tokens)", mimeType: "application/json" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(listAccounts(), null, 2) }] }));

  await server.connect(new StdioServerTransport());
}
