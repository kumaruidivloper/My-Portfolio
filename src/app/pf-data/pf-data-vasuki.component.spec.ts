import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { of } from 'rxjs';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { PfDataService } from '../service/pf-data.service';
import { PfDataComponent } from './pf-data.component';
import { PfApiDocument } from '../model/pf-record';

describe('PfDataComponent (Vasuki)', () => {
  it('renders the Vasuki accordion while collapsed before loading data', async () => {
    const pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'updatePfData']);
    pfDataService.getPfData.and.returnValue(of({
      id: '3',
      name: 'Vasuki',
      description: 'Provident fund history',
      pfRecords: []
    }));
    const confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );

    await TestBed.configureTestingModule({
      imports: [CommonModule, NgxChartsModule, ReactiveFormsModule],
      declarations: [PfDataComponent],
      providers: [
        { provide: PfDataService, useValue: pfDataService },
        { provide: ConfirmationCodeService, useValue: confirmationCodeService }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PfDataComponent);
    fixture.componentInstance.resourceId = '3';
    fixture.componentInstance.ownerName = 'Vasuki';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#pf-data-title-3')?.textContent).toContain('Vasuki - PF DATA');
    expect(fixture.nativeElement.querySelector('#pf-data-panel-3')).toBeNull();
    expect(pfDataService.getPfData).not.toHaveBeenCalled();
  });

  it('loads Vasuki PF data from its configured resource', () => {
    const pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'updatePfData']);
    pfDataService.getPfData.and.returnValue(of({
      id: '3',
      name: 'Vasuki',
      description: 'Provident fund history',
      pfRecords: [{ date: "Sep'26", pfAmount: 2589327, difference: 27641 }]
    }));
    const changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    const confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );
    const component = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);
    component.resourceId = '3';
    component.ownerName = 'Vasuki';

    component.toggleExpanded();

    expect(pfDataService.getPfData).toHaveBeenCalledWith('3');
    expect(component.ownerName).toBe('Vasuki');
    expect(component.records[0].pfAmount).toBe(2589327);
  });

  it('toggles the monthly records sub-accordion independently', () => {
    const pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'updatePfData']);
    const changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    const confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );
    const component = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);
    component.resourceId = '3';
    component.ownerName = 'Vasuki';

    expect(component.areRecordsExpanded).toBeFalse();

    component.toggleRecords();

    expect(component.areRecordsExpanded).toBeTrue();

    component.toggleRecords();

    expect(component.areRecordsExpanded).toBeFalse();
  });

  it('requires a verified confirmation code before updating an existing PF record', async () => {
    const initialData: PfApiDocument = {
      id: '3',
      name: 'Vasuki',
      description: 'Provident fund history',
      pfRecords: [{ date: "Sep'26", pfAmount: 2589327, difference: 27641 }]
    };
    const pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData', 'updatePfData']);
    pfDataService.getPfData.and.returnValue(of(initialData));
    pfDataService.updatePfData.and.callFake((document) => of(document));
    const changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    const confirmationCodeService = jasmine.createSpyObj<ConfirmationCodeService>(
      'ConfirmationCodeService',
      ['verify']
    );
    confirmationCodeService.verify.and.resolveTo(true);
    const component = new PfDataComponent(pfDataService, changeDetector, confirmationCodeService);
    component.resourceId = '3';
    component.ownerName = 'Vasuki';
    component.toggleExpanded();
    component.editRecord(0);
    component.editForm.controls.pfAmount.setValue(2600000);

    component.saveRecord();
    expect(pfDataService.updatePfData).not.toHaveBeenCalled();

    component.deleteConfirmationCode.setValue('12345678');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();
    component.saveRecord();

    expect(pfDataService.updatePfData).toHaveBeenCalledWith({
      ...initialData,
      pfRecords: [{ date: "Sep'26", pfAmount: 2600000, difference: 27641 }]
    }, '3');
  });
});
