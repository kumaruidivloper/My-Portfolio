import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PfDataService } from '../service/pf-data.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { PfDataComponent } from './pf-data.component';

describe('PfDataComponent', () => {
  let component: PfDataComponent;
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let confirmationCodeService: jasmine.SpyObj<ConfirmationCodeService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  const initialData = {
    id: '2',
    name: 'Kumar',
    description: 'Provident fund history',
    pfRecords: [
      { date: "Sep'26", pfAmount: 2066449, difference: 23709 },
      { date: "Aug'26", pfAmount: 2042740, difference: 23641 }
    ]
  };

  beforeEach(() => {
    pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'updatePfData']);
    pfDataService.getPfData.and.returnValue(of(initialData));
    pfDataService.updatePfData.and.callFake((document) => of(document));
    confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );
    confirmationCodeService.verify.and.resolveTo(true);
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);
    component.toggleExpanded();
  });

  async function verifyEditCode(): Promise<void> {
    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();
  }

  it('loads PF records only when the accordion is expanded', () => {
    pfDataService.getPfData.calls.reset();
    const collapsedComponent = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);

    expect(pfDataService.getPfData).not.toHaveBeenCalled();

    collapsedComponent.toggleExpanded();

    expect(pfDataService.getPfData).toHaveBeenCalled();
  });

  it('toggles the monthly records sub-accordion independently', () => {
    expect(component.areRecordsExpanded).toBeFalse();

    component.toggleRecords();

    expect(component.areRecordsExpanded).toBeTrue();

    component.toggleRecords();

    expect(component.areRecordsExpanded).toBeFalse();
  });

  it('loads PF data and opens the add form without expanding when add is clicked while collapsed', () => {
    const collapsedComponent = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);

    collapsedComponent.addRecord();

    expect(pfDataService.getPfData).toHaveBeenCalled();
    expect(collapsedComponent.isExpanded).toBeFalse();
    expect(collapsedComponent.isAddingRecord).toBeTrue();
    expect(collapsedComponent.editForm.controls.date.value).toBe('');
  });

  it('routes a PF component instance to the configured resource', () => {
    const vasukiComponent = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);
    vasukiComponent.resourceId = '3';
    vasukiComponent.ownerName = 'Vasuki';

    vasukiComponent.toggleExpanded();

    expect(pfDataService.getPfData).toHaveBeenCalledWith('3');
    expect(vasukiComponent.ownerName).toBe('Vasuki');
  });

  it('creates chronological chart data from the newest-first response', () => {
    expect(component.chartData.map((datum) => datum.name)).toEqual(['Aug 2026', 'Sep 2026']);
    expect(component.chartData.map((datum) => datum.value)).toEqual([2042740, 2066449]);
  });

  it('charts monthly difference after selecting the metric', () => {
    component.selectMetric('difference');

    expect(component.chartData.map((datum) => datum.value)).toEqual([23641, 23709]);
    expect(component.axisLabel).toBe('Monthly difference (INR)');
  });

  it('changes chart type and creates a line series for the selected metric', () => {
    component.selectMetric('difference');
    component.selectChartType('line');

    expect(component.selectedChartType).toBe('line');
    expect(component.lineChartData).toEqual([{
      name: 'Monthly difference',
      series: component.chartData
    }]);
  });

  it('formats PF amounts as Indian rupees', () => {
    expect(component.formatRupees(2066449)).toBe('₹20,66,449');
    expect(component.formatRupeesWithSpace(2066449)).toBe('₹ 20,66,449');
  });

  it('adds a PF record and updates the existing resource', () => {
    component.addRecord();
    component.editForm.setValue({ date: '2026-10', pfAmount: 2080000, difference: 24000 });

    component.saveRecord();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...initialData,
      pfRecords: [
        { date: "Oct'26", pfAmount: 2080000, difference: 13551 },
        ...initialData.pfRecords
      ]
    }, '2');
    expect(component.records[0].date).toBe("Oct'26");
    expect(component.toastMessage).toBe('PF record added successfully.');
    expect(component.isAddingRecord).toBeFalse();
    expect(component.areRecordsExpanded).toBeTrue();
  });

  it('edits an existing PF record after confirmation and rejects duplicate months', async () => {
    component.editRecord(0);
    expect(component.editForm.getRawValue()).toEqual({
      date: '2026-09',
      pfAmount: 2066449,
      difference: 23709
    });
    component.editForm.controls.pfAmount.setValue(2070000);
    await verifyEditCode();
    component.saveRecord();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...initialData,
      pfRecords: [
        { date: "Sep'26", pfAmount: 2070000, difference: 27260 },
        initialData.pfRecords[1]
      ]
    }, '2');
    expect(component.toastMessage).toBe('PF record updated successfully.');

    component.addRecord();
    component.editForm.setValue({ date: '2026-09', pfAmount: 1, difference: 1 });
    component.saveRecord();

    expect(component.editForm.controls.date.hasError('duplicateMonth')).toBeTrue();
    expect(pfDataService.updatePfData).toHaveBeenCalledTimes(1);
  });

  it('does not update an edited PF record until its confirmation code is verified', () => {
    component.editRecord(0);

    component.saveRecord();

    expect(pfDataService.updatePfData).not.toHaveBeenCalled();
    expect(component.canSaveChanges).toBeFalse();
  });

  it('keeps the editor open and reports a failed save', () => {
    pfDataService.updatePfData.and.returnValue(throwError(() => new Error('Save failed')));
    component.addRecord();
    component.editForm.setValue({ date: '2026-10', pfAmount: 2080000, difference: 24000 });

    component.saveRecord();

    expect(component.isAddingRecord).toBeTrue();
    expect(component.saveError).toBe('Save failed');
    expect(component.records).toEqual(initialData.pfRecords);
  });

  it('requires a valid code before deleting a PF record', async () => {
    component.requestDeleteRecord(0);
    expect(component.canDeleteRecord).toBeFalse();

    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    expect(component.canDeleteRecord).toBeFalse();
    await Promise.resolve();
    expect(component.canDeleteRecord).toBeTrue();

    component.deleteRecord();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...initialData,
      pfRecords: [initialData.pfRecords[1]]
    }, '2');
    expect(component.records).toEqual([initialData.pfRecords[1]]);
    expect(component.pendingDeleteRecordIndex).toBeNull();
    expect(component.canDeleteRecord).toBeFalse();
    expect(component.toastMessage).toBe('PF record deleted successfully.');
  });

  it('dismisses the save and delete toast', () => {
    component.toastMessage = 'PF record saved successfully.';

    component.dismissToast();

    expect(component.toastMessage).toBe('');
  });

  it('does not delete a PF record when the confirmation code is invalid', async () => {
    confirmationCodeService.verify.and.resolveTo(false);
    component.requestDeleteRecord(0);
    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();

    component.deleteRecord();

    expect(pfDataService.updatePfData).not.toHaveBeenCalled();
    expect(component.pendingDeleteRecordIndex).toBe(0);
    expect(component.isDeleteCodeIncorrect).toBeTrue();
  });

  it('shows API errors instead of sample data', () => {
    pfDataService.getPfData.and.returnValue(throwError(() => new Error('API unavailable')));
    const failed = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);

    failed.toggleExpanded();

    expect(failed.records).toEqual([]);
    expect(failed.isLoading).toBeFalse();
    expect(failed.errorMessage).toBe('API unavailable');
  });
});
