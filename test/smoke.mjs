// Smoke test against a fake GitHub API. Uses a temp config dir; touches no real accounts.
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const logins = { tok_personal: "alice", tok_org: "ApiCartOps" };
const calls = [];
const server = http.createServer((req, res) => {
  const tok = (req.headers.authorization ?? "").replace("Bearer ", "");
  calls.push({ method: req.method, url: req.url, tok });
  const login = logins[tok];
  if (!login) { res.writeHead(401).end('{"message":"Bad credentials"}'); return; }
  res.setHeader("content-type", "application/json");
  if (req.url === "/user") return res.end(JSON.stringify({ login, name: login, html_url: `https://github.com/${login}` }));
  if (req.method === "POST" && (req.url === "/user/repos" || req.url.startsWith("/orgs/"))) {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      const { name, private: p } = JSON.parse(b);
      const owner = req.url.startsWith("/orgs/") ? req.url.split("/")[2] : login;
      res.writeHead(201); res.end(JSON.stringify({ full_name: `${owner}/${name}`, private: p, html_url: `https://github.com/${owner}/${name}`, clone_url: "x" }));
    }); return;
  }
  if (/^\/repos\/[^/]+\/[^/]+\/issues\/\d+$/.test(req.url)) return res.end(JSON.stringify({ number: 7, title: "t", state: "open", user: { login: "bob" }, labels: [{ name: "bug" }], comments: 0, html_url: "u", body: "b" }));
  if (req.url.startsWith("/repos/")) return res.end(JSON.stringify({ full_name: req.url.slice(7), private: true, default_branch: "main", html_url: "u" }));
  res.writeHead(404).end("{}");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ghmm-"));
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "ghmm-home-"));
const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, APPDATA: path.join(fakeHome, "AppData"), XDG_CONFIG_HOME: path.join(fakeHome, ".config"), GITHUB_MULTI_MCP_HOME: home, GITHUB_API_URL: `http://127.0.0.1:${port}`, T1: "tok_personal", T2: "tok_org" };
// Async spawn: the fake GitHub server lives in this process, so a blocking spawnSync would deadlock.
const cli = (...a) => new Promise((resolve) => {
  const c = spawn("node", ["src/cli.js", ...a], { env });
  let stdout = ""; c.stdout.on("data", (d) => (stdout += d));
  c.on("close", (status) => resolve({ stdout, status }));
});

assert.match((await cli("add", "personal", "--token-env=T1")).stdout, /alice/);
assert.match((await cli("add", "org", "--token-env=T2")).stdout, /ApiCartOps/);
assert.equal((await cli("add", "bad", "--token-env=NOPE")).status, 1);
const listOut = (await cli("list")).stdout;
const list = JSON.parse(listOut);
assert.deepEqual(list.map((a) => [a.name, a.login, a.default]), [["personal", "alice", true], ["org", "ApiCartOps", false]]);
assert.ok(!listOut.includes("tok_"), "list must not leak tokens");
console.log("cli add/list ok");

// MCP over stdio
const p = spawn("node", ["src/cli.js", "mcp"], { env });
let buf = ""; const pending = new Map();
p.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) { const m = JSON.parse(l); pending.get(m.id)?.(m); } } });
const rpc = (id, method, params) => new Promise((r) => { pending.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
await rpc(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } });
p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const tools = (await rpc(2, "tools/list", {})).result.tools.map((t) => t.name);
assert.equal(tools.length, 14, tools.join());
const call = async (id, name, args) => JSON.parse((await rpc(id, "tools/call", { name, arguments: args })).result.content[0].text);

// no account given + org owner -> picks the "org" account by login match
let r = await call(3, "gh_create_repo", { org: "ApiCartOps", name: "demo" });
assert.equal(r.account, "org"); assert.equal(r.full_name, "ApiCartOps/demo"); assert.equal(r.private, true);
assert.equal(calls.at(-1).tok, "tok_org"); assert.equal(calls.at(-1).url, "/user/repos"); // owner == account login -> own user repo
// owner that is not any account's login (a real org) -> default account, org endpoint
r = await call(30, "gh_create_repo", { org: "SomeOrg", name: "x", private: false });
assert.equal(r.account, "personal"); assert.equal(r.full_name, "SomeOrg/x"); assert.equal(r.private, false);
assert.equal(calls.at(-1).tok, "tok_personal"); assert.equal(calls.at(-1).url, "/orgs/SomeOrg/repos");
// no account, no owner -> default (personal)
r = await call(4, "gh_whoami", {});
assert.equal(r.login, "alice");
// explicit account wins, by login too
r = await call(5, "gh_whoami", { account: "ApiCartOps" });
assert.equal(r.account, "org");
// repo owner routes the token
r = await call(6, "gh_get_repo", { repo: "ApiCartOps/demo" });
assert.equal(r.account, "org"); assert.equal(calls.at(-1).tok, "tok_org");
// unknown account -> error result, not crash
const bad = (await rpc(7, "tools/call", { name: "gh_whoami", arguments: { account: "ghost" } })).result;
assert.equal(bad.isError, true); assert.match(bad.content[0].text, /Unknown account/);
// accounts tool never leaks tokens
const acc = (await rpc(8, "tools/call", { name: "gh_list_accounts", arguments: {} })).result.content[0].text;
assert.ok(!acc.includes("tok_"));
console.log("mcp routing ok:", tools.join(", "));

