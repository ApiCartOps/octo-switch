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
  if (req.url.startsWith("/repos/")) return res.end(JSON.stringify({ full_name: req.url.slice(7), private: true, default_branch: "main", html_url: "u" }));
  res.writeHead(404).end("{}");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const home = fs.mkdtempSync(path.join(os.tmpdir(), "ghmm-"));
const env = { ...process.env, GITHUB_MULTI_MCP_HOME: home, GITHUB_API_URL: `http://127.0.0.1:${port}`, T1: "tok_personal", T2: "tok_org" };
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
assert.equal(tools.length, 8, tools.join());
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

p.kill(); server.close();
fs.rmSync(home, { recursive: true, force: true });
console.log("ALL OK");
