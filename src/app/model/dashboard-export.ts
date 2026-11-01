export type DashboardExportFormat = 'csv' | 'xlsx';
export type ExportCell = string | number;

export interface DashboardExportTable {
  name: string;
  columns: string[];
  rows: ExportCell[][];
}

function csvCell(value: ExportCell): string {
  // Quoting alone does not prevent spreadsheet apps from executing formulas.
  const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)
    ? `'${value}` : String(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function createDashboardExport(
  tables: DashboardExportTable[],
  format: DashboardExportFormat
): Promise<Blob> {
  for (const table of tables) {
    if (table.rows.some((row) => row.length !== table.columns.length ||
      row.some((cell) => typeof cell !== 'string' &&
        (typeof cell !== 'number' || !Number.isFinite(cell))))) {
      throw new Error(`Invalid export data in ${table.name}.`);
    }
  }

  if (format === 'csv') {
    const columns = [...new Set(tables.flatMap((table) => table.columns))];
    const lines = [['Section', ...columns].map(csvCell).join(',')];
    for (const table of tables) {
      const positions = columns.map((column) => table.columns.indexOf(column));
      for (const row of table.rows) {
        lines.push([table.name, ...positions.map((index) => index < 0 ? '' : row[index])]
          .map(csvCell).join(','));
      }
    }
    return new Blob(['\ufeff', lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' });
  }

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  for (const table of tables) {
    const sheet = workbook.addWorksheet(table.name);
    sheet.columns = table.columns.map((header) => ({ header, width: Math.max(20, header.length + 2) }));
    sheet.addRows(table.rows);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } };
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { wrapText: true };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  // Copy to an ArrayBuffer-backed view suitable for the browser Blob API.
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

export function downloadDashboardExport(blob: Blob, format: DashboardExportFormat): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dashboard-all-data-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
