import type { Block, DocModel, Run } from "./blocks";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.addVirtualFileSystem(pdfFonts);

pdfMake.addFonts({
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
});

const NAVY = "#14213D";
const GREY = "#5B6478";

const runs = (rs: Run[]) =>
  rs.map((r) => ({
    text: r.text,
    bold: r.bold,
    italics: r.italic,
    decoration: r.underline ? "underline" : undefined,
  }));

function blockToPdf(blk: Block): unknown {
  switch (blk.t) {
    case "heading":
      return {
        text: runs(blk.runs),
        bold: true,
        fontSize: 11.5,
        color: NAVY,
        margin: [0, 8, 0, 4],
      };
    case "paragraph":
      return { text: runs(blk.runs), margin: [0, 0, 0, 6], lineHeight: 1.25 };
    case "list":
      return {
        [blk.ordered ? "ol" : "ul"]: blk.items.map((i) => ({ text: runs(i) })),
        margin: [0, 0, 0, 6],
        lineHeight: 1.2,
      };
    case "table": {
      const cols = Math.max(...blk.rows.map((r) => r.length));
      return {
        margin: [0, 2, 0, 10],
        table: {
          headerRows: blk.rows[0]?.every((c) => c.header) ? 1 : 0,
          widths: cols === 2 ? ["32%", "*"] : Array(cols).fill("*"),
          body: blk.rows.map((r) =>
            Array.from({ length: cols }, (_, i) => {
              const c = r[i] ?? { header: false, runs: [] };
              return {
                text: runs(c.runs),
                bold: c.header,
                color: c.header ? NAVY : undefined,
                fillColor: c.header ? "#EEF1F8" : undefined,
                fontSize: 9,
              };
            }),
          ),
        },
        layout: {
          hLineColor: () => "#D5D9E3",
          vLineColor: () => "#D5D9E3",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingTop: () => 4,
          paddingBottom: () => 4,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
      };
    }
  }
}

export function buildPdfDefinition(model: DocModel) {
  const content: unknown[] = [
    { text: model.title, fontSize: 19, bold: true, color: NAVY, margin: [0, 0, 0, 4] },
    { text: model.subtitle, fontSize: 11, color: GREY, margin: [0, 0, 0, 12] },
    {
      margin: [0, 0, 0, 10],
      table: {
        widths: ["24%", "*"],
        body: model.meta.map(([k, v]) => [
          { text: k, color: GREY, fontSize: 9 },
          { text: v, bold: true, fontSize: 9 },
        ]),
      },
      layout: {
        hLineColor: () => "#D5D9E3",
        vLineColor: () => "#D5D9E3",
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
    },
  ];
  model.sections.forEach((s, i) => {
    content.push({
      text: `${i + 1}. ${s.title}`,
      fontSize: 13.5,
      bold: true,
      color: NAVY,
      margin: [0, 16, 0, 6],
      tocItem: false,
      headlineLevel: 1,
    });
    content.push({
      canvas: [
        { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.6, lineColor: "#D5D9E3" },
      ],
      margin: [0, 0, 0, 6],
    });
    s.blocks.forEach((b) => content.push(blockToPdf(b)));
  });
  return {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 55],
    defaultStyle: { fontSize: 10 },
    info: { title: model.title, creator: "Underwrite" },
    footer: (page: number, count: number) => ({
      text: `${model.footer}   ·   Page ${page} of ${count}`,
      fontSize: 8,
      color: GREY,
      margin: [40, 18, 40, 0],
    }),
    content,
  };
}

export async function downloadPdf(model: DocModel) {
  pdfMake.createPdf(buildPdfDefinition(model) as never).download(`${model.fileName}.pdf`);
}
