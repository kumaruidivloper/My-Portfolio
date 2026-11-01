import ExcelJS from 'exceljs';
import { createDashboardExport, DashboardExportTable, downloadDashboardExport } from './dashboard-export';

describe('Dashboard export', () => {
  const tables: DashboardExportTable[] = [
    { name: 'Transfers', columns: ['Date', 'Amount'], rows: [['29-Sep-23', 100.25], ['31-Oct-23', -20]] },
    { name: 'PF', columns: ['Owner', 'Month', 'Amount'], rows: [['A, "B"\nC', "Sep'26", 123.456]] }
  ];

  it('exports every record into consistent CSV columns with a UTF-8 BOM and proper escaping', async () => {
    const blob = await createDashboardExport(tables, 'csv');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([239, 187, 191]);
    expect(await blob.text()).toBe(
      '"Section","Date","Amount","Owner","Month"\r\n' +
      '"Transfers","29-Sep-23","100.25","",""\r\n' +
      '"Transfers","31-Oct-23","-20","",""\r\n' +
      '"PF","","123.456","A, ""B""\nC","Sep\'26"\r\n'
    );
  });

  it('neutralizes formulas in CSV text but preserves negative numeric values', async () => {
    const blob = await createDashboardExport([{
      name: 'Values', columns: ['Text', 'Number'],
      rows: ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', ' \t=1+1'].map((text) => [text, -1])
    }], 'csv');
    const text = await blob.text();
    for (const value of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', ' \t=1+1']) {
      expect(text).toContain(`"'${value}","-1"`);
    }
  });

  it('creates a genuine Excel workbook with separate sheets, numeric cells and frozen filtered headers', async () => {
    const blob = await createDashboardExport(tables, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Transfers', 'PF']);
    const transfers = workbook.getWorksheet('Transfers')!;
    expect(transfers.rowCount).toBe(3);
    expect(transfers.getCell('B2').value).toBe(100.25);
    expect(transfers.getCell('B3').value).toBe(-20);
    expect(transfers.getRow(1).font.bold).toBeTrue();
    expect(transfers.views[0]).toEqual(jasmine.objectContaining({ state: 'frozen', ySplit: 1 }));
    expect(transfers.autoFilter).toBe('A1:B1');
    expect(workbook.getWorksheet('PF')!.getCell('A2').value).toBe('A, "B"\nC');
    expect(workbook.getWorksheet('PF')!.getCell('C2').value).toBe(123.456);
  });

  it('keeps empty data sources as header-only sheets', async () => {
    const blob = await createDashboardExport([{ name: 'Empty', columns: ['Month', 'Balance'], rows: [] }], 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.getWorksheet('Empty')!.rowCount).toBe(1);
  });

  it('stores formula-like Excel text as text rather than a formula', async () => {
    const blob = await createDashboardExport([{
      name: 'Text', columns: ['Owner'], rows: [['=1+1']]
    }], 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.getWorksheet('Text')!.getCell('A2').value).toBe('=1+1');
  });

  it('rejects invalid rows instead of producing an incomplete file', async () => {
    await expectAsync(createDashboardExport([
      { name: 'Bad', columns: ['Amount'], rows: [[NaN]] }
    ], 'csv')).toBeRejectedWithError('Invalid export data in Bad.');
    await expectAsync(createDashboardExport([
      { name: 'Bad', columns: ['Amount'], rows: [[1, 2]] }
    ], 'xlsx')).toBeRejectedWithError('Invalid export data in Bad.');
  });

  it('downloads with the correct extension and cleans up its temporary URL and link', () => {
    jasmine.clock().install();
    try {
      spyOn(URL, 'createObjectURL').and.returnValue('blob:test-export');
      const revoke = spyOn(URL, 'revokeObjectURL');
      const click = spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        expect(this.download).toMatch(/^dashboard-all-data-\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(this.href).toBe('blob:test-export');
        expect(this.isConnected).toBeTrue();
      });
      downloadDashboardExport(new Blob(['data']), 'xlsx');
      expect(click).toHaveBeenCalled();
      expect(document.querySelector('a[href="blob:test-export"]')).toBeNull();
      jasmine.clock().tick(1000);
      expect(revoke).toHaveBeenCalledWith('blob:test-export');
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
