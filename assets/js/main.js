(async function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [r, graph] = await Promise.all([
    fetch("data/resume.json").then((x) => x.json()),
    fetch("data/graph.json").then((x) => x.json()),
  ]);
  const p = r.person;
  const skill = Object.fromEntries(r.skills.map((s) => [s.id, s]));
  const featured = r.projects.filter((x) => x.featured);
  const fmt = (s) => {
    if (!s) return "Present";
    const [y, m] = String(s).split("-");
    return m ? new Date(+y, +m - 1).toLocaleString("en", { month: "short" }) + " " + y : y;
  };

  // ---------- nav + theme ----------
  const nav = $("#nav");
  if (p.resume) { $("#nav-resume").href = p.resume; $("#nav-resume").hidden = false; }
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const setThemeIcon = () => { $("#theme i").className = `ti ti-${isDark() ? "sun" : "moon"}`; };
  setThemeIcon();
  $("#theme").addEventListener("click", () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark";
    store.set("theme", document.documentElement.dataset.theme);
    setThemeIcon();
  });

  // ---------- hero ----------
  $("#eyebrow").textContent = r.hero.eyebrow;
  const accent = r.hero.accent || "production";
  $("#headline").innerHTML = esc(r.hero.headline).replace(esc(accent), `<em>${esc(accent)}</em>`);
  $("#sub").textContent = r.hero.sub;
  const win = r.awards[0];
  $("#hero-bar").innerHTML = `
    <span class="status">${esc(p.status)}</span>
    <span><i class="ti ti-building" aria-hidden="true"></i>${esc(p.org)}</span>
    <span><i class="ti ti-school" aria-hidden="true"></i>IIT Gandhinagar</span>
    <span class="award"><i class="ti ti-trophy" aria-hidden="true"></i>Hackathon winner · ${esc(win.by.replace("University College London", "UCL").replace(" and ", " × "))}</span>`;

  // ---------- impact: counters ----------
  $("#metrics").innerHTML = r.metrics.map((m, i) => `
    <div class="counter reveal" style="--d:${i * 0.1}s">
      <div class="v"><span data-count="${m.value}">0</span>${esc(m.suffix)}</div>
      <div class="l">${esc(m.label)}</div>
      <div class="n">${esc(m.note)}</div>
    </div>`).join("");

  // ---------- impact: stack marquee (two rows, opposite directions) ----------
  const GROUP_COL = { "Agentic AI": "#9C9CFF", Retrieval: "#5DCAA5", Models: "#85B7EB", Evaluation: "#F2C14E", Backend: "#F0997B", MLOps: "#ED93B1", "Machine learning": "#97C459", Cloud: "#85B7EB", Languages: "#D3D1C7", Data: "#D3D1C7", Automation: "#D3D1C7" };
  const pick = (ids) => ids.map((id) => skill[id]).filter(Boolean);
  const row1 = pick(["langgraph", "langchain", "crewai", "mcp", "rag", "faiss", "pinecone", "chromadb", "gemini", "llama", "whisper", "evals", "guardrails"]);
  const row2 = pick(["python", "fastapi", "celery", "docker", "cicd", "mlflow", "xgboost", "shap", "sklearn", "dl", "gcp", "aws", "azure", "java", "sql"]);
  const chips = (list) => { const h = list.map((s) => `<span><i style="--dot:${GROUP_COL[s.group] || "#D3D1C7"}"></i>${esc(s.label)}</span>`).join(""); return h + h; };
  $("#mq1").innerHTML = chips(row1);
  $("#mq2").innerHTML = chips(row2);
  $$("#mq1 span:nth-child(n+" + (row1.length + 1) + "), #mq2 span:nth-child(n+" + (row2.length + 1) + ")").forEach((s) => s.setAttribute("aria-hidden", "true"));

  // ---------- trajectory: rising curve, drawn as you scroll ----------
  let curve = { path: null, len: 0, pts: [] };
  const drawCurve = () => {
    const host = $("#curve");
    const Wd = Math.max(300, Math.round(host.clientWidth - 48));
    const narrow = Wd < 620;
    const L = 8, R = Wd - 8, T = narrow ? 40 : 70, B = narrow ? 190 : 230, H = B + (narrow ? 30 : 56);
    const toM = (s) => { const [y, m] = String(s).split("-"); return +y * 12 + (m ? +m - 1 : 0); };
    const a = 2022 * 12, z = 2026 * 12 + 11;
    const X = (m) => L + ((m - a) / (z - a)) * (R - L);
    const Y = (v) => B - v * (B - T);
    const now = toM(r.meta.updated.slice(0, 7));
    const byId = Object.fromEntries([...r.roles, ...r.education].map((w) => [w.id, w]));
    const cps = [
      { id: "wpp", v: 0.14, pos: "up", tiny: "WPP" },
      { id: "seniorvig", v: 0.34, pos: "down", tiny: "SeniorVig" },
      { id: "capgemini", v: 0.5, pos: "up", tiny: "Capgemini" },
      { id: "iitgn", v: 0.78, pos: "down", tiny: "IIT Gn" },
      { id: "xccelera", v: 0.9, pos: "up", tiny: "Xccelera" },
    ].map((c) => ({ ...c, m: toM(byId[c.id].start), w: byId[c.id] }));
    const pts = [[a, 0.06], [cps[0].m, 0.14], [2023 * 12 + 6, 0.22], [cps[1].m, 0.34], [cps[2].m, 0.5], [2025 * 12 + 4, 0.64], [cps[3].m, 0.78], [cps[4].m, 0.9], [now, 0.96]];
    const line = d3.line().x((d) => X(d[0])).y((d) => Y(d[1])).curve(d3.curveMonotoneX);
    const eras = [
      { from: a, to: 2023 * 12 + 11, label: "Automation" },
      { from: 2024 * 12, to: 2024 * 12 + 6, label: "Software" },
      { from: 2024 * 12 + 7, to: 2026 * 12, label: "Generative AI" },
      { from: 2026 * 12 + 1, to: now, label: "AI agents" },
    ];
    const frac = (x) => (x - L) / (R - L);
    let s = `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="Career rising from automation in 2022 to AI agents in 2026">`;
    [2022, 2023, 2024, 2025, 2026].forEach((y) => {
      s += `<line x1="${X(y * 12)}" x2="${X(y * 12)}" y1="${narrow ? T - 20 : T - 30}" y2="${B}" stroke="var(--line)" stroke-dasharray="2 4"/>`;
      s += `<text x="${X(y * 12) + 4}" y="${narrow ? B + 22 : T - 34}" font-size="11" fill="var(--ink-3)" font-family="var(--mono)">${y}</text>`;
    });
    s += `<path class="curve-area" d="${line(pts)}L${X(now)} ${B}L${X(a)} ${B}Z" fill="var(--accent)" fill-opacity="0.07"/>`;
    s += `<path class="curve-line" d="${line(pts)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>`;
    if (!narrow) eras.forEach((e, i) => {
      const x0 = X(e.from), w = Math.max(0, X(e.to) - x0 - 3);
      s += `<g class="curve-pt" data-f="${frac(x0).toFixed(3)}"><rect x="${x0}" y="${B + 20}" width="${w}" height="26" rx="6" fill="var(--accent)" fill-opacity="${0.07 + i * 0.07}"/>`;
      if (w > e.label.length * 6.6 + 14) s += `<text x="${x0 + 8}" y="${B + 37}" font-size="11.5" font-weight="500" fill="var(--ink)">${e.label}</text>`;
      s += `</g>`;
    });
    cps.forEach((c) => {
      const x = X(c.m), y = Y(c.v), up = c.pos === "up";
      const end = x > Wd - (narrow ? 50 : 120), start = x < (narrow ? 30 : 60);
      const anchor = end ? "end" : start ? "start" : "middle";
      const tx = end ? x + 6 : start ? x - 6 : x;
      const t1 = narrow ? c.tiny : (c.w.short ? c.w.short.split(" · ")[0] : c.w.title);
      const t2 = narrow ? fmt(c.w.start).split(" ")[1] : (c.w.short ? c.w.short.split(" · ").pop() : c.w.org) + " · " + fmt(c.w.start);
      const ly = up ? y - (narrow ? 30 : 36) : y + (narrow ? 28 : 30);
      s += `<g class="curve-pt" data-f="${frac(x).toFixed(3)}">
        <line x1="${x}" x2="${x}" y1="${up ? ly + 8 : y + 7}" y2="${up ? y - 7 : ly - 13}" stroke="var(--line-2)"/>
        <circle cx="${x}" cy="${y}" r="${narrow ? 5 : 6}" fill="var(--surface)" stroke="${c.id === "iitgn" ? "var(--c-education)" : "var(--accent)"}" stroke-width="2.5"/>
        <text x="${tx}" y="${ly - 12}" text-anchor="${anchor}" font-size="${narrow ? 12 : 13}" font-weight="600" fill="var(--ink)">${esc(t1)}</text>
        <text x="${tx}" y="${ly + 3}" text-anchor="${anchor}" font-size="${narrow ? 11 : 12}" fill="var(--ink-2)">${esc(t2)}</text>
      </g>`;
    });
    s += `<g class="curve-pt" data-f="0.98"><circle cx="${X(now)}" cy="${Y(0.96)}" r="5" fill="var(--accent)">${reduced ? "" : `<animate attributeName="r" values="5;9;5" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.35;1" dur="2.4s" repeatCount="indefinite"/>`}</circle></g>`;
    s += `</svg>`;
    host.innerHTML = s;
    const path = $(".curve-line", host);
    curve = { path, len: Math.ceil(path.getTotalLength()), pts: $$(".curve-pt", host), area: $(".curve-area", host) };
    path.style.strokeDasharray = curve.len;
    onScroll();
  };

  // ---------- selected work: stacked sticky cards ----------
  const HUES = ["#7F77DD", "#378ADD", "#D85A30", "#1D9E75", "#BA7517"];
  const KNAME = { plan: "Goal", tool: "Step", llm: "AI", eval: "Check", result: "Result" };
  $("#stack").innerHTML = featured.map((x, i) => `
    <article class="scard" style="--i:${i};--hue:${HUES[i % HUES.length]}" data-id="${esc(x.id)}">
      <div class="sc-l">
        <span class="sc-num">${String(i + 1).padStart(2, "0")} / ${String(featured.length).padStart(2, "0")}</span>
        <span class="sc-ctx">${esc(x.context)}</span>
        <h3>${esc(x.name)}</h3>
        <p class="sc-kind" style="margin:0">${esc(x.kind)}</p>
        <p class="sc-kpi">${esc(x.kpi || (x.outcomes[0] || {}).label || "")}</p>
        <div class="sc-tags">${x.skills.filter((s) => s !== "python").slice(0, 5).map((s) => `<span>${esc(skill[s].label)}</span>`).join("")}</div>
        <div class="sc-cta">
          <button class="btn btn-light btn-sm sc-open" data-id="${esc(x.id)}">See how it works <i class="ti ti-arrow-right" aria-hidden="true"></i></button>
          <a class="btn btn-glass btn-sm" href="${esc(x.repo)}" target="_blank" rel="noopener"><i class="ti ti-brand-github" aria-hidden="true"></i>Code</a>
          ${x.demo ? `<a class="btn btn-glass btn-sm" href="${esc(x.demo)}" target="_blank" rel="noopener"><i class="ti ti-player-play" aria-hidden="true"></i>Demo</a>` : ""}
        </div>
      </div>
      ${x.trace ? `<div class="sc-r" aria-hidden="true">
        <div class="h"><span>How it works</span><span>${x.trace.length} steps</span></div>
        ${x.trace.map((st, j) => `<div class="sc-step" style="--j:${j}"><b>${j + 1}</b><span>${esc(st.label)}<small>${esc(KNAME[st.type])} · ${esc(st.detail)}</small></span></div>`).join("")}
      </div>` : ""}
    </article>`).join("");
  $("#stack").addEventListener("click", (e) => { const b = e.target.closest(".sc-open"); if (b) openDrawer(b.dataset.id, b); });
  const others = r.projects.length - featured.length;
  $("#more-row").innerHTML = `<a class="btn" href="${esc(p.github)}?tab=repositories" target="_blank" rel="noopener"><i class="ti ti-brand-github" aria-hidden="true"></i>${others} more projects on GitHub <i class="ti ti-arrow-right" aria-hidden="true"></i></a>`;
  const cards = $$(".scard");

  // ---------- principles: overlapping circles ----------
  const CBG = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];
  $("#princ").innerHTML = r.principles.map((x, i) => `
    <div class="circle" style="--i:${i};--cbg:${CBG[i % 4]}"><i class="ti ti-${esc(x.icon)}" aria-hidden="true"></i><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join("");

  // ---------- experience ----------
  $("#xp").innerHTML = r.roles.map((w, i) => `
    <li class="reveal-x" style="--d:${i * 0.08}s">
      <span class="when">${fmt(w.start)} to ${fmt(w.end)}</span>
      <div class="who"><h3>${esc(w.title)}${w.end ? "" : `<span class="now">Now</span>`}</h3><span>${esc(w.org)}</span></div>
      <p class="what">${esc(w.summary)}${w.outcomes.length ? ` <b>${esc(w.outcomes.map((o) => o.label).join(", "))}.</b>` : ""}</p>
    </li>`).join("");

  // ---------- proof + contact ----------
  const iitgn = r.education.find((e) => e.id === "iitgn");
  $("#proof-strip").innerHTML = [
    ...r.awards.map((a) => `<span class="chip"><i class="ti ti-trophy" aria-hidden="true"></i><b>${esc(a.title)}</b></span>`),
    iitgn ? `<span class="chip cert"><i class="ti ti-school" aria-hidden="true"></i>${esc(iitgn.degree)}, ${esc(iitgn.school)}</span>` : "",
    ...r.certifications.slice(0, 4).map((c) => `<span class="chip cert"><i class="ti ti-certificate" aria-hidden="true"></i>${esc(c.title)}</span>`),
  ].join("");
  $("#status-line").textContent = `${p.status}. The fastest way to reach me is email.`;
  $("#contact-links").innerHTML = [
    `<a class="btn primary" href="mailto:${esc(p.email)}"><i class="ti ti-mail" aria-hidden="true"></i>${esc(p.email)}</a>`,
    p.linkedin ? `<a class="btn" href="${esc(p.linkedin)}" target="_blank" rel="noopener"><i class="ti ti-brand-linkedin" aria-hidden="true"></i>LinkedIn</a>` : "",
    `<a class="btn" href="${esc(p.github)}" target="_blank" rel="noopener"><i class="ti ti-brand-github" aria-hidden="true"></i>GitHub</a>`,
    p.resume ? `<a class="btn" href="${esc(p.resume)}"><i class="ti ti-download" aria-hidden="true"></i>Resume</a>` : "",
  ].join("");
  $("#foot-l").textContent = `© ${r.meta.updated.slice(0, 4)} ${p.name}`;

  // ---------- reveal on scroll + count-up ----------
  const countUp = (el) => {
    const to = +el.dataset.count;
    if (el.dataset.done) return;
    el.dataset.done = 1;
    if (reduced) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1600;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick); else el.textContent = to;
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    $$("[data-count]", e.target).forEach(countUp);
    io.unobserve(e.target);
  }), { threshold: 0.18, rootMargin: "0px 0px -60px 0px" });
  $$(".reveal, .reveal-x, .circles, .scard").forEach((el) => io.observe(el));

  // ---------- scroll-linked effects (one rAF per frame) ----------
  const hero = $(".hero"), heroImg = $("#hero-img");
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const storyOn = !$("#story").hidden;
      const y = scrollY, vh = innerHeight;
      const navH = nav.offsetHeight;
      nav.classList.toggle("over", storyOn && y < hero.offsetHeight - navH - 8);
      if (!storyOn) return;

      // hero: photo drifts slower than the page, text lifts and fades
      const hp = clamp(y / hero.offsetHeight);
      if (!reduced) {
        // the photo moves slower than the page and slowly zooms
        heroImg.style.setProperty("--py", `${(hp * hero.offsetHeight * 0.3).toFixed(1)}px`);
        heroImg.style.setProperty("--ps", (1 + hp * 0.08).toFixed(4));
        hero.style.setProperty("--hy", `${(-hp * 70).toFixed(1)}px`);
        hero.style.setProperty("--ho", clamp(1 - hp * 1.5).toFixed(3));
      }

      // trajectory: the line draws itself as the chart scrolls into view
      if (curve.path) {
        const rc = $("#curve").getBoundingClientRect();
        const cp = reduced ? 1 : clamp((vh * 0.92 - rc.top) / (rc.height + vh * 0.35));
        curve.path.style.strokeDashoffset = (curve.len * (1 - cp)).toFixed(1);
        curve.area.style.opacity = cp.toFixed(3);
        curve.pts.forEach((g) => g.classList.toggle("on", cp >= +g.dataset.f * 0.96));
      }

      // stacked cards: each card shrinks and dims as the next one slides over it
      cards.forEach((c, i) => {
        const next = cards[i + 1];
        if (!next || reduced) { c.style.setProperty("--s", 1); c.style.setProperty("--b", 1); return; }
        const top = parseFloat(getComputedStyle(c).top) || 0;
        const h = c.offsetHeight;
        const pr = clamp((top + h - next.getBoundingClientRect().top) / h);
        c.style.setProperty("--s", (1 - pr * 0.06).toFixed(4));
        c.style.setProperty("--b", (1 - pr * 0.45).toFixed(3));
      });
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  drawCurve();
  let curveW = $("#curve").clientWidth, curveT;
  new ResizeObserver(() => {
    const w = $("#curve").clientWidth;
    if (Math.abs(w - curveW) < 8) return;
    curveW = w; clearTimeout(curveT); curveT = setTimeout(drawCurve, 120);
  }).observe($("#curve"));

  // ---------- project drawer ----------
  const KCOL = { plan: "#9C9CFF", tool: "#5DCAA5", llm: "#85B7EB", eval: "#EF9F27", result: "#9FE1CB" };
  let lastFocus = null;
  const runTrace = (x) => {
    const el = $("#dr-trace");
    el.innerHTML = `
      <div class="trace-h"><span>How it works · simplified</span><button id="dr-replay">Replay</button></div>
      ${x.trace.map((st) => `<div class="step" style="--k:${KCOL[st.type]}"><span class="k">${KNAME[st.type]}</span><span>${esc(st.label)}<span class="d">${esc(st.detail)}</span></span></div>`).join("")}
      <div class="ctxbar"><i></i></div>`;
    const steps = $$(".step", el), bar = $(".ctxbar i", el);
    steps.forEach((st, i) => setTimeout(() => { st.classList.add("show"); bar.style.width = `${Math.round(((i + 1) / steps.length) * 72)}%`; }, reduced ? 0 : 350 + i * 420));
    $("#dr-replay").addEventListener("click", () => runTrace(x));
  };
  function openDrawer(id, from) {
    const x = r.projects.find((f) => f.id === id);
    if (!x) return;
    lastFocus = from || document.activeElement;
    $("#drawer-body").innerHTML = `
      <p class="ctx">${esc(x.context)} · ${x.year}</p>
      <h2 id="dr-title">${esc(x.name)}</h2>
      <p class="kind">${esc(x.kind)}</p>
      <p>${esc(x.summary)}</p>
      ${x.outcomes.length ? `<div class="dr-kpis">${x.outcomes.map((o) => `<span class="dr-kpi">${esc(o.label)}</span>`).join("")}</div>` : ""}
      ${x.trace ? `<div class="trace" id="dr-trace"></div>` : ""}
      <div class="dr-tags">${x.skills.map((s) => `<span>${esc(skill[s].label)}</span>`).join("")}</div>
      <div class="dr-links">
        <a class="btn btn-dark" href="${esc(x.repo)}" target="_blank" rel="noopener"><i class="ti ti-brand-github" aria-hidden="true"></i>Repository</a>
        ${x.demo ? `<a class="btn" href="${esc(x.demo)}" target="_blank" rel="noopener"><i class="ti ti-player-play" aria-hidden="true"></i>Demo</a>` : ""}
        <button class="btn" id="dr-graph"><i class="ti ti-chart-dots-3" aria-hidden="true"></i>See in graph</button>
      </div>`;
    $("#drawer").hidden = false; $("#drawer-bg").hidden = false;
    requestAnimationFrame(() => { $("#drawer").classList.add("open"); $("#drawer-bg").classList.add("open"); });
    document.body.style.overflow = "hidden";
    $("#drawer-x").focus();
    if (x.trace) runTrace(x);
    $("#dr-graph").addEventListener("click", () => { closeDrawer(); setView(true); setTimeout(() => kg && kg.select(`project:${x.id}`), 400); });
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open"); $("#drawer-bg").classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { $("#drawer").hidden = true; $("#drawer-bg").hidden = true; }, 350);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $("#drawer-x").addEventListener("click", closeDrawer);
  $("#drawer-bg").addEventListener("click", closeDrawer);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });

  // ---------- graph view ----------
  let kg = null;
  const presets = [
    { label: "Which skills drove results", run: () => kg.select("outcome:o-84") },
    { label: "My path to AI agents", run: () => kg.tracePath("skill:uipath", "skill:langgraph") },
    { label: "Built at IIT Gandhinagar", run: () => kg.select("edu:iitgn") },
    { label: "Security and safety", run: () => { $("#kg-q").value = "guardrails security privacy"; kg.search($("#kg-q").value); } },
  ];
  const initGraph = () => {
    if (kg) return;
    kg = window.KG.init({
      el: $("#kg"), panel: $("#kg-panel"), legend: $("#kg-legend"), data: graph, avatar: p.avatar,
      onOpenProject: (id) => openDrawer(id),
    });
    $("#g-presets").innerHTML = presets.map((x, i) => `<button class="btn btn-sm" data-preset="${i}">${esc(x.label)}</button>`).join("");
    $("#g-presets").addEventListener("click", (e) => { const b = e.target.closest("[data-preset]"); if (b) { resetControls(); presets[+b.dataset.preset].run(); } });
    let qTimer;
    $("#kg-q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => kg.search(e.target.value), 150); });
    $("#kg-year").addEventListener("input", (e) => { $("#kg-year-out").textContent = e.target.value; $("#kg-q").value = ""; kg.setYear(+e.target.value); });
    $("#kg-path").addEventListener("click", (e) => {
      const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
      e.currentTarget.setAttribute("aria-pressed", on);
      kg.setPathMode(on);
    });
    $("#kg-reset").addEventListener("click", () => { resetControls(); kg.setYear(2026); kg.reset(); });
  };
  const resetControls = () => {
    $("#kg-q").value = ""; $("#kg-year").value = 2026; $("#kg-year-out").textContent = "2026";
    if ($("#kg-path").getAttribute("aria-pressed") === "true") { $("#kg-path").setAttribute("aria-pressed", "false"); kg.setPathMode(false); }
  };
  let storyScroll = 0;
  function setView(graphOn) {
    if (graphOn === !$("#graph").hidden) return;
    if (graphOn) storyScroll = scrollY;
    $("#story").hidden = graphOn; $("#graph").hidden = !graphOn;
    $("#tab-story").classList.toggle("on", !graphOn); $("#tab-graph").classList.toggle("on", graphOn);
    $("#tab-story").setAttribute("aria-selected", !graphOn); $("#tab-graph").setAttribute("aria-selected", graphOn);
    history.replaceState(null, "", graphOn ? "#graph" : location.pathname);
    if (graphOn) { scrollTo(0, 0); initGraph(); } else { scrollTo(0, storyScroll); }
    onScroll();
  }
  $("#tab-story").addEventListener("click", () => setView(false));
  $("#tab-graph").addEventListener("click", () => setView(true));
  $("#cta-graph").addEventListener("click", () => setView(true));
  $("#brand").addEventListener("click", (e) => { if (!$("#graph").hidden) { e.preventDefault(); setView(false); scrollTo(0, 0); } });
  if (location.hash === "#graph") setView(true);
  addEventListener("hashchange", () => { if (location.hash === "#graph") setView(true); });
  onScroll();
})();
