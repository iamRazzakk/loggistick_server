import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { StatusCodes } from "http-status-codes";
import ApiError from "../errors/ApiErrors";

export type ExportFormat = "excel" | "csv" | "pdf";

export type ExportColumn = {
  header: string;
  key: string;
  width: number;
};

export type ExportCell = string | number;

export type ExportFile = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

const FORMATS: ExportFormat[] = ["excel", "csv", "pdf"];

const CONTENT_TYPE: Record<ExportFormat, string> = {
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
};

const EXTENSION: Record<ExportFormat, string> = {
  excel: "xlsx",
  csv: "csv",
  pdf: "pdf",
};

export const resolveExportFormat = (value: unknown): ExportFormat => {
  const format = String(value ?? "excel").trim().toLowerCase();
  if (FORMATS.includes(format as ExportFormat)) return format as ExportFormat;
  throw new ApiError(
    StatusCodes.BAD_REQUEST,
    "type must be excel, csv, or pdf",
  );
};

export const exportTypeFromQuery = (query: Record<string, unknown>) => {
  const key = Object.keys(query).find((name) => name.toLowerCase() === "type");
  const value = key ? query[key] : undefined;
  return resolveExportFormat(Array.isArray(value) ? value[0] : value);
};

const csvCell = (value: ExportCell | undefined) => {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const writeCsv = ({ columns, rows }: TabularInput) => {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column.key])).join(","),
    ),
  ];
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
};

type TabularInput = {
  sheetName: string;
  columns: ExportColumn[];
  rows: Record<string, ExportCell>[];
};

const workbookFor = ({ sheetName, columns, rows }: TabularInput) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  rows.forEach((row) => worksheet.addRow(row));
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  header.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  return workbook;
};

const writeExcel = async (input: TabularInput) =>
  Buffer.from(await workbookFor(input).xlsx.writeBuffer());

const writePdf = ({ sheetName, columns, rows }: TabularInput) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: columns.length > 10 ? "A3" : "A4",
      layout: "landscape",
      margin: 24,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = doc.page.margins.left;
    const tableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const weight = columns.reduce((sum, column) => sum + column.width, 0) || 1;
    const colWidths = columns.map(
      (column) => (column.width / weight) * tableWidth,
    );
const fontSize = columns.length > 18 ? 5 : columns.length > 12 ? 6 : 8;
    const rowHeight = fontSize + 10;
    const bottom = doc.page.height - doc.page.margins.bottom;
    const cell = (value: ExportCell | undefined) =>
      value == null || value === "" ? "-" : String(value);

    const paintRow = (
      y: number,
      values: string[],
      font: string,
      color: string,
    ) => {
      doc.font(font).fontSize(fontSize).fillColor(color);
      let x = margin;
      values.forEach((value, index) => {
        doc.text(value, x + 2, y + 3, {
          width: Math.max(colWidths[index] - 4, 4),
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
        x += colWidths[index];
      });
      doc.y = y + rowHeight;
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.save();
      doc.rect(margin, y, tableWidth, rowHeight).fill("#1F4E79");
      doc.restore();
      paintRow(
        y,
        columns.map((column) => column.header),
        "Helvetica-Bold",
        "#FFFFFF",
      );
    };

    doc.font("Helvetica-Bold").fontSize(14).fillColor("#1F4E79").text(sheetName);
    doc.moveDown(0.4);
    drawHeader();

    if (rows.length === 0) {
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(10).fillColor("#333333").text("No records");
      doc.end();
      return;
    }

    rows.forEach((row, index) => {
      if (doc.y + rowHeight > bottom) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (index % 2 === 1) {
        doc.save();
        doc.rect(margin, y, tableWidth, rowHeight).fill("#F3F6F9");
        doc.restore();
      }
      paintRow(
        y,
        columns.map((column) => cell(row[column.key])),
        "Helvetica",
        "#111111",
      );
      doc
        .save()
        .strokeColor("#D0D7DE")
        .lineWidth(0.4)
        .moveTo(margin, y + rowHeight)
        .lineTo(margin + tableWidth, y + rowHeight)
        .stroke()
        .restore();
    });

    doc.end();
  });

const WRITERS = {
  excel: writeExcel,
  csv: writeCsv,
  pdf: writePdf,
};

export const writeTabularExport = async (
  input: TabularInput & { format: ExportFormat; filename: string },
): Promise<ExportFile> => ({
  buffer: await WRITERS[input.format](input),
  contentType: CONTENT_TYPE[input.format],
  filename: `${input.filename}.${EXTENSION[input.format]}`,
});
