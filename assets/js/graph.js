// Figure 2: knowledge graph. D3 force layout plus in-browser retrieval
// (keyword + alias match, then one-hop expansion), year filter, and path tracing.
(function () {
  const TYPES = ["person", "role", "project", "outcome", "skill", "education", "award", "certification"];
  const TYPE_LABEL = { person: "Person", role: "Role", project: "Project", outcome: "Result", skill: "Skill", education: "Education", award: "Award", certification: "Certification" };
  const RING = { person: 0, role: 95, education: 95, award: 150, certification: 170, skill: 185, project: 285, outcome: 360 };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function init({ el, panel, legend, data, onOpenProject, avatar }) {
    const nodes = data.nodes.map((d) => ({ ...d }));
    const links = data.edges.map((e) => ({ ...e }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    links.forEach((l) => { adj.get(l.source).add(l.target); adj.get(l.target).add(l.source); });
    nodes.forEach((n) => (n.deg = adj.get(n.id).size));

    const radius = (n) => {
      if (n.type === "person") return 20;
      if (n.type === "role") return 12;
      if (n.type === "education") return 10;
      if (n.type === "project") return n.featured ? 10 : 7;
      if (n.type === "outcome" || n.type === "award") return 7;
      if (n.type === "certification") return 5;
      return Math.min(4 + n.deg * 0.7, 10);
    };
    const showLabel = (n) =>
      ["person", "role", "education", "outcome"].includes(n.type) ||
      (n.type === "project" && n.featured) ||
      (n.type === "skill" && n.deg >= 6);

    legend.innerHTML = TYPES.filter((t) => t !== "person").map((t) => `<span style="--c: var(--c-${t})">${TYPE_LABEL[t]}</span>`).join("") + `<span class="muted">Hover or tap a dot for its name</span>`;

    const W = () => el.clientWidth, H = () => el.clientHeight;
    const svg = d3.select(el).append("svg").attr("role", "img").attr("aria-label", "Knowledge graph of roles, projects, skills, and outcomes");
    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.35, 3]).on("zoom", (ev) => g.attr("transform", ev.transform));
    svg.call(zoom).on("dblclick.zoom", null);

    const link = g.append("g").selectAll("line").data(links).join("line").attr("class", "kg-link");
    const node = g.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", (d) => `kg-node ${d.type}`)
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", (d) => `${TYPE_LABEL[d.type]}: ${d.label}`);
    node.append("circle").attr("r", radius).style("fill", (d) => `var(--c-${d.type})`);
    if (avatar) {
      svg.append("defs").append("clipPath").attr("id", "kg-clip").append("circle").attr("r", 18);
      node.filter((d) => d.type === "person").append("image")
        .attr("href", avatar).attr("x", -18).attr("y", -18).attr("width", 36).attr("height", 36)
        .attr("clip-path", "url(#kg-clip)").style("pointer-events", "none");
    }
    node.append("text").attr("dx", (d) => radius(d) + 4).attr("dy", "0.35em").text((d) => d.label);
    node.classed("nolabel", (d) => !showLabel(d));
    node.append("title").text((d) => `${d.label}${d.detail ? " · " + d.detail : ""}`);

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(70).strength(0.15))
      .force("charge", d3.forceManyBody().strength((d) => (d.type === "skill" ? -80 : -200)))
      .force("collide", d3.forceCollide().radius((d) => radius(d) + (showLabel(d) ? 14 : 6)))
      .force("ring", d3.forceRadial((d) => RING[d.type] ?? 200, 0, 0).strength((d) => (d.type === "person" ? 1 : 0.5)))
      .stop();
    const draw = () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    };
    // Settle the layout before first paint, so the graph appears already arranged.
    sim.tick(320);
    draw();
    sim.on("tick", draw);

    // Zoom to fit all visible nodes, or only the ids in `only` (a Set) when given.
    const fit = (dur = 600, only = null) => {
      const vis = nodes.filter((n) => !n._gone && (!only || only.has(n.id)));
      if (!vis.length) return;
      const xs = vis.map((n) => n.x), ys = vis.map((n) => n.y);
      const [x0, x1, y0, y1] = [Math.min(...xs) - 40, Math.max(...xs) + 130, Math.min(...ys) - 40, Math.max(...ys) + 40];
      const k = Math.min(only ? 1.6 : 2, 0.92 / Math.max((x1 - x0) / W(), (y1 - y0) / H()));
      const t = d3.zoomIdentity.translate(W() / 2, H() / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      if (dur) svg.transition().duration(dur).call(zoom.transform, t);
      else svg.call(zoom.transform, t);
    };
    let fitted = true;
    fit(0);
    new ResizeObserver(() => fit(0)).observe(el);

    node.call(d3.drag()
      .on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end", (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    // ---------- state ----------
    let year = 2026, pathMode = false, pathA = null;

    const paint = (on, sel = [], onLinks = null) => {
      node.classed("dim", (d) => on && !on.has(d.id)).classed("sel", (d) => sel.includes(d.id));
      node.classed("nolabel", (d) => !(showLabel(d) && !on) && !(on && on.has(d.id)));
      link.classed("dim", (l) => on && !(on.has(l.source.id) && on.has(l.target.id)))
        .classed("on", (l) => (onLinks ? onLinks.has(key(l)) : on && sel.length && (sel.includes(l.source.id) || sel.includes(l.target.id)) && on.has(l.source.id) && on.has(l.target.id)));
      if (on && on.size > 1 && fitted) fit(700, on);
    };
    const key = (l) => [l.source.id ?? l.source, l.target.id ?? l.target].sort().join("|");

    const neighborhood = (id) => {
      const t = byId.get(id).type;
      const on = new Set([id]);
      adj.get(id).forEach((n) => on.add(n));
      // skill -> work -> outcomes, and outcome -> work -> skills
      if (t === "skill" || t === "outcome") {
        adj.get(id).forEach((w) => {
          const wt = byId.get(w).type;
          if (wt === "role" || wt === "project") adj.get(w).forEach((n) => {
            const nt = byId.get(n).type;
            if (nt !== t && (nt === "skill" || nt === "outcome")) on.add(n);
          });
        });
      }
      return new Set([...on].filter((n) => !byId.get(n)._gone));
    };

    const pills = (ids) => ids.map((id) => `<button class="pill" data-id="${esc(id)}">${esc(byId.get(id).label)}</button>`).join("");
    const grouped = (ids, skip) => {
      const by = {};
      ids.forEach((id) => { if (id !== skip) (by[byId.get(id).type] ||= []).push(id); });
      return TYPES.filter((t) => by[t]).map((t) => `<div class="grp"><div class="grp-h">${TYPE_LABEL[t]}${by[t].length > 1 ? "s" : ""} · ${by[t].length}</div>${pills(by[t])}</div>`).join("");
    };

    const intro = () => {
      panel.innerHTML = `
        <div class="type muted">Everything connected</div>
        <h4>My work as a map</h4>
        <p class="sub">Each dot is a job, project, skill, or result. Tap one to see what it links to, or try one of these.</p>
        <div class="grp">${pills(["skill:langgraph", "skill:rag", "outcome:o-84", "edu:iitgn", "skill:xgboost"].filter((i) => byId.has(i)))}</div>
        <p class="muted" style="margin-top:14px">Scroll or pinch to zoom. Drag to move around.</p>`;
    };

    const select = (id) => {
      const n = byId.get(id);
      if (!n || n._gone) return;
      if (pathMode) return pathClick(id);
      const on = neighborhood(id);
      paint(on, [id]);
      const linksHtml = [
        n.repo ? `<a href="${esc(n.repo)}" target="_blank" rel="noopener">Repository</a>` : "",
        n.demo ? `<a href="${esc(n.demo)}" target="_blank" rel="noopener">Demo</a>` : "",
        n.type === "project" && n.featured ? `<a href="#" data-open="${esc(n.id.split(":")[1])}">Open project</a>` : "",
      ].filter(Boolean).join(" · ");
      panel.innerHTML = `
        <div class="type" style="color: var(--c-${n.type})">${TYPE_LABEL[n.type]} · ${n.year}</div>
        <h4>${esc(n.label)}</h4>
        ${n.detail ? `<p class="sub">${esc(n.detail)}</p>` : ""}
        ${n.summary ? `<p>${esc(n.summary)}</p>` : ""}
        ${linksHtml ? `<p>${linksHtml}</p>` : ""}
        ${grouped([...on], id)}`;
    };

    const search = (q) => {
      q = q.trim().toLowerCase();
      if (!q) return reset(false);
      const toks = q.split(/[\s,]+/).filter((t) => t.length > 1 && !["in", "the", "and", "of", "with", "for", "to", "a"].includes(t));
      const res = toks.map((t) => new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      const scored = nodes.filter((n) => !n._gone && n.type !== "person").map((n) => {
        const label = n.label.toLowerCase();
        const hay = [n.label, n.detail, n.summary, ...(n.aliases || [])].join(" ").toLowerCase();
        const s = res.reduce((acc, re) => acc + (re.test(label) ? 3 : re.test(hay) ? 1 : 0), 0);
        return [n.id, s];
      }).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
      const hits = scored.slice(0, 12).map(([id]) => id);
      const on = new Set(hits);
      hits.forEach((h) => adj.get(h).forEach((n) => { const nn = byId.get(n); if (!nn._gone && nn.type !== "skill" && nn.type !== "person") on.add(n); }));
      paint(hits.length ? on : new Set(), hits);
      panel.innerHTML = hits.length
        ? `<div class="type muted">Search results</div>
           <h4>${hits.length} matches</h4>
           <p class="sub">Highlighted: everything that matches your search, plus what it's directly connected to.</p>
           ${grouped([...on])}`
        : `<div class="type muted">Search results</div><h4>No matches</h4><p class="sub">Try "agents", "rag", "voice", "fraud", or "evals".</p>`;
    };

    const setYear = (y) => {
      year = y;
      nodes.forEach((n) => (n._gone = n.year > y));
      node.classed("gone", (d) => d._gone);
      link.classed("gone", (l) => l.source._gone || l.target._gone);
      paint(null);
      intro();
    };

    const pathClick = (id) => {
      if (!pathA) {
        pathA = id;
        paint(new Set([id]), [id]);
        panel.innerHTML = `<div class="type muted">Trace a path</div><h4>${esc(byId.get(id).label)}</h4><p class="sub">Now tap a second dot.</p>`;
        return;
      }
      const prev = new Map([[pathA, null]]);
      const q = [pathA];
      while (q.length) {
        const c = q.shift();
        if (c === id) break;
        adj.get(c).forEach((n) => { if (!prev.has(n) && !byId.get(n)._gone) { prev.set(n, c); q.push(n); } });
      }
      const path = [];
      for (let c = prev.has(id) ? id : null; c; c = prev.get(c)) path.unshift(c);
      const on = new Set(path);
      const onLinks = new Set(path.slice(1).map((p, i) => [p, path[i]].sort().join("|")));
      paint(on, [pathA, id], onLinks);
      panel.innerHTML = path.length
        ? `<div class="type muted">How they connect · ${path.length - 1} steps</div><h4>${esc(byId.get(pathA).label)} to ${esc(byId.get(id).label)}</h4>
           <ol style="padding-left:18px;margin:8px 0">${path.map((p) => `<li><span style="color: var(--c-${byId.get(p).type})">●</span> ${esc(byId.get(p).label)}</li>`).join("")}</ol>
           <p class="muted">Tap another dot to start again.</p>`
        : `<div class="type muted">Trace a path</div><h4>No path</h4><p class="sub">These two aren't connected in the years shown.</p>`;
      pathA = null;
    };

    const reset = (refit = true) => { pathA = null; paint(null); intro(); if (refit) fit(); };

    node.on("click", (ev, d) => { ev.stopPropagation(); select(d.id); })
      .on("keydown", (ev, d) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(d.id); } });
    svg.on("click", () => { if (!pathMode) reset(false); });
    panel.addEventListener("click", (ev) => {
      const p = ev.target.closest(".pill");
      if (p) return select(p.dataset.id);
      const o = ev.target.closest("[data-open]");
      if (o && onOpenProject) { ev.preventDefault(); onOpenProject(o.dataset.open); }
    });

    intro();
    return {
      search, setYear, reset, select,
      tracePath(a, b) { if (!byId.has(a) || !byId.has(b)) return; pathA = a; pathClick(b); },
      setPathMode(on) { pathMode = on; pathA = null; paint(null); panel.innerHTML = on ? `<div class="type muted">Trace a path</div><h4>Tap any two dots</h4><p class="sub">You'll see how they're connected, step by step.</p>` : ""; if (!on) intro(); },
    };
  }

  window.KG = { init };
})();
