import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listAccounts } from "./store.js";
import * as g from "./github.js";

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
  const server = new McpServer({ name: "github-multi-mcp", version: "0.1.0" });

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

  await server.connect(new StdioServerTransport());
}
