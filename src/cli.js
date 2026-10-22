#!/usr/bin/env node
import readline from "node:readline";
import { parseArgs } from "node:util";
import { listAccounts, saveAccount, removeAccount, setDefault, storePath } from "./store.js";
import { whoamiToken } from "./github.js";
import { AGENTS, detect, install, uninstall, serverCommand, init, defaultTargets, initTargets } from "./agents.js";

const HELP = `octoswitch: one MCP server, every GitHub account

  add <name> [--token-env=VAR] [--default]   Add an account. The token is read from the
                                             env var VAR, or typed at a hidden prompt.
  list                                       Show accounts (never prints tokens)
  default <name>                             Set the default account
  remove <name>                              Remove an account
  mcp                                        Run as an MCP server over stdio

Connect it to your AI agent:
  agents                                     List supported agents and whether they look installed
  install <agent|all> [--name=N] [--npx]     Register this server with an agent's MCP config
                                             [--dry-run] shows what would change
  uninstall <agent>                          Remove it again
  config <agent>                             Print the config snippet for an agent
  init [--dir=.] [--only=a,b] [--all]        Write usage instructions into a project
                                             (AGENTS.md, CLAUDE.md, GEMINI.md, copilot, cursor)

Agents: ${Object.keys(AGENTS).join(", ")}

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
  options: {
    "token-env": { type: "string" }, default: { type: "boolean" }, name: { type: "string", default: "octoswitch" },
    npx: { type: "boolean" }, "dry-run": { type: "boolean" }, dir: { type: "string", default: "." },
    only: { type: "string" }, all: { type: "boolean" },
  },
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
    case "agents":
      for (const [id, a] of Object.entries(AGENTS)) console.log(`${id.padEnd(15)} ${a.label.padEnd(26)} ${a.kind === "print" ? "manual snippet" : detect(a) ? "detected" : "not detected"}`);
      break;
    case "install": {
      if (!name) throw new Error(`Usage: install <agent|all>. Agents: ${Object.keys(AGENTS).join(", ")}`);
      const cmd = serverCommand({ npx: values.npx });
      const ids = name === "all" ? Object.keys(AGENTS).filter((id) => AGENTS[id].kind !== "print" && detect(AGENTS[id])) : [name];
      if (!ids.length) console.log("No supported agents detected. Try: install <agent>, or: config generic");
      for (const id of ids) {
        try { console.log(install(id, values.name, cmd, { dryRun: values["dry-run"] })); }
        catch (e) { if (ids.length === 1) throw e; console.log(`${id}: skipped (${e.message})`); }
      }
      if (!values["dry-run"] && ids.length) console.log("Restart the agent, then add an account if you have not: octoswitch add <name>");
      break;
    }
    case "uninstall": if (!name) throw new Error("Usage: uninstall <agent>"); console.log(uninstall(name, values.name)); break;
    case "config": {
      if (!name) throw new Error(`Usage: config <agent>. Agents: ${Object.keys(AGENTS).join(", ")}`);
      const a = AGENTS[name]; if (!a) throw new Error(`Unknown agent "${name}".`);
      const cmd = serverCommand({ npx: values.npx });
      console.log(a.kind === "print" ? a.snippet(values.name, cmd)
        : a.kind === "toml" ? a.block(values.name, cmd)
        : a.kind === "file" ? a.content(values.name, cmd)
        : JSON.stringify({ [a.key]: { [values.name]: a.entry(cmd) } }, null, 2));
      break;
    }
    case "init": {
      const dir = values.dir;
      const only = values.all ? initTargets : values.only ? values.only.split(",") : defaultTargets(dir);
      for (const line of init(dir, only, { dryRun: values["dry-run"] })) console.log(line);
      break;
    }
    case "mcp": await (await import("./mcp.js")).serve(); break;
    default: console.log(HELP);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
