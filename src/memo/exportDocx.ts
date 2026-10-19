import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
  type INumberingOptions,
} from "docx";
import type { Block, DocModel, Run } from "./blocks";

const FONT = "Arial";
const NAVY = "14213D";
const GREY = "5B6478";
const CONTENT_WIDTH = 9638; // A4 (11906) minus 2 x 1134 twips margins

const textRuns = (
  runs: Run[],
  base: { size?: number; color?: string; bold?: boolean } = {},
): ParagraphChild[] =>
  runs.flatMap((r) =>
    r.text.split("\n").flatMap((part, i) => [
      new TextRun({
        text: part,
        break: i > 0 ? 1 : undefined,
        bold: r.bold || base.bold,
        italics: r.italic,
        underline: r.underline ? {} : undefined,
        font: FONT,
        size: base.size ?? 21,
        color: base.color,
      }),
    ]),
  );

const hairline = { style: BorderStyle.SINGLE, size: 4, color: "D5D9E3" };
const cellBorders = { top: hairline, bottom: hairline, left: hairline, right: hairline };

export async function buildDocx(model: DocModel): Promise<Blob> {
  const numbering: INumberingOptions["config"][number][] = [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 270 } } },
        },
      ],
    },
  ];
  let orderedCount = 0;

  const blockToDocx = (blk: Block): (Paragraph | Table)[] => {
    switch (blk.t) {
      case "heading":
        return [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
            children: textRuns(blk.runs, { bold: true, size: 22, color: NAVY }),
          }),
        ];
      case "paragraph":
        return [
          new Paragraph({ spacing: { after: 120, line: 288 }, children: textRuns(blk.runs) }),
        ];
      case "list": {
        let reference = "bullets";
        if (blk.ordered) {
          reference = `ordered-${++orderedCount}`; // a fresh numbering instance per list so each restarts at 1
          numbering.push({
            reference,
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 540, hanging: 360 } } },
              },
            ],
          });
        }
        return blk.items.map(
          (item) =>
            new Paragraph({
              numbering: { reference, level: 0 },
              spacing: { after: 60, line: 276 },
              children: textRuns(item),
            }),
        );
      }
      case "table": {
        const cols = Math.max(...blk.rows.map((r) => r.length));
        const first =
          cols === 2 ? Math.round(CONTENT_WIDTH * 0.32) : Math.round(CONTENT_WIDTH / cols);
        const widths =
          cols === 2
            ? [first, CONTENT_WIDTH - first]
            : Array(cols).fill(Math.floor(CONTENT_WIDTH / cols));
        widths[widths.length - 1] += CONTENT_WIDTH - widths.reduce((a, c) => a + c, 0);
        return [
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: widths,
            rows: blk.rows.map(
              (row) =>
                new TableRow({
                  tableHeader: row.every((c) => c.header),
                  cantSplit: true,
                  children: Array.from({ length: cols }, (_, i) => {
                    const cell = row[i] ?? { header: false, runs: [] };
                    return new TableCell({
                      width: { size: widths[i], type: WidthType.DXA },
                      borders: cellBorders,
                      margins: { top: 70, bottom: 70, left: 110, right: 110 },
                      shading: cell.header
                        ? { type: ShadingType.CLEAR, fill: "EEF1F8", color: "auto" }
                        : undefined,
                      children: [
                        new Paragraph({
                          children: textRuns(cell.runs, {
                            size: 19,
                            bold: cell.header,
                            color: cell.header ? NAVY : undefined,
                          }),
                        }),
                      ],
                    });
                  }),
                }),
            ),
          }),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
        ];
      }
    }
  };

  const meta = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2400, CONTENT_WIDTH - 2400],
    rows: model.meta.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 110, right: 110 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: k, font: FONT, size: 19, color: GREY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: CONTENT_WIDTH - 2400, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 60, bottom: 60, left: 110, right: 110 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: v, font: FONT, size: 19, bold: true })],
                }),
              ],
            }),
          ],
        }),
    ),
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: model.title, font: FONT, size: 38, bold: true, color: NAVY })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: model.subtitle, font: FONT, size: 22, color: GREY })],
    }),
    meta,
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
  for (const [i, s] of model.sections.entries()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        keepNext: true,
        spacing: { before: 320, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D5D9E3", space: 4 } },
        children: [
          new TextRun({
            text: `${i + 1}. ${s.title}`,
            font: FONT,
            size: 27,
            bold: true,
            color: NAVY,
          }),
        ],
      }),
    );
    for (const blk of s.blocks) children.push(...blockToDocx(blk));
  }

  const doc = new Document({
    creator: "Underwrite",
    title: model.title,
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: 27, bold: true, color: NAVY },
          paragraph: { outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, size: 22, bold: true, color: NAVY },
          paragraph: { outlineLevel: 1 },
        },
      ],
    },
    numbering: { config: numbering },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D5D9E3", space: 6 } },
                children: [
                  new TextRun({
                    text: model.footer + "   ·   Page ",
                    font: FONT,
                    size: 16,
                    color: GREY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: GREY,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}
