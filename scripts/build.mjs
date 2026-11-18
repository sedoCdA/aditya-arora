// Build step: turns data/resume.json (the single source of truth) into
// everything else the site serves. No dependencies; runs on Node 18+.
//
//   data/graph.json            knowledge graph for Fig. 2
//   llms.txt                   plain-text profile for LLMs and agents
//   .well-known/agent.json     A2A-style agent card
//   index.html                 JSON-LD (schema.org/Person) injected between markers
//   sitemap.xml, robots.txt
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const r = JSON.parse(readFileSync(join(root, "data/resume.json"), "utf8"));
const site = r.meta.site.replace(/\/$/, "");
const write = (p, s) => {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), s);
  console.log("wrote", p);
};
const yearOf = (s) => (s ? parseInt(String(s).slice(0, 4), 10) : null);

// ---------- knowledge graph ----------
const nodes = new Map();
const edges = [];
const edgeKeys = new Set();
const add = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, n); return nodes.get(n.id); };
const link = (a, b, rel) => {
  const k = [a, b].sort().join("|");
  if (edgeKeys.has(k) || !nodes.has(a) || !nodes.has(b)) return;
  edgeKeys.add(k);
  edges.push({ source: a, target: b, rel });
};

for (const s of r.skills) add({ id: `skill:${s.id}`, type: "skill", label: s.label, group: s.group, aliases: s.aliases, year: null });
for (const e of r.education) add({ id: `edu:${e.id}`, type: "education", label: e.short ? e.short.split(" · ").pop() : e.school, detail: e.degree, year: yearOf(e.start) });

const addWork = (w, type) => {
  const id = `${type}:${w.id}`;
  const year = type === "role" ? yearOf(w.start) : w.year;
  add({
    id, type, year,
    label: type === "role" ? (w.short ? w.short.split(" · ").pop() : w.org) : w.name,
    detail: type === "role" ? w.title : w.kind,
    summary: w.summary,
    repo: w.repo || "", demo: w.demo || "",
    featured: !!w.featured,
  });
  for (const s of w.skills || []) link(id, `skill:${s}`, "uses");
  for (const o of w.outcomes || []) {
    add({ id: `outcome:${o.id}`, type: "outcome", label: o.label, year });
    link(id, `outcome:${o.id}`, "achieved");
  }
  if (w.edu) link(id, `edu:${w.edu}`, "built during");
};
r.roles.forEach((w) => addWork(w, "role"));
r.projects.forEach((w) => addWork(w, "project"));

for (const a of r.awards) {
  add({ id: `award:${a.id}`, type: "award", label: a.title, detail: a.by, year: a.year });
  if (a.edu) link(`award:${a.id}`, `edu:${a.edu}`, "awarded at");
}

// skills take the year they first appear in a role or project
for (const e of edges) {
  for (const [s, o] of [[e.source, e.target], [e.target, e.source]]) {
    const sn = nodes.get(s), on = nodes.get(o);
    if (sn.type === "skill" && on.year && (sn.year === null || on.year < sn.year)) sn.year = on.year;
  }
}
for (const c of r.certifications) {
  const years = c.skills.map((s) => nodes.get(`skill:${s}`)?.year).filter(Boolean);
  add({ id: `cert:${c.id}`, type: "certification", label: c.title, year: years.length ? Math.min(...years) : 2024 });
  for (const s of c.skills) link(`cert:${c.id}`, `skill:${s}`, "certifies");
}
for (const n of nodes.values()) if (n.year === null) n.year = 2026;

// ego node: ties roles, study, awards, and certifications into one connected graph
const me = add({ id: "person:me", type: "person", label: r.person.name, detail: `${r.person.role}, ${r.person.org}`, summary: r.voice["0.0"].tagline, repo: r.person.github, year: 2022 });
for (const n of [...nodes.values()]) {
  if (["role", "education", "award", "certification"].includes(n.type)) link(me.id, n.id, n.type === "role" ? "worked as" : "holds");
}

const graph = { generated: r.meta.updated, nodes: [...nodes.values()], edges };
write("data/graph.json", JSON.stringify(graph, null, 1));