r = await call(9, "gh_get_issue", { repo: "ApiCartOps/demo", number: 7 });
assert.equal(r.account, "org"); assert.deepEqual(r.labels, ["bug"]); assert.equal(calls.at(-1).url, "/repos/ApiCartOps/demo/issues/7");
const init = (await rpc(10, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } })).result;
assert.match(init.instructions, /gh_create_issue/);
const prompts = (await rpc(11, "prompts/list", {})).result.prompts.map((x) => x.name);
assert.deepEqual(prompts.sort(), ["gh_accounts", "gh_new_issue", "gh_review_pr", "gh_triage"]);
const pr = (await rpc(12, "prompts/get", { name: "gh_triage", arguments: { arguments: "a/b" } })).result.messages[0].content.text;
assert.match(pr, /Triage issues in a\/b/); assert.ok(!pr.includes("$ARGUMENTS"));
const res = JSON.parse((await rpc(13, "resources/read", { uri: "github-multi://accounts" })).result.contents[0].text);
assert.equal(res.length, 2); assert.ok(!JSON.stringify(res).includes("tok_"));
console.log("mcp tools/prompts/resources ok");
p.kill(); server.close();

// agent installers (into the fake home)
const BAD_JSON = "{ // comment\n}";
const cfgOf = (...seg) => path.join(fakeHome, ...seg);
const rd = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
fs.mkdirSync(cfgOf(".cursor"), { recursive: true });
fs.writeFileSync(cfgOf(".cursor", "mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));
assert.match((await cli("install", "cursor", "--dry-run")).stdout, /would add/);
assert.ok(!("github-multi" in rd(cfgOf(".cursor", "mcp.json")).mcpServers), "dry run must not write");
await cli("install", "cursor");
let c = rd(cfgOf(".cursor", "mcp.json")).mcpServers;
assert.equal(c.other.command, "x"); assert.equal(c["github-multi"].command, "node"); assert.match(c["github-multi"].args.at(-1), /^mcp$/);
assert.match((await cli("install", "cursor")).stdout, /already installed/);
await cli("install", "vscode"); // user-level mcp.json uses "servers" + type
assert.equal(rd(cfgOf("AppData", "Code", "User", "mcp.json")).servers["github-multi"].type, "stdio");
await cli("install", "opencode");
assert.equal(rd(cfgOf(".config", "opencode", "opencode.json")).mcp["github-multi"].type, "local");
await cli("install", "codex");
const toml = fs.readFileSync(cfgOf(".codex", "config.toml"), "utf8");
assert.match(toml, /\[mcp_servers\.github-multi\]/);
await cli("install", "claude-code");
assert.ok(fs.existsSync(cfgOf(".claude", "skills", "github-multi", "SKILL.md")));
assert.ok(fs.existsSync(cfgOf(".claude", "commands", "gh-triage.md")));
assert.equal(rd(cfgOf(".claude.json")).mcpServers["github-multi"].type, "stdio");
assert.match((await cli("install", "hermes")).stdout, /mcp_servers:/);
// refuses to clobber a config it cannot parse
fs.mkdirSync(cfgOf(".gemini"), { recursive: true }); fs.writeFileSync(cfgOf(".gemini", "settings.json"), BAD_JSON);
assert.equal((await cli("install", "gemini-cli")).status, 1);
assert.equal(fs.readFileSync(cfgOf(".gemini", "settings.json"), "utf8"), BAD_JSON);
// uninstall
await cli("uninstall", "cursor"); assert.deepEqual(Object.keys(rd(cfgOf(".cursor", "mcp.json")).mcpServers), ["other"]);
await cli("uninstall", "codex"); assert.ok(!/github-multi/.test(fs.readFileSync(cfgOf(".codex", "config.toml"), "utf8")));
await cli("uninstall", "claude-code"); assert.ok(!fs.existsSync(cfgOf(".claude", "skills", "github-multi")));
assert.equal(Object.keys(rd(cfgOf(".claude.json")).mcpServers).length, 0);
console.log("agent install/uninstall ok");

// project instruction files: idempotent, preserves existing text
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "ghmm-proj-"));
fs.writeFileSync(path.join(proj, "CLAUDE.md"), "# Mine\n");
await cli("init", `--dir=${proj}`); await cli("init", `--dir=${proj}`);
const claudeMd = fs.readFileSync(path.join(proj, "CLAUDE.md"), "utf8");
assert.ok(claudeMd.startsWith("# Mine") && claudeMd.split("github-multi-mcp:start").length === 2);
assert.ok(fs.existsSync(path.join(proj, "AGENTS.md")) && !fs.existsSync(path.join(proj, "GEMINI.md")));
await cli("init", `--dir=${proj}`, "--all");
assert.match(fs.readFileSync(path.join(proj, ".cursor", "rules", "github-multi.mdc"), "utf8"), /^---\ndescription/);
assert.ok(fs.existsSync(path.join(proj, ".github", "copilot-instructions.md")));
console.log("init ok");
fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(fakeHome, { recursive: true, force: true });
fs.rmSync(home, { recursive: true, force: true });
console.log("ALL OK");
