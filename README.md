<p align="center">
  <img src="src/assets/logo.svg" alt="Underwrite logo" width="96" height="96" />
</p>

<h1 align="center">Underwrite</h1>

<p align="center">
  <strong>From teaser to IC memo, in one workspace.</strong><br />
  A demo of an app for private credit funds' investment teams: deals, securities, due diligence and investment committee memos.
</p>
<p align="center">
  <a
    target="_blank"
    href="https://underwrite-demo.netlify.app/"
  >
    Live demo
  </a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19%2B-61DAFB?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="MUI" src="https://img.shields.io/badge/MUI-Material-007FFF?logo=mui&logoColor=white" />
  <img alt="Client-side only" src="https://img.shields.io/badge/backend-none-lightgrey" />
</p>

---

## Overview

Underwrite is a fully client-side demo of an application a private credit fund deal team could use to streamline and partially automate their processes: from creating a potential deal based on a PDF teaser all the way to generating and editing a final draft of an Investment Committee (IC) memo.

There is no backend: all of the data are generated samples, the API, the "AI" and the authentication are mocked, but the document handling is partially real: uploading a PDF, Excel or Word file and the app triggers actual parsing in the browser; generating, editing and exporting IC memos yields real downloadable PDF and DOCX files. The goal is to demonstrate what underwriting process assisted with a specialized tool would feel like, without adding complex infrastrcture and real e2e functionality.

## Highlights