// ---------- llms.txt ----------
const p = r.person;
const v = r.voice["0.0"];
const lines = [
  `# ${p.name}`,
  "",
  `> ${v.tagline}`,
  "",
  v.abstract,
  "",
  `Status: ${p.status}. Contact: ${p.email}. GitHub: ${p.github}${p.linkedin ? `. LinkedIn: ${p.linkedin}` : ""}.`,
  "",
  "## Machine-readable files",
  `- [resume.json](${site}/data/resume.json): full structured profile (source of truth)`,
  `- [graph.json](${site}/data/graph.json): knowledge graph of roles, projects, skills, and outcomes`,
  `- [agent.json](${site}/.well-known/agent.json): agent card`,
  "",
  "## Results",
  ...r.benchmarks.map((b) => `- ${b.task}: ${b.score} (${b.setting})`),
  "",
  "## Experience",
  ...r.roles.flatMap((w) => [
    `### ${w.title}, ${w.org} (${w.start} to ${w.end || "present"})`,
    ...w.bullets.map((b) => `- ${b}`),
    "",
  ]),
  "## Projects",
  ...r.projects.map((w) => `- [${w.name}](${w.repo}): ${w.summary} Skills: ${w.skills.map((s) => nodes.get(`skill:${s}`).label).join(", ")}.`),
  "",
  "## Education",
  ...r.education.map((e) => `- ${e.degree}, ${e.school} (${e.start} to ${e.end}). ${e.note}`),
  "",
  "## Awards",
  ...r.awards.map((a) => `- ${a.title} (${a.by}, ${a.year})`),
  "",
  "## Certifications",
  ...r.certifications.map((c) => `- ${c.title}`),
  "",
  "## Skills",
  ...Object.entries(r.skills.reduce((g, s) => ((g[s.group] ||= []).push(s.label), g), {})).map(([g, l]) => `- ${g}: ${l.join(", ")}`),
  "",
];
write("llms.txt", lines.join("\n"));

// ---------- agent card ----------
const agent = {
  name: `${p.name} (portfolio agent card)`,
  description: `${v.tagline} Static, read-only card describing a human AI developer. Use the linked JSON files to answer questions about their work.`,
  url: site,
  version: r.meta.version,
  provider: { organization: p.name, url: p.github },
  documentationUrl: `${site}/llms.txt`,
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["application/json", "text/markdown"],
  skills: r.projects.filter((w) => w.featured).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.summary,
    tags: w.skills.map((s) => nodes.get(`skill:${s}`).label),
    examples: [`What did ${p.name.split(" ")[0]} build in ${w.name}?`],
  })),
  resources: {
    resume: `${site}/data/resume.json`,
    graph: `${site}/data/graph.json`,
    llms: `${site}/llms.txt`,
  },
};
write(".well-known/agent.json", JSON.stringify(agent, null, 2));

// ---------- JSON-LD into index.html ----------
const ld = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: p.name,
  jobTitle: p.role,
  url: site,
  email: `mailto:${p.email}`,
  worksFor: { "@type": "Organization", name: p.org },
  alumniOf: r.education.map((e) => ({ "@type": "EducationalOrganization", name: e.school })),
  knowsAbout: r.skills.map((s) => s.label),
  award: r.awards.map((a) => `${a.title} (${a.by})`),
  hasCredential: r.certifications.map((c) => ({ "@type": "EducationalOccupationalCredential", name: c.title })),
  sameAs: [p.github, p.linkedin].filter(Boolean),
  description: v.abstract,
};
const indexPath = join(root, "index.html");
const html = readFileSync(indexPath, "utf8");
const block = `<!-- JSONLD:START -->\n<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>\n<!-- JSONLD:END -->`;
const next = html.replace(/<!-- JSONLD:START -->[\s\S]*?<!-- JSONLD:END -->/, block);
if (next === html && !html.includes(block)) throw new Error("JSON-LD markers missing in index.html");
writeFileSync(indexPath, next);
console.log("updated index.html JSON-LD");

// ---------- sitemap + robots ----------
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${site}/</loc><lastmod>${r.meta.updated}</lastmod></url>
  <url><loc>${site}/llms.txt</loc><lastmod>${r.meta.updated}</lastmod></url>
</urlset>
`);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n# LLM-readable profile: ${site}/llms.txt\n`);

console.log(`graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
