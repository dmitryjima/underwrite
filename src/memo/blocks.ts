import type { ICMemo } from "../types/memos";

/**
 * Format-neutral document model. Memo sections are stored as HTML (that is what the WYSIWYG editor
 * produces); both exporters (DOCX, PDF) consume this model so they cannot drift apart.
 */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
export interface Cell {
  header: boolean;
  runs: Run[];
}
export type Block =
  | { t: "heading"; runs: Run[] }
  | { t: "paragraph"; runs: Run[] }
  | { t: "list"; ordered: boolean; items: Run[][] }
  | { t: "table"; rows: Cell[][] };

export interface DocModel {
  title: string;
  subtitle: string;
  meta: [string, string][];
  sections: { title: string; blocks: Block[] }[];
  footer: string;
  fileName: string;
}

export type HtmlParser = (html: string) => Element;
const browserParse: HtmlParser = (html) =>
  new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;

type Style = Pick<Run, "bold" | "italic" | "underline">;

function inlineRuns(node: Node, style: Style = {}): Run[] {
  const out: Run[] = [];
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) {
      const text = (c.textContent ?? "").replace(/\s+/g, " ");
      if (text) out.push({ text, ...style });
    } else if (c.nodeType === 1) {
      const el = c as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") out.push({ text: "\n", ...style });
      else {
        const next: Style = { ...style };
        if (tag === "strong" || tag === "b") next.bold = true;
        if (tag === "em" || tag === "i") next.italic = true;
        if (tag === "u") next.underline = true;
        out.push(...inlineRuns(el, next));
      }
    }
  });
  return out;
}

/** Trims the outer whitespace of a run list and merges neighbours with identical styling. */
function tidy(runs: Run[]): Run[] {
  const r = runs.map((x) => ({ ...x }));
  while (r.length && !r[0].text.trim() && r[0].text !== "\n") r.shift();
  while (r.length && !r[r.length - 1].text.trim() && r[r.length - 1].text !== "\n") r.pop();
  if (r.length) {
    r[0].text = r[0].text.replace(/^\s+/, "");
    r[r.length - 1].text = r[r.length - 1].text.replace(/\s+$/, "");
  }
  const merged: Run[] = [];
  for (const x of r) {
    const last = merged[merged.length - 1];
    if (
      last &&
      !!last.bold === !!x.bold &&
      !!last.italic === !!x.italic &&
      !!last.underline === !!x.underline &&
      last.text !== "\n" &&
      x.text !== "\n"
    )
      last.text += x.text;
    else merged.push(x);
  }
  return merged.filter((x) => x.text !== "");
}

export function htmlToBlocks(html: string, parse: HtmlParser = browserParse): Block[] {
  const blocks: Block[] = [];
  const walk = (parent: Element) => {
    let loose: Run[] = [];
    const flush = () => {
      const runs = tidy(loose);
      if (runs.length) blocks.push({ t: "paragraph", runs });
      loose = [];
    };
    parent.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        loose.push(...inlineRuns({ childNodes: [c] } as unknown as Node));
        return;
      }
      if (c.nodeType !== 1) return;
      const el = c as Element;
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        flush();
        const runs = tidy(inlineRuns(el));
        if (runs.length) blocks.push({ t: "heading", runs });
      } else if (tag === "p") {
        flush();
        const runs = tidy(inlineRuns(el));
        if (runs.length) blocks.push({ t: "paragraph", runs });
      } else if (tag === "ul" || tag === "ol") {
        flush();
        const items = Array.from(el.children)
          .filter((x) => x.tagName.toLowerCase() === "li")
          .map((li) => tidy(inlineRuns(li)))
          .filter((r) => r.length);
        if (items.length) blocks.push({ t: "list", ordered: tag === "ol", items });
      } else if (tag === "table") {
        flush();
        const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.children)
            .filter((x) => /^t[hd]$/.test(x.tagName.toLowerCase()))
            .map((cell) => ({
              header: cell.tagName.toLowerCase() === "th",
              runs: tidy(inlineRuns(cell)),
            })),
        );
        if (rows.length) blocks.push({ t: "table", rows });
      } else if (tag === "blockquote" || tag === "div" || tag === "section") {
        flush();
        walk(el);
      } else loose.push(...inlineRuns({ childNodes: [el] } as unknown as Node));
    });
    flush();
  };
  walk(parse(html));
  return blocks;
}

export function buildDocModel(
  memo: ICMemo,
  info: {
    dealName: string;
    borrower: string;
    owner?: string;
    generatedBy?: string;
    cycle?: string;
  },
  parse?: HtmlParser,
): DocModel {
  const date = new Date(memo.generatedAt ?? memo.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const typeLabel =
    memo.type === "preliminary" ? "Preliminary" : memo.type === "final" ? "Final" : "Full";
  return {
    title: memo.title,
    subtitle: `Investment Committee memorandum · Version ${memo.version} · ${typeLabel}`,
    meta: [
      ["Borrower", info.borrower],
      ["Date", date],
      ["Status", memo.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())],
      ...(info.cycle ? ([["IC cycle", info.cycle]] as [string, string][]) : []),
      ...(info.owner ? ([["Deal owner", info.owner]] as [string, string][]) : []),
    ],
    sections: memo.sections.map((s) => ({
      title: s.title,
      blocks: htmlToBlocks(s.content, parse),
    })),
    footer: `Confidential · ${info.dealName} · IC memo v${memo.version}`,
    fileName: `${info.dealName.replace(/[^\w]+/g, "_")}_IC_Memo_v${memo.version}`,
  };
}
