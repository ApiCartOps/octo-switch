#!/usr/bin/env node
import readline from "node:readline";
import { parseArgs } from "node:util";
import { listAccounts, saveAccount, removeAccount, setDefault, storePath } from "./store.js";
import { whoamiToken } from "./github.js";

const HELP = `github-multi-mcp: GitHub MCP server with multiple accounts

  add <name> [--token-env=VAR] [--default]   Add an account. The token is read from the
                                             env var VAR, or typed at a hidden prompt.
  list                                       Show accounts (never prints tokens)
  default <name>                             Set the default account
  remove <name>                              Remove an account
  mcp                                        Run as an MCP server over stdio

Use a fine-grained or classic personal access token per account (repo scope for
repos/issues/PRs; org owners may need to approve the token for the org).
Tokens are stored in ${storePath} (file mode 600).`;

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer.trim()); });
  });
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "token-env": { type: "string" }, default: { type: "boolean" } },
});
const [cmd, name] = positionals;

try {
  switch (cmd) {
    case "add": {
      if (!name) throw new Error("Usage: add <name> [--token-env=VAR]");
      const token = values["token-env"] ? process.env[values["token-env"]] : await promptHidden(`GitHub token for "${name}": `);
      if (!token) throw new Error("No token provided.");
      const login = await whoamiToken(token);
      saveAccount(name, token, login, values.default);
      console.log(`Saved "${name}" (GitHub user ${login}).`);
      break;
    }
    case "list": console.log(JSON.stringify(listAccounts(), null, 2)); break;
    case "default": setDefault(name); console.log(`Default is now "${name}".`); break;
    case "remove": removeAccount(name); console.log(`Removed "${name}".`); break;
    case "mcp": await (await import("./mcp.js")).serve(); break;
    default: console.log(HELP);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
