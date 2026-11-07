import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { of } from 'rxjs';
import { GratuityDataService } from '../service/gratuity-data.service';
import { PfDataService } from '../service/pf-data.service';
import { SalaryDataService } from '../service/salary-data.service';
import { DashboardRecordRefreshService } from '../service/dashboard-record-refresh.service';
import { TransferService } from '../service/transfer.service';
import { CentralRecordFormComponent } from './central-record-form.component';

describe('CentralRecordFormComponent', () => {
  let transferService: jasmine.SpyObj<TransferService>;
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let gratuityDataService: jasmine.SpyObj<GratuityDataService>;
  let salaryDataService: jasmine.SpyObj<SalaryDataService>;
  let component: CentralRecordFormComponent;

  beforeEach(() => {
    transferService = jasmine.createSpyObj<TransferService>('TransferService', ['getTransfers', 'updateTransfers']);
    pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'getCachedPfData', 'updatePfData']);
    gratuityDataService = jasmine.createSpyObj<GratuityDataService>(
      'GratuityDataService', ['getGratuityData', 'getCachedGratuityData', 'updateGratuityData']
    );
    salaryDataService = jasmine.createSpyObj<SalaryDataService>('SalaryDataService', ['getSalaryData', 'updateSalaryData']);
    component = new CentralRecordFormComponent(
      transferService,
      pfDataService,
      gratuityDataService,
      salaryDataService,
      new DashboardRecordRefreshService(),
      new ElementRef(document.createElement("div")),
      { markForCheck: () => undefined, detectChanges: () => undefined } as ChangeDetectorRef
    );
  });

  it('converts transfer dates and calculates received INR before saving', async () => {
    transferService.getTransfers.and.returnValue(of([]));
    transferService.updateTransfers.and.returnValue(of([]));
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-01-02',
      amountTransferredAUD: 1000,
      conversionRate: 90.5,
      receivedDate: '2026-01-04'
    });

    await component.submit();

    expect(transferService.updateTransfers).toHaveBeenCalledWith([{
      dateOfTransfer: '02-Jan-26',
      amountTransferredAUD: 1000,
      conversionRate: 90.5,
      receivedDate: '04-Jan-26',
      amountReceivedINR: 90500
    }]);
    expect(component.errorMessage).toBe('');
  });

  it('formats transfer review rows with padded dates and currency values', () => {
    component.changeCategory('transfer');
    component.form.patchValue({
      dateOfTransfer: '2026-11-05',
      amountTransferredAUD: 555,
      conversionRate: 69,
      receivedDate: '2026-11-05'
    });

    expect(component.reviewFields).toEqual([
      { label: 'Transfer Date', value: '05 Nov 2026' },
      { label: 'Amount Sent', value: '$555.00' },
      { label: 'Exchange Rate', value: '69' },
      { label: 'Received Date', value: '05 Nov 2026' },
      { label: 'Amount Received', value: '₹ 38,295' }
    ]);
  });

  it('adds a PF record in the API month format', async () => {
    const document = {
      id: '2', name: 'Kumar', description: '',
      pfRecords: [{ date: "Dec'25", pfAmount: 120000, difference: 3000 }]
    };
    pfDataService.getPfData.and.returnValue(of(document));
    pfDataService.updatePfData.and.returnValue(of(document));
    component.changeCategory('kumarPf');
    component.form.patchValue({ date: '2026-01', amount: 125000, difference: 5000 });

    await component.submit();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...document,
      pfRecords: [
        { date: "Jan'26", pfAmount: 125000, difference: 5000 },
        ...document.pfRecords
      ]
    }, '2');
  });

  it('updates PF monthly difference when the balance changes', () => {
    pfDataService.getPfData.and.returnValue(of({
      id: '3', name: 'Vasuki', description: '',
      pfRecords: [{ date: "Dec'25", pfAmount: 120000, difference: 3000 }]
    }));
    component.changeCategory('vasukiPf');
    component.form.patchValue({ date: '2026-01', amount: 125000 });
    expect(component.form.controls.difference.value).toBe(5000);

    component.form.controls.amount.setValue(118000);

    expect(component.form.controls.difference.value).toBe(-2000);
  });

  it('calculates Kumar and Vasuki gratuity differences from their own previous months', () => {
    const kumarDocument = {
      id: '4', name: 'Kumar', title: '', description: '', type: 'Gratuity',
      gratuityRecords: [{ date: "Dec'25", gratuity: 1000, difference: 100 }]
    };
    const vasukiDocument = {
      id: '5', name: 'Vasuki', title: '', description: '', type: 'Gratuity',
      gratuityRecords: [{ date: "Dec'25", gratuity: 7000, difference: 500 }]
    };
    gratuityDataService.getCachedGratuityData.and.returnValue(null);
    gratuityDataService.getGratuityData.and.returnValues(of(kumarDocument), of(vasukiDocument));

    component.changeCategory('kumarGratuity');
    component.form.patchValue({ date: '2026-01', amount: 1250 });
    expect(component.form.controls.difference.value).toBe(250);

    component.changeCategory('vasukiGratuity');
    component.form.patchValue({ date: '2026-01', amount: 8000 });
    expect(component.form.controls.difference.value).toBe(1000);

    component.form.controls.amount.setValue(8500);
    expect(component.form.controls.difference.value).toBe(1500);
    expect(gratuityDataService.getGratuityData).toHaveBeenCalledWith('4');
    expect(gratuityDataService.getGratuityData).toHaveBeenCalledWith('5');
  });

  it('rejects duplicate salary months regardless of the stored month label format', async () => {
    const document = {
      id: '8', name: 'Kumar', title: '', description: '', type: 'Salary',
      salaryRecords: [{
        date: 'Jan 2026', initialAdvanceRepayment: 0, totalSalary: 1,
        ausTax: 0, indiaDeduction: 0, totalDeduction: 0, ausSalary: 1
      }]
    };
    salaryDataService.getSalaryData.and.returnValue(of(document));
    component.changeCategory('kumarSalary');
    component.form.patchValue({ date: '2026-01' });

    await component.submit();

    expect(salaryDataService.updateSalaryData).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('A salary record already exists for this month.');
  });
});