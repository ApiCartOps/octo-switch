import { resolveAccount } from "./store.js";

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";

export async function gh(acct, path, { method = "GET", body } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${acct.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "octoswitch",
      ...(body && { "content-type": "application/json" }),
    },
    body: body && JSON.stringify(body),
  }).catch((e) => {
    const why = e.cause?.code ?? e.cause?.message ?? e.name;
    throw new Error(`Could not reach ${API} (${why}). Check your network, VPN or proxy, then retry.`);
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

const clip = (s, n = 4000) => (s && s.length > n ? `${s.slice(0, n)}\n…[truncated]` : s);

export async function getIssue({ account, repo, number }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const i = await gh(a, `/repos/${owner}/${name}/issues/${number}`);
  return {
    account: a.name, number: i.number, title: i.title, state: i.state, author: i.user?.login,
    labels: i.labels.map((l) => l.name ?? l), comments: i.comments, url: i.html_url, body: clip(i.body),
  };
}

export async function commentIssue({ account, repo, number, body }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const c = await gh(a, `/repos/${owner}/${name}/issues/${number}/comments`, { method: "POST", body: { body } });
  return { account: a.name, url: c.html_url };
}

export async function listPrs({ account, repo, state = "open" }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const items = await gh(a, `/repos/${owner}/${name}/pulls?state=${state}&per_page=30`);
  return {
    account: a.name,
    pull_requests: items.map((p) => ({ number: p.number, title: p.title, state: p.state, draft: p.draft, head: p.head.ref, base: p.base.ref, url: p.html_url })),
  };
}

export async function getPr({ account, repo, number, include_diff = false }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const p = await gh(a, `/repos/${owner}/${name}/pulls/${number}`);
  const out = {
    account: a.name, number: p.number, title: p.title, state: p.state, draft: p.draft, merged: p.merged,
    author: p.user?.login, head: p.head.ref, base: p.base.ref, changed_files: p.changed_files,
    additions: p.additions, deletions: p.deletions, url: p.html_url, body: clip(p.body),
  };
  if (include_diff) {
    const files = await gh(a, `/repos/${owner}/${name}/pulls/${number}/files?per_page=50`);
    out.files = files.map((f) => ({ filename: f.filename, status: f.status, patch: clip(f.patch, 2000) }));
  }
  return out;
}

export async function searchIssues({ account, query, limit = 20 }) {
  const a = resolveAccount({ account, owner: /(?:repo|org|user):([^/\s]+)/.exec(query)?.[1] });
  const r = await gh(a, `/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}`);
  return {
    account: a.name, total: r.total_count,
    items: r.items.map((i) => ({ repo: i.repository_url.split("/repos/")[1], number: i.number, title: i.title, state: i.state, pull_request: !!i.pull_request, url: i.html_url })),
  };
}

export async function getFile({ account, repo, path, ref }) {
  const { owner, name } = splitRepo(repo);
  const a = resolveAccount({ account, owner });
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const f = await gh(a, `/repos/${owner}/${name}/contents/${path.split("/").map(encodeURIComponent).join("/")}${q}`);
  if (Array.isArray(f)) return { account: a.name, directory: f.map((e) => ({ name: e.name, type: e.type, path: e.path })) };
  const text = f.encoding === "base64" ? Buffer.from(f.content, "base64").toString("utf8") : f.content;
  return { account: a.name, path: f.path, size: f.size, sha: f.sha, content: clip(text, 20000) };
}
