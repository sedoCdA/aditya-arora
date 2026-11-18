# sedoCdA.github.io

Portfolio of Aditya Arora, AI developer.

Live at https://sedocda.github.io/aditya-arora

## What's in it

- **Story view**: full-width photo hero with parallax, a dark results band with count-up numbers and a scrolling tool marquee, a career curve that draws as you scroll, project cards that stack as you scroll, overlapping principle circles, experience, and contact.
- **Project drawer**: each project opens a side panel with an illustrative trace replay, metrics, stack, and links.
- **Graph view**: a full-screen knowledge graph of roles, projects, skills, outcomes, and awards, with search, presets, a year slider, and shortest-path tracing.
- **For AI agents**: `llms.txt`, `resume.json`, `graph.json`, an agent card at `/.well-known/agent.json`, and schema.org JSON-LD.

No framework, no backend, no paid services. Fonts: Geist, Geist Mono, and Instrument Serif. Icons: Tabler. Graph: D3.

## Editing

Everything comes from one file: [`data/resume.json`](data/resume.json). Edit it, push, and the GitHub Action regenerates the graph, `llms.txt`, agent card, JSON-LD, and sitemap.

To preview locally:

```bash
node scripts/build.mjs
python -m http.server 8000
# open http://localhost:8000
```

(The page loads JSON with `fetch`, so open it through a local server, not as a file.)

## Deploying

1. Create a public repo named exactly `sedoCdA.github.io`.
2. Push this folder to its `main` branch.
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The `Build and deploy` workflow publishes the site on every push.

## Layout

```
index.html                 page shell
assets/css/style.css       design tokens, light and dark
assets/js/main.js          renders the story view and drawer from resume.json
assets/js/graph.js         graph view, D3 force layout
assets/img/                photo, avatar, social card
data/resume.json           source of truth (edit this)
data/graph.json            generated
llms.txt                   generated
.well-known/agent.json     generated
scripts/build.mjs          the generator
.github/workflows/deploy.yml
```