- **Deals pipeline.**  A  deals dashboard viewable as a sortable table or a Kanban board. Filters, sorting and the selected time period live in the URL, so every view is shareable and page-refresh safe. Deals can scoped to a "cycle" - an Agile sprint-inspired entity.
- **New deal in seconds.** Enter it manually, or drop in a teaser PDF and the form pre-fills. Required fields change in accordance with the deal stage.
- **Document parsing.** PDF, XLSX and DOCX are read in the browser and their values are extracted with their source (page, sheet, cell range) and a confidence score.
- **AI suggestions you can accept or decline.** Upload a management report and the app proposes a financial adjustment with evidence and a before/after comparison. Accepting it updates the metrics, the deal's risk level and the activity log, and sends a notification.
- **Risk overview.** A *Risk / Mitigant / Residual risk level* table built from the financials, reconciliation, securities, findings and diligence status. It re-rates itself as data changes.
- **3-year and 5-year history.** The analysis blocks switch between Latest, 3 years and 5 years, with charts against fund policy limits and a reported-vs-management overlay.
- **IC memo generation.** Generate Preliminary, Full or Final memos as numbered versions. The editor is WYSIWYG, and the app flags a memo as stale when the underlying deal data has changed. Memos follow a draft, review, ready and approved workflow, and export to **Word** and **PDF**.
- **Role-based access.** Pick a role on the login screen and the permissions follow (see [Roles](#roles)).

## The hero story: Project Northwind

The seeded data tells one story end to end. Steps to see the story:

1. Log in as **Deal Lead** and open **Project Northwind**. Reported leverage is **7.1x** and the NPL ratio is **6.8%**. Both breach fund policy, and the deal is rated **High** risk.
2. Generate a **Full IC memo**. It recommends *Do not approve in current form*.
3. Back on the deal, upload `Northwind_Management_Accounts_Q2_2026.xlsx` from the demo files.
4. The AI proposes an adjustment: reclassify a **$48M** intercompany cash tranche out of financial debt. It cites the exact cells and the CFO commentary as evidence.
5. **Accept** it. Debt drops from $82M to $34M, leverage to **3.0x**, the NPL ratio to **2.1%**, and risk to **Moderate**. The risk overview and the history charts update.
6. Return to the memo. It is marked **Data changed**. Generate a new version, now *Approve with conditions*, with reported and adjusted figures side by side.
7. Edit a section inline, move the memo through review as the Deal Lead, then approve it as the **IC Partner**. Export to Word or PDF.

### Demo files

The sample documents for the hero story are in `demo-files/`:

| File | Used for |
| --- | --- |
| `Kestrel_Teaser.pdf` | New deal pre-fill from a teaser |
| `Northwind_Financing_Report_Q2_2026.pdf` | Financing report: the reported figures |
| `Northwind_Management_Accounts_Q2_2026.xlsx` | Management accounts: triggers the AI adjustment |
| `Northwind_CFO_Management_Commentary_Q2_2026.docx` | Commentary that supports the adjustment |

## Getting started

Requires Node.js 20 or later.

Development: 

```bash
npm install
npm run dev
```

Production: 
```bash
npm run build  
npm run preview 
```

The app is deployed on Netlify as a static website, requires SPA-specific configuration in `netlify.toml` to avoid 404s on inner routes refresh:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Resetting the demo

All data is stored in the browser, and the app seeds itself on first load. To start over, clear this site's local storage (DevTools → Application → Local Storage). Bumping `VERSION` in `src/api/storage.ts` reseeds everyone automatically.

## Roles

The login screen at `/` offers three roles. Permissions are defined per area (details, securities, due diligence, documents, findings, preliminary memo, final memo).

| Role | Permissions |
| --- | --- |
| **Deal Lead** | Create and edit deals, upload documents, decide on AI suggestions, generate and edit memos |
| **IC Partner** | Review everything, and approve final memos |
| **Analyst** | Read-only access to most areas, cannot generate or edit memos |

## Tech stack

| Area | Choice |
| --- | --- |
| App Framework | React.js (client-side), TypeScript, Vite |
| UI | MUI (community) and Emotion |
| Routing | React Router, data mode (loaders and actions; URL search params as the source of truth) |
| Parsing | `pdfjs-dist`, `read-excel-file`, `mammoth` (all in the browser) |
| Memo editor | Tiptap (ProseMirror) |
| Export | `docx` for Word, `pdfmake` for PDF (lazy-loaded) |
| Persistence | `localStorage` for data, `sessionStorage` for the sessions |

## Project structure

```
src/
├── api/            Mocked, fetch-like API with simulated latency + browser storage layer
├── assets/         Logo and static assets
├── auth/           Route guard "middleware" for the mocked session
├── components/     Shared UI: chips, charts, avatars
├── data/           Seed data (deals, securities, documents, history)
├── features/       Features-specific UI: dashboard, deal page, memo editor, new deal
├── layout/         App UI wrapper and layout components: navbar and sidebar (desktop-only)
├── lib/            Pure logic utilities: permissions, adjustments, risks, history, formatting
├── memo/           Memo generation helpers and interfaces, document model, Word and PDF exporters
├── pages/          Route components
├── parsing/        File readers and rule-based field extractors
├── routes/         Route loaders (details: https://reactrouter.com/start/framework/data-loading)
└── types/          Application-wide interfaces and types: users, deals, securities, diligence, findings, memos
```

## How it works

**Parsing.** Every file type is flattened into lines that carry their location (page, sheet, row). Rule-based extractors then pull out fields such as revenue, debt, leverage, NPL ratio and commentary. Each field records where it came from and how confident the match is.

**Adjustments.** An adjustment is a list of operations (`replace`, `add`, `subtract`) on a metric. Applying it is a pure function, and the deal's risk is re-derived from fund policy limits (leverage ≤ 5x, NPL ≤ 3%).

**Risk overview.** For each risk, the app computes an inherent rating from the reported figures and a residual risk rating from the current figures and the mitigants found in the data: accepted adjustments, covenants, collateral and resolved findings. 

**Memo staleness.** Every deal has a revision counter derived from its activity log. A memo stores the revision it was generated from, and the app flags it as stale when the two differ.

**Exports.** The editor content is converted to one format-neutral HTML-based document model, and both the Word and PDF exporters read it. The PDF exporter is a small layout engine on top of `pdfmake`, with word wrapping, pagination, lists and tables whose header row repeats across pages.

## Limitations

This is a demo, not a real product.

- No server, no real authentication, no real AI. Suggestions come from deterministic rules over the parsed documents.
- Data lives in one browser and is not shared between users or devices.
- The PDF export uses the built-in PDF fonts, no support for non-latin characters.
- Historical figures for deals other than Northwind are generated from current figures and labelled as illustrative.
- Securities, and most of the analysis blocks in Due Diligence are non-editable

## Acknowledgements

The demo project uses a free logo from [logoipsum.com](https://logoipsum.com/).