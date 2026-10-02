import { ChangeDetectorRef } from '@angular/core';
import { MyDashboardComponent } from './my-dashboard.component';
import { TransferRecord } from '../model/transfer';
import { TransferService } from '../service/transfer.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { of, throwError } from 'rxjs';

describe('MyDashboardComponent', () => {
  let component: MyDashboardComponent;
  let transferService: jasmine.SpyObj<TransferService>;
  let confirmationCodeService: jasmine.SpyObj<ConfirmationCodeService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  const transfers: TransferRecord[] = [
    {
      dateOfTransfer: '29-Sep-23',
      amountTransferredAUD: 100,
      conversionRate: 53.5,
      receivedDate: '05-Oct-23',
      amountReceivedINR: 5350
    },
    {
      dateOfTransfer: '31-Oct-23',
      amountTransferredAUD: 200,
      conversionRate: 54,
      receivedDate: '03-Nov-23',
      amountReceivedINR: 10800
    }
  ];

  beforeEach(() => {
    transferService = jasmine.createSpyObj<TransferService>(
      'TransferService',
      ['getTransfers', 'updateTransfers']
    );
    transferService.getTransfers.and.returnValue(of(transfers));
    confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>('ConfirmationCodeService', ['verify']);
    confirmationCodeService.verify.and.resolveTo(true);
    changeDetector = createChangeDetector();
    component = new MyDashboardComponent(transferService, changeDetector, confirmationCodeService);
    component.ngOnInit();
  });

  it('changes chart type without changing loaded transfers', () => {
    component.selectChartType('line');

    expect(component.selectedChartType).toBe('line');
    expect(component.lineChartData[0].name).toBe('Amount sent (AUD)');
    expect(component.lineChartData[0].series.length).toBe(2);
  });

  it('charts received INR amounts from the loaded transfer records', () => {
    component.selectMetric('amountReceivedINR');

    expect(component.chartData.map((datum) => datum.name)).toEqual(['29 Sep 2023', '31 Oct 2023']);
    expect(component.chartData.map((datum) => datum.value)).toEqual([5350, 10800]);
  });

  it('formats chart tooltip values with the selected metric currency', () => {
    expect(component.formatChartValue(1234.5)).toBe('$ 1,234.50');

    component.selectMetric('amountReceivedINR');
    expect(component.formatChartValue(1234.5)).toBe('₹ 1,234.50');

    component.selectMetric('conversionRate');
    expect(component.formatChartValue(53.5)).toBe('₹ 53.50 / AUD');
  });

  it('formats transfer grid amounts with spaced currency symbols', () => {
    expect(component.formatTransferCurrency(1234.5, 'AUD')).toBe('$ 1,234.50');
    expect(component.formatTransferCurrency(1234.5, 'INR')).toBe('₹ 1,234.50');
  });

  it('calculates summary totals from the loaded records', () => {
    expect(component.totalTransferredAUD).toBe(300);
    expect(component.totalReceivedINR).toBe(16150);
  });

  it('opens the selected transfer prefilled in the edit form', () => {
    component.editTransfer(1);

    expect(component.editingTransferIndex).toBe(1);
    expect(component.editForm.getRawValue()).toEqual({
      ...transfers[1],
      dateOfTransfer: '2023-10-31',
      receivedDate: '2023-11-03'
    });
  });

  it('prefills date pickers from unpadded days and full month names', () => {
    component.transfers = [{
      ...transfers[0],
      dateOfTransfer: '7-Aug-24',
      receivedDate: '05-July-26'
    }];

    component.editTransfer(0);

    expect(component.editForm.controls.dateOfTransfer.value).toBe('2024-08-07');
    expect(component.editForm.controls.receivedDate.value).toBe('2026-07-05');
  });

  it('formats transfer and received dates consistently for display', () => {
    expect(component.formatDate('29-Sep-23')).toBe('29 Sep 2023');
    expect(component.formatDate('2026-07-05')).toBe('05 Jul 2026');
  });

  it('starts with records collapsed', () => {
    expect(component.areRecordsExpanded).toBeFalse();

    component.toggleRecords();

    expect(component.areRecordsExpanded).toBeTrue();
  });

  it('sorts transfer amounts and keeps original indexes for row actions', () => {
    component.sortTransfers('amountTransferredAUD');

    expect(component.sortedTransfers.map((row) => row.transfer.amountTransferredAUD)).toEqual([100, 200]);
    expect(component.sortedTransfers.map((row) => row.index)).toEqual([0, 1]);

    component.sortTransfers('amountTransferredAUD');

    expect(component.sortedTransfers.map((row) => row.transfer.amountTransferredAUD)).toEqual([200, 100]);
    expect(component.sortedTransfers.map((row) => row.index)).toEqual([1, 0]);
  });

  it('sorts dates chronologically despite backend date format variations', () => {
    component.transfers = [
      { ...transfers[1], dateOfTransfer: '7-Aug-24' },
      { ...transfers[0], dateOfTransfer: '05-July-26' },
      { ...transfers[0], dateOfTransfer: '29-Sep-23' }
    ];

    component.sortTransfers('dateOfTransfer');

    expect(component.sortedTransfers.map((row) => row.transfer.dateOfTransfer))
      .toEqual(['29-Sep-23', '7-Aug-24', '05-July-26']);
  });

  it('adds a transfer and refreshes table, chart, and totals after saving', () => {
    const newTransfer: TransferRecord = {
      dateOfTransfer: '10-Oct-26',
      amountTransferredAUD: 150,
      conversionRate: 67,
      receivedDate: '12-Oct-26',
      amountReceivedINR: 10050
    };
    const formTransfer = {
      ...newTransfer,
      dateOfTransfer: '2026-10-10',
      receivedDate: '2026-10-12'
    };
    const updatedTransfers = [...transfers, newTransfer];
    transferService.updateTransfers.and.returnValue(of(updatedTransfers));
    component.addTransfer();
    component.editForm.setValue(formTransfer);

    component.saveTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith(updatedTransfers);
    expect(component.transfers).toEqual(updatedTransfers);
    expect(component.chartData.length).toBe(3);
    expect(component.totalTransferredAUD).toBe(450);
    expect(component.areRecordsExpanded).toBeTrue();
    expect(component.editingTransferIndex).toBeNull();
    expect(component.isAddingTransfer).toBeFalse();
    expect(component.toastMessage).toBe('New transfer added successfully.');
  });

  it('updates the selected record and refreshes dashboard data after saving', () => {
    const updatedTransfer = {
      ...transfers[1],
      amountTransferredAUD: 250,
      amountReceivedINR: 13500
    };
    const updatedTransfers = [transfers[0], updatedTransfer];
    transferService.updateTransfers.and.returnValue(of(updatedTransfers));
    component.editTransfer(1);
    component.editForm.controls.amountTransferredAUD.setValue(250);

    component.saveTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith(updatedTransfers);
    expect(component.transfers).toEqual(updatedTransfers);
    expect(component.totalTransferredAUD).toBe(350);
    expect(component.editingTransferIndex).toBeNull();
    expect(component.toastMessage).toBe('Transfer updated successfully.');
    expect(changeDetector.detectChanges).toHaveBeenCalled();
  });

  it('saves a date-picker value in the backend date format', () => {
    const updatedTransfers = [transfers[0], { ...transfers[1], receivedDate: '14-Nov-23' }];
    transferService.updateTransfers.and.returnValue(of(updatedTransfers));
    component.editTransfer(1);
    component.editForm.controls.dateOfTransfer.setValue('2023-10-31');
    component.editForm.controls.receivedDate.setValue('2023-11-14');

    component.saveTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith(updatedTransfers);
    expect(component.transfers).toEqual(updatedTransfers);
  });

  it('calculates the received amount from the sent amount and exchange rate', () => {
    component.transfers = [];
    component.addTransfer();
    component.editForm.controls.amountTransferredAUD.setValue(100);
    component.editForm.controls.conversionRate.setValue(70);

    expect(component.editForm.controls.amountReceivedINR.value).toBe(7000);

    const newTransfer: TransferRecord = {
      dateOfTransfer: '02-Oct-26',
      amountTransferredAUD: 100,
      conversionRate: 70,
      receivedDate: '02-Oct-26',
      amountReceivedINR: 7000
    };
    transferService.updateTransfers.and.returnValue(of([newTransfer]));
    component.editForm.controls.dateOfTransfer.setValue('2026-10-02');
    component.editForm.controls.receivedDate.setValue('2026-10-02');
    component.saveTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith([{
      dateOfTransfer: '02-Oct-26',
      amountTransferredAUD: 100,
      conversionRate: 70,
      receivedDate: '02-Oct-26',
      amountReceivedINR: 7000
    }]);
  });

  it('keeps the editor open and reports a failed update', () => {
    transferService.updateTransfers.and.returnValue(
      throwError(() => new Error('Update failed'))
    );
    component.editTransfer(0);

    component.saveTransfer();

    expect(component.editingTransferIndex).toBe(0);
    expect(component.saveError).toBe('Update failed');
    expect(component.transfers).toEqual(transfers);
  });

  it('requires confirmation and saves the remaining transfers after deleting one', async () => {
    const remainingTransfers = [transfers[1]];
    transferService.updateTransfers.and.returnValue(of(remainingTransfers));

    component.requestDeleteTransfer(0);
    expect(transferService.updateTransfers).not.toHaveBeenCalled();

    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();
    expect(component.isDeleteCodeVerified).toBeTrue();
    await component.deleteTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith(remainingTransfers);
    expect(component.transfers).toEqual(remainingTransfers);
    expect(component.totalTransferredAUD).toBe(200);
    expect(component.pendingDeleteIndex).toBeNull();
    expect(component.deleteConfirmationCode.value).toBe('');
    expect(component.toastMessage).toBe('Transfer deleted successfully.');
    expect(changeDetector.detectChanges).toHaveBeenCalled();
  });

  it('does not delete unless the entered code verifies', async () => {
    confirmationCodeService.verify.and.resolveTo(false);
    component.requestDeleteTransfer(0);
    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();

    await component.deleteTransfer();

    expect(transferService.updateTransfers).not.toHaveBeenCalled();
    expect(component.pendingDeleteIndex).toBe(0);
    expect(component.isDeleteCodeVerified).toBeFalse();
    expect(component.isDeleteCodeIncorrect).toBeTrue();
  });

  it('keeps the delete confirmation open when the backend update fails', async () => {
    transferService.updateTransfers.and.returnValue(
      throwError(() => new Error('Delete failed'))
    );
    component.requestDeleteTransfer(0);
    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();

    await component.deleteTransfer();

    expect(component.pendingDeleteIndex).toBe(0);
    expect(component.saveError).toBe('Delete failed');
    expect(component.transfers).toEqual(transfers);
  });

  it('dismisses the save notification', () => {
    component.toastMessage = 'Transfer updated successfully.';

    component.dismissToast();

    expect(component.toastMessage).toBe('');
  });

  it('shows loading errors instead of replacing them with sample data', () => {
    const failedService = jasmine.createSpyObj<TransferService>('TransferService', ['getTransfers']);
    failedService.getTransfers.and.returnValue(throwError(() => new Error('API unavailable')));
    const failedComponent = new MyDashboardComponent(
      failedService,
      createChangeDetector(),
      confirmationCodeService
    );

    failedComponent.ngOnInit();

    expect(failedComponent.transfers).toEqual([]);
    expect(failedComponent.isLoading).toBeFalse();
    expect(failedComponent.errorMessage).toBe('API unavailable');
  });
});

function createChangeDetector(): jasmine.SpyObj<ChangeDetectorRef> {
  return jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
}
