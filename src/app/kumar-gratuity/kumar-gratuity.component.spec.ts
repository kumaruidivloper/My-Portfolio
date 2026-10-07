import { ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';
import { GratuityApiDocument } from '../model/gratuity-record';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { GratuityDataService } from '../service/gratuity-data.service';
import { KumarGratuityComponent } from './kumar-gratuity.component';

describe('KumarGratuityComponent', () => {
  let component: KumarGratuityComponent;
  let gratuityDataService: jasmine.SpyObj<GratuityDataService>;
  let confirmationCodeService: jasmine.SpyObj<ConfirmationCodeService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  const initialData: GratuityApiDocument = {
    id: '4',
    name: 'Kumar',
    title: 'Gratuity history',
    description: 'Gratuity history',
    type: 'Gratuity',
    gratuityRecords: [
      { date: "Sep'26", gratuity: 262985, difference: 0 },
      { date: "Aug'26", gratuity: 262985, difference: 0 },
      { date: "July'26", gratuity: 262985, difference: 0 },
      { date: "June'26", gratuity: 262985, difference: 0 }
    ]
  };

  beforeEach(() => {
    gratuityDataService = jasmine.createSpyObj<GratuityDataService>(
      'GratuityDataService',
      ['getGratuityData', 'updateGratuityData']
    );
    gratuityDataService.getGratuityData.and.returnValue(of(initialData));
    gratuityDataService.updateGratuityData.and.callFake((document) => of(document));
    confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );
    confirmationCodeService.verify.and.resolveTo(true);
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new KumarGratuityComponent(
      gratuityDataService,
      confirmationCodeService,
      changeDetector
    );
  });

  async function verifyCode(): Promise<void> {
    component.confirmationCode.setValue('12345678901234');
    component.validateConfirmationCode();
    await Promise.resolve();
  }

  it('loads and presents the response records newest-first in the chart', () => {
    component.toggleExpanded();

    expect(gratuityDataService.getGratuityData).toHaveBeenCalled();
    expect(component.records).toEqual(initialData.gratuityRecords);
    expect(component.chartData.map((datum) => datum.name)).toEqual([
      'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026'
    ]);
    expect(component.latestGratuity).toBe(262985);
  });

  it('changes chart type and provides the chart data in line-series format', () => {
    component.toggleExpanded();
    component.selectChartType('line');

    expect(component.selectedChartType).toBe('line');
    expect(component.lineChartData).toEqual([{
      name: 'Gratuity',
      series: component.chartData
    }]);
  });

  it('toggles monthly gratuity records independently', () => {
    expect(component.areRecordsExpanded).toBeFalse();

    component.toggleRecords();
    expect(component.areRecordsExpanded).toBeTrue();

    component.toggleRecords();
    expect(component.areRecordsExpanded).toBeFalse();
    expect(component.isExpanded).toBeFalse();
  });

  it('requires a valid confirmation code before editing a record', async () => {
    component.toggleExpanded();
    component.editRecord(0);
    component.editForm.controls.gratuity.setValue(270000);

    component.saveChanges();
    expect(gratuityDataService.updateGratuityData).not.toHaveBeenCalled();

    await verifyCode();
    component.saveChanges();

    expect(gratuityDataService.updateGratuityData).toHaveBeenCalledWith({
      ...initialData,
      gratuityRecords: [
        { date: "Sep'26", gratuity: 270000, difference: 0 },
        ...initialData.gratuityRecords.slice(1)
      ]
    }, '4');
    expect(component.editingRecordIndex).toBeNull();
    expect(component.toastMessage).toBe('Gratuity record updated successfully.');
  });

  it('adds a gratuity record with the calculated difference from the previous month', () => {
    component.toggleExpanded();
    component.addRecord();
    component.editForm.setValue({
      date: '2026-10',
      gratuity: 270000,
      previousMonthValue: 262985,
      difference: 0
    });
    component.calculateDifference();

    expect(component.editForm.controls.difference.value).toBe(7015);

    component.addNewRecord();

    expect(gratuityDataService.updateGratuityData).toHaveBeenCalledWith({
      ...initialData,
      gratuityRecords: [
        { date: "Oct'26", gratuity: 270000, difference: 7015 },
        ...initialData.gratuityRecords
      ]
    }, '4');
    expect(confirmationCodeService.verify).not.toHaveBeenCalled();
    expect(component.isAddingRecord).toBeFalse();
    expect(component.areRecordsExpanded).toBeTrue();
    expect(component.toastMessage).toBe('Gratuity record added successfully.');
  });

  it('auto-fills the previous month value from the immediately previous record', () => {
    component.toggleExpanded();
    component.addRecord();

    component.editForm.controls.gratuity.setValue(270000);
    component.editForm.controls.date.setValue('2026-10');

    expect(component.previousMonthFound).toBeTrue();
    expect(component.editForm.controls.previousMonthValue.value).toBe(262985);
    expect(component.editForm.controls.difference.value).toBe(7015);

    component.editForm.controls.date.setValue('2027-05');
    expect(component.previousMonthFound).toBeFalse();
  });

  it('requires a verified confirmation code before deleting a record', async () => {
    component.toggleExpanded();
    component.requestDeleteRecord(0);
    component.deleteRecord();
    expect(gratuityDataService.updateGratuityData).not.toHaveBeenCalled();

    await verifyCode();
    component.deleteRecord();

    expect(gratuityDataService.updateGratuityData).toHaveBeenCalledWith({
      ...initialData,
      gratuityRecords: initialData.gratuityRecords.slice(1)
    }, '4');
    expect(component.pendingDeleteRecordIndex).toBeNull();
    expect(component.toastMessage).toBe('Gratuity record deleted successfully.');
  });

  it('loads and writes Vasuki records through resource 5 with the same add flow', () => {
    component.resourceId = '5';
    component.ownerName = 'Vasuki';
    const vasukiData = { ...initialData, id: '5', name: 'Vasu' };
    gratuityDataService.getGratuityData.and.returnValue(of(vasukiData));
    gratuityDataService.updateGratuityData.and.callFake((document) => of(document));

    component.toggleExpanded();
    component.addRecord();
    component.editForm.setValue({
      date: '2026-10',
      gratuity: 1200000,
      previousMonthValue: 1139054,
      difference: 0
    });
    component.addNewRecord();

    expect(gratuityDataService.getGratuityData).toHaveBeenCalledWith('5');
    expect(gratuityDataService.updateGratuityData).toHaveBeenCalledWith({
      ...vasukiData,
      gratuityRecords: [
        { date: "Oct'26", gratuity: 1200000, difference: 60946 },
        ...vasukiData.gratuityRecords
      ]
    }, '5');
  });

  it('allows editing July API dates and blocks duplicate months', async () => {
    component.toggleExpanded();
    component.editRecord(2);

    expect(component.editForm.controls.date.value).toBe('2026-07');
    component.editForm.controls.date.setValue('2026-09');
    component.confirmationCode.setValue('12345678901234');
    component.validateConfirmationCode();
    await Promise.resolve();

    component.saveChanges();

    expect(gratuityDataService.updateGratuityData).not.toHaveBeenCalled();
    expect(component.editForm.controls.date.hasError('duplicateMonth')).toBeTrue();
  });
});
