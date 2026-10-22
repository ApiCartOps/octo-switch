import { resolveAccount } from "./store.js";

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

export async function gh(acct, path, { method = "GET", body } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${acct.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "github-multi-mcp",
      ...(body && { "content-type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status} (account "${acct.name ?? acct.login}"): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

/** Validate a token and return its login. Used by `add`. */
export async function whoamiToken(token) {
  const u = await gh({ token }, "/user");
  return u.login;
}

const splitRepo = (repo) => {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error('repo must look like "owner/name"');
  return { owner, name };
};

export async function whoami({ account }) {
  const a = resolveAccount({ account });
  const u = await gh(a, "/user");
  return { account: a.name, login: u.login, name: u.name, html_url: u.html_url };
}

export async function listRepos({ account, owner, limit = 30 }) {
  const a = resolveAccount({ account, owner });
  const path = owner && owner.toLowerCase() !== a.login.toLowerCase()
    ? `/orgs/${owner}/repos?per_page=${limit}&sort=updated`
    : `/user/repos?per_page=${limit}&sort=updated&affiliation=owner`;
  const repos = await gh(a, path);
  return { account: a.name, repos: repos.map((r) => ({ full_name: r.full_name, private: r.private, url: r.html_url })) };
}

export async function getRepo({ account, repo }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const r = await gh(a, `/repos/${owner}/${name}`);
  return { account: a.name, full_name: r.full_name, private: r.private, default_branch: r.default_branch, url: r.html_url, description: r.description };
}

export async function createRepo({ account, org, name, description, private: isPrivate = true }) {
  const a = resolveAccount({ account, owner: org });
  const path = org && org.toLowerCase() !== a.login.toLowerCase() ? `/orgs/${org}/repos` : "/user/repos";
  const r = await gh(a, path, { method: "POST", body: { name, description, private: isPrivate } });
  return { account: a.name, full_name: r.full_name, private: r.private, url: r.html_url, clone_url: r.clone_url };
}

export async function listIssues({ account, repo, state = "open" }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const items = await gh(a, `/repos/${owner}/${name}/issues?state=${state}&per_page=30`);
  return { account: a.name, issues: items.filter((i) => !i.pull_request).map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })) };
}

export async function createIssue({ account, repo, title, body }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const i = await gh(a, `/repos/${owner}/${name}/issues`, { method: "POST", body: { title, body } });
  return { account: a.name, number: i.number, url: i.html_url };
}

export async function createPr({ account, repo, title, head, base, body }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const p = await gh(a, `/repos/${owner}/${name}/pulls`, { method: "POST", body: { title, head, base, body } });
  return { account: a.name, number: p.number, url: p.html_url };
}
