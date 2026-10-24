import { ChangeDetectorRef } from '@angular/core';
import { MyDashboardComponent } from './my-dashboard.component';
import { TransferRecord } from '../model/transfer';
import { TransferService } from '../service/transfer.service';
import { ConfirmationCodeService } from '../service/confirmation-code.service';
import { PfDataService } from '../service/pf-data.service';
import { GratuityDataService } from '../service/gratuity-data.service';
import { TotalBalanceService } from '../service/total-balance.service';
import { of, throwError } from 'rxjs';
import { ColorHelper, ScaleType } from '@swimlane/ngx-charts';

describe('MyDashboardComponent', () => {
  let component: MyDashboardComponent;
  let transferService: jasmine.SpyObj<TransferService>;
  let confirmationCodeService: jasmine.SpyObj<ConfirmationCodeService>;
  let pfDataService: jasmine.SpyObj<PfDataService>;
  let gratuityDataService: jasmine.SpyObj<GratuityDataService>;
  let totalBalanceService: jasmine.SpyObj<TotalBalanceService>;
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
    pfDataService = jasmine.createSpyObj<PfDataService>('PfDataService', ['getPfData']);
    pfDataService.getPfData.and.callFake((resourceId) => of({
      id: resourceId ?? '2',
      name: resourceId === '3' ? 'Vasuki' : 'Kumar',
      description: 'PF history',
      pfRecords: [{ date: "Sep'26", pfAmount: resourceId === '3' ? 300 : 100, difference: 10 }]
    }));
    gratuityDataService = jasmine.createSpyObj<GratuityDataService>('GratuityDataService', ['getGratuityData']);
    gratuityDataService.getGratuityData.and.callFake((resourceId) => of({
      id: resourceId ?? '4',
      name: 'Owner',
      title: 'Records',
      description: 'History',
      type: resourceId === '6' ? 'Super' : 'Gratuity',
      gratuityRecords: [{ date: "Sep'26", gratuity: 200, difference: 20 }]
    }));
    totalBalanceService = jasmine.createSpyObj<TotalBalanceService>(
      'TotalBalanceService',
      ['getTotals', 'syncTotals'],
      { totalsUpdated$: of() }
    );
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7',
      name: 'All',
      type: 'Total',
      totalRecords: [{ date: "Sep'26", total: 1000, difference: 30 }]
    }));
    changeDetector = createChangeDetector();
    component = new MyDashboardComponent(
      transferService,
      changeDetector,
      confirmationCodeService,
      pfDataService,
      gratuityDataService,
      totalBalanceService
    );
    component.ngOnInit();
  });

  async function verifyEditCode(): Promise<void> {
    component.deleteConfirmationCode.setValue('12345678901234');
    component.validateDeleteConfirmationCode();
    await Promise.resolve();
  }

  it('scrolls to the dashboard top when a card opens and back to the card when it closes', async () => {
    const page = document.createElement('main');
    page.style.cssText = 'height: 100px; overflow-y: auto;';
    page.innerHTML = `
      <div class="dashboard-widget-grid">
        <section style="height: 400px;">
          <button class="accordion-toggle main" aria-expanded="false"></button>
          <app-widget-preview-chart><span class="inside"></span></app-widget-preview-chart>
          <button class="accordion-toggle inner" aria-expanded="false"></button>
        </section>
      </div>`;
    document.body.appendChild(page);
    const grid = page.querySelector('.dashboard-widget-grid') as HTMLElement;
    const widget = grid.querySelector('section') as HTMLElement;
    const mainToggle = grid.querySelector('.main') as HTMLElement;
    const toTopSpy = spyOn(page, 'scrollTo') as jasmine.Spy;
    const toCardSpy = spyOn(widget, 'scrollIntoView');
    const resetSpies = () => {
      toTopSpy.calls.reset();
      toCardSpy.calls.reset();
    };
    const clickAndToggle = async (selector: string) => {
      component.onWidgetGridClick({ target: grid.querySelector(selector) } as unknown as Event);
      expect(toTopSpy).not.toHaveBeenCalled();
      expect(toCardSpy).not.toHaveBeenCalled();
      mainToggle.setAttribute('aria-expanded', String(mainToggle.getAttribute('aria-expanded') !== 'true'));
      await new Promise((resolve) => setTimeout(resolve));
    };
    const stopPinning = async () => {
      window.dispatchEvent(new WheelEvent('wheel'));
      resetSpies();
      widget.style.height = '500px';
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(toTopSpy).withContext('stops pinning once the user scrolls').not.toHaveBeenCalled();
      expect(toCardSpy).withContext('stops pinning once the user scrolls').not.toHaveBeenCalled();
      widget.style.height = '400px';
    };

    await clickAndToggle('.main');
    expect(widget.classList).withContext('highlights the opened card').toContain('widget-highlight');
    expect(toTopSpy).toHaveBeenCalledWith({ top: 0 });
    expect(toCardSpy).not.toHaveBeenCalled();
    resetSpies();
    widget.style.height = '450px';
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toTopSpy).withContext('re-aligns while the layout settles').toHaveBeenCalled();
    await stopPinning();

    widget.classList.remove('widget-highlight');
    await clickAndToggle('.inside');
    expect(widget.classList).withContext('highlights the closed card').toContain('widget-highlight');
    expect(toCardSpy).toHaveBeenCalledWith(jasmine.objectContaining({ block: 'start' }));
    expect(toTopSpy).not.toHaveBeenCalled();
    await stopPinning();

    component.onWidgetGridClick({ target: grid.querySelector('.inner') } as unknown as Event);
    mainToggle.setAttribute('aria-expanded', 'true');
    await new Promise((resolve) => setTimeout(resolve));
    expect(toTopSpy).not.toHaveBeenCalled();
    expect(toCardSpy).not.toHaveBeenCalled();
    component.ngOnDestroy();
    page.remove();
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

  it('offers metrics from every dashboard section and loads selected chart data', () => {
    expect(component.allDashboardMetricOptions.length).toBe(14);
    expect(component.allDashboardMetricOptions.map(({ value }) => value)).toContain('vasukiSuper');
    expect(component.allDashboardMetricOptions.map(({ value }) => value)).toContain('overallBalance');
    expect(component.allDashboardMetricOptions.map(({ label }) => label)).toContain('Kumar gratuity');
    expect(component.allDashboardMetricOptions.map(({ label }) => label)).toContain('Vasuki gratuity');
    expect(component.allDashboardMetricOptions.map(({ label }) => label)).toContain('Vasuki super');

    component.openAllDetailsModal();
    expect(component.isAllDetailsModalOpen).toBeTrue();
    expect(component.allDashboardChartsError).toBe('');
    expect(component.allDashboardSummaryCards.map(({ label }) => label)).toEqual([
      'Transfers',
      'Total sent',
      'Total received'
    ]);
    expect(component.allDashboardSummaryCards[0].value).toBe('2');
    expect(component.allDashboardSummaryCards[1].value).toBe('$300.00');
    expect(component.allDashboardSummaryCards[2].value).toBe('₹ 16,150');

    component.selectAllDashboardMetric('kumarPfAmount');
    expect(component.allDashboardChartData).toEqual([{ name: 'Sep 2026', value: 100 }]);
    expect(component.allDashboardSummaryCards.map(({ label }) => label)).toEqual([
      'Current PF balance',
      'Latest monthly difference',
      'Recorded periods'
    ]);
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 100.00');
    component.selectAllDashboardMetric('combinedPfAmount');
    expect(component.allDashboardChartData).toEqual([{ name: 'Sep 2026', value: 400 }]);
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 400.00');
    component.selectAllDashboardMetric('vasukiSuper');
    expect(component.allDashboardChartData).toEqual([{ name: 'Sep 2026', value: 200 }]);
    expect(component.allDashboardSummaryCards.map(({ label }) => label)).toEqual([
      'Current super balance',
      'Previous period',
      'Recorded periods'
    ]);
    component.selectAllDashboardMetric('overallBalance');
    expect(component.allDashboardChartData).toEqual([{ name: 'Sep 2026', value: 1000 }]);
    expect(component.allDashboardSummaryCards.map(({ label }) => label)).toEqual([
      'Current total balance',
      'Total interest',
      'Recorded periods',
      'Current monthly interest'
    ]);

    component.selectAllDashboardMetric('amountReceivedINR');
    expect(component.chartData.map(({ value }) => value)).toEqual([5350, 10800]);
    expect(component.allDashboardSummaryCards[0].value).toBe('2');
    expect(component.allDashboardSummaryCards[2].value).toBe('₹ 16,150');
    component.selectChartType('line');
    expect(component.selectedChartType).toBe('line');

    component.closeAllDetails();
    expect(component.isAllDetailsModalOpen).toBeFalse();
  });

  it('uses the newest overall month for highlights rather than the oldest record', () => {
    const totalRecords = [
      { date: "Sep'26", total: 1500, difference: 50 },
      { date: "Aug'26", total: 1450, difference: 40 },
      { date: "Jul'26", total: 1410, difference: 30 }
    ];
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7',
      name: 'All',
      type: 'Total',
      totalRecords
    }));

    component.openAllDetailsModal();
    component.selectAllDashboardMetric('overallBalance');

    expect(component.allDashboardChartData).toEqual([
      { name: 'Jul 2026', value: 1410 },
      { name: 'Aug 2026', value: 1450 },
      { name: 'Sep 2026', value: 1500 }
    ]);
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 1,500.00');
    expect(component.allDashboardSummaryCards[1].value).toBe('₹ 120.00');

    component.selectAllDashboardMetric('overallInterest');
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 120.00');
    expect(component.allDashboardSummaryCards[1].value).toBe('₹ 1,500.00');
    expect(totalRecords.map(({ date }) => date)).toEqual(["Sep'26", "Aug'26", "Jul'26"]);
  });

  it('uses the selected transfer metric for its normal chart', () => {
    component.selectMetric('amountReceivedINR');
    expect(component.chartData.map(({ value }) => value)).toEqual([5350, 10800]);
  });

  it('bounds transfer filters by actual dates and filters totals and selection indexes inclusively', () => {
    component.transfers = [
      { ...transfers[1] },
      { ...transfers[0] },
      { ...transfers[0], dateOfTransfer: '01-Nov-23', amountTransferredAUD: 400 }
    ];
    const original = [...component.transfers];
    component.openAllDetailsModal();
    expect(component.allDashboardDateMode).toBe('date');
    expect(component.allDashboardDateBounds).toEqual({ min: '2023-09-29', max: '2023-11-01' });
    component.setAllDashboardDateRange('from', '2023-10-31');
    component.setAllDashboardDateRange('to', '2023-10-31');
    expect(component.allDashboardChartData).toEqual([{ name: '31 Oct 2023', value: 200 }]);
    expect(component.allDashboardSummaryCards.map(({ value }) => value)).toEqual(['1', '$200.00', '₹ 10,800']);
    component.selectAllDashboardChartItem({ name: '31 Oct 2023', value: 200 });
    expect(component.allDashboardSummaryCards[0].value).toBe('1 of 1');
    expect(component.allDashboardSummaryCards[1].value).toBe('$200.00');
    expect(component.chartData.length).toBe(3);
    expect(component.transfers).toEqual(original);
    component.resetAllDashboardDateRange();
    expect(component.selectedAllDashboardDatum).toBeNull();
    expect(component.allDashboardChartData.length).toBe(3);
  });

  it('provides data-bound ranges for every dashboard metric', () => {
    component.openAllDetailsModal();
    for (const { value } of component.allDashboardMetricOptions) {
      component.selectAllDashboardMetric(value);
      const bounds = component.allDashboardDateBounds;
      expect(bounds.min).not.toBe('');
      expect(bounds.max).not.toBe('');
      expect(component.allDashboardFromValue).toBe(bounds.min);
      expect(component.allDashboardToValue).toBe(bounds.max);
      component.setAllDashboardDateRange('from', bounds.min);
      component.setAllDashboardDateRange('to', bounds.max);
      expect(component.allDashboardRangeError).toBe('');
      expect(component.allDashboardChartData.length).toBeGreaterThan(0);
    }
  });

  it('slides by calendar days, clamps crossing handles, and restores the full range', () => {
    component.openAllDetailsModal();
    expect(component.allDashboardSliderMax).toBe(32);
    expect(component.allDashboardSliderFrom).toBe(0);
    expect(component.allDashboardSliderTo).toBe(32);
    component.setAllDashboardSliderRange('from', 1);
    expect(component.allDashboardFromValue).toBe('2023-09-30');
    expect(component.allDashboardFromLabel).toBe('30 Sep 2023');
    expect(component.allDashboardChartData.length).toBe(1);
    component.setAllDashboardSliderRange('to', 0);
    expect(component.allDashboardToValue).toBe('2023-09-30');
    expect(component.allDashboardChartData.length).toBe(0);
    component.setAllDashboardSliderRange('from', 32);
    expect(component.allDashboardSliderFrom).toBe(1);
    component.resetAllDashboardDateRange();
    expect(component.allDashboardSliderFrom).toBe(0);
    expect(component.allDashboardSliderTo).toBe(32);
    expect(component.allDashboardChartData.length).toBe(2);
  });

  it('uses daily slider steps across leap day without timezone shifts', () => {
    component.transfers = [
      { ...transfers[0], dateOfTransfer: '28-Feb-24' },
      { ...transfers[1], dateOfTransfer: '01-Mar-24' }
    ];
    component.openAllDetailsModal();
    expect(component.allDashboardSliderMax).toBe(2);
    component.setAllDashboardSliderRange('from', 1);
    expect(component.allDashboardFromValue).toBe('2024-02-29');
    component.setAllDashboardSliderRange('to', 1);
    expect(component.allDashboardToValue).toBe('2024-02-29');
  });

  it('adjusts dates from label keyboard controls and prevents handles crossing', () => {
    component.openAllDetailsModal();
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    component.onDateLabelKeydown('from', right);
    expect(right.defaultPrevented).toBeTrue();
    expect(component.allDashboardSliderFrom).toBe(1);
    component.onDateLabelKeydown('to', new KeyboardEvent('keydown', { key: 'Home' }));
    expect(component.allDashboardSliderTo).toBe(1);
    component.onDateLabelKeydown('from', new KeyboardEvent('keydown', { key: 'End' }));
    expect(component.allDashboardSliderFrom).toBe(1);
    component.onDateLabelKeydown('to', new KeyboardEvent('keydown', { key: 'End' }));
    expect(component.allDashboardSliderTo).toBe(32);
    const unrelated = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    component.onDateLabelKeydown('from', unrelated);
    expect(unrelated.defaultPrevented).toBeFalse();
  });

  it('moves the nearest handle on track clicks or touch and supports continued dragging', () => {
    component.openAllDetailsModal();
    const track = document.createElement('div');
    spyOn(track, 'getBoundingClientRect').and.returnValue(new DOMRect(100, 0, 320, 40));
    spyOn(track, 'setPointerCapture');
    track.addEventListener('pointerdown', event => component.startDateTrackDrag(event));
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 180, pointerId: 1, button: 0 }));
    expect(component.allDashboardSliderFrom).toBe(8);
    expect(component.allDashboardSliderTo).toBe(32);
    component.moveDateLabelDrag(new PointerEvent('pointermove', { clientX: 200, pointerId: 2 }));
    expect(component.allDashboardSliderFrom).toBe(8);
    component.moveDateLabelDrag(new PointerEvent('pointermove', { clientX: 200, pointerId: 1 }));
    expect(component.allDashboardSliderFrom).toBe(10);
    component.endDateLabelDrag(new PointerEvent('pointerup', { pointerId: 1 }));
    component.moveDateLabelDrag(new PointerEvent('pointermove', { clientX: 220, pointerId: 1 }));
    expect(component.allDashboardSliderFrom).toBe(10);
    track.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: 380, pointerId: 3, button: 0, pointerType: 'touch'
    }));
    expect(component.allDashboardSliderTo).toBe(28);
    component.moveDateLabelDrag(new PointerEvent('pointermove', { clientX: -100, pointerId: 3 }));
    expect(component.allDashboardSliderTo).toBe(10);
    component.endDateLabelDrag(new PointerEvent('pointercancel', { pointerId: 3 }));
    component.resetAllDashboardDateRange();
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 260, pointerId: 4, button: 0 }));
    expect(component.allDashboardSliderFrom).toBe(16);
    expect(component.allDashboardSliderTo).toBe(32);
    component.resetAllDashboardDateRange();
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 260, pointerId: 5, button: 2 }));
    expect(component.allDashboardSliderFrom).toBe(0);
    component.transfers = [];
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 260, pointerId: 6, button: 0 }));
    expect(component.allDashboardRangeError).toBe('');
  });

  it('uses month slider steps across years and clears selections', () => {
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: 'All', type: 'Total',
      totalRecords: [
        { date: "Feb'26", total: 30, difference: 10 },
        { date: "Jan'26", total: 20, difference: 10 },
        { date: "Dec'25", total: 10, difference: 10 }
      ]
    }));
    component.openAllDetailsModal();
    component.selectAllDashboardMetric('overallBalance');
    expect(component.allDashboardSliderMax).toBe(2);
    component.selectAllDashboardChartItem({ name: 'Dec 2025', value: 10 });
    component.setAllDashboardSliderRange('from', 1);
    expect(component.allDashboardFromValue).toBe('2026-01');
    expect(component.allDashboardFromLabel).toBe('Jan 2026');
    expect(component.selectedAllDashboardDatum).toBeNull();
    component.setAllDashboardSliderRange('to', 1);
    expect(component.allDashboardChartData).toEqual([{ name: 'Jan 2026', value: 20 }]);
    component.selectAllDashboardMetric('amountTransferredAUD');
    expect(component.allDashboardSliderFrom).toBe(0);
    expect(component.allDashboardSliderTo).toBe(32);
  });

  it('rejects invalid slider positions and supports single-date and missing histories', () => {
    component.openAllDetailsModal();
    for (const position of [-1, 33, 1.5, NaN]) {
      component.setAllDashboardSliderRange('from', position);
      expect(component.allDashboardRangeError).not.toBe('');
      expect(component.allDashboardFrom).toBe('');
    }
    component.transfers = [transfers[0]];
    component.resetAllDashboardDateRange();
    expect(component.allDashboardSliderMax).toBe(0);
    expect(component.allDashboardFromLabel).toBe(component.allDashboardToLabel);
    component.transfers = [];
    expect(component.allDashboardSliderMax).toBe(0);
    expect(component.allDashboardFromLabel).toBe('No data');
    component.setAllDashboardSliderRange('from', 0);
    expect(component.allDashboardRangeError).not.toBe('');
  });

  it('filters exchange rate extrema and previous transfers using only the chosen range', () => {
    component.transfers = [
      { ...transfers[0], conversionRate: 1 },
      { ...transfers[1], conversionRate: 55 }
    ];
    component.selectAllDashboardMetric('conversionRate');
    component.setAllDashboardDateRange('from', '2023-10-31');
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 55.00 / AUD');
    expect(component.allDashboardSummaryCards[2].value).toBe('1');
    component.selectAllDashboardChartItem({ name: '31 Oct 2023', value: 55 });
    expect(component.allDashboardSummaryCards[1].value).toBe('—');
    expect(component.allDashboardSummaryCards[2].value).toBe('1 of 1');
  });

  it('filters both overall metrics, interest sums, and comparisons by month and resets on metric changes', () => {
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: 'All', type: 'Total',
      totalRecords: [
        { date: "Sep'26", total: 1500, difference: 50 },
        { date: "Aug'26", total: 1450, difference: 40 },
        { date: "Jul'26", total: 1410, difference: 30 }
      ]
    }));
    component.openAllDetailsModal();
    for (const metric of ['overallBalance', 'overallInterest']) {
      component.selectAllDashboardMetric(metric);
      expect(component.allDashboardDateMode).toBe('month');
      expect(component.allDashboardDateBounds).toEqual({ min: '2026-07', max: '2026-09' });
      component.setAllDashboardDateRange('from', '2026-08');
      component.setAllDashboardDateRange('to', '2026-08');
      const cards = component.allDashboardSummaryCards;
      expect(cards[metric === 'overallBalance' ? 1 : 0].value).toBe('₹ 40.00');
      expect(cards[2].value).toBe('1');
      expect(cards[3].detail).toContain('No previous recorded month');
      expect(component.allDashboardChartData[0].name).toBe('Aug 2026');
    }
    component.selectAllDashboardMetric('amountTransferredAUD');
    expect(component.allDashboardFromValue).toBe('2023-09-29');
    expect(component.allDashboardToValue).toBe('2023-10-31');
    expect(component.allDashboardRangeError).toBe('');
  });

  it('clears chart selections after changing the range and compares super periods within it', () => {
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '6', name: 'Vasuki', title: 'Super', description: 'History', type: 'Super',
      gratuityRecords: [
        { date: "Sep'26", gratuity: 250, difference: 50 },
        { date: "Aug'26", gratuity: 200, difference: 20 },
        { date: "Jul'26", gratuity: 180, difference: 10 }
      ]
    }));
    component.openAllDetailsModal();
    component.selectAllDashboardMetric('vasukiSuper');
    component.selectAllDashboardChartItem({ name: 'Jul 2026', value: 180 });
    component.setAllDashboardDateRange('from', '2026-08');
    expect(component.selectedAllDashboardDatum).toBeNull();
    expect(component.allDashboardSummaryCards[0].detail).toContain('₹ 50.00 (Sep 2026 minus Aug 2026)');
    expect(component.allDashboardSummaryCards[2].value).toBe('2');
    component.setAllDashboardDateRange('to', '2026-08');
    expect(component.allDashboardSummaryCards[1].value).toBe('—');
    component.closeAllDetails();
    component.openAllDetailsModal();
    expect(component.allDashboardFrom).toBe('');
    expect(component.allDashboardTo).toBe('');
  });

  it('rejects out-of-bounds, invalid, empty, and reversed ranges without altering the valid range', () => {
    component.openAllDetailsModal();
    for (const [endpoint, value] of [
      ['from', '2023-09-28'], ['to', '2023-11-01'], ['from', '2023-02-30'], ['from', '']
    ] as const) {
      component.setAllDashboardDateRange(endpoint, value);
      expect(component.allDashboardRangeError).toContain('Choose a valid range');
      expect(component.allDashboardFrom).toBe('');
      expect(component.allDashboardTo).toBe('');
    }
    component.setAllDashboardDateRange('from', '2023-10-30');
    expect(component.allDashboardRangeError).toBe('');
    component.setAllDashboardDateRange('to', '2023-10-01');
    expect(component.allDashboardFrom).toBe('2023-10-30');
    expect(component.allDashboardTo).toBe('2023-10-31');
    expect(component.allDashboardRangeError).not.toBe('');
  });

  it('supports an empty range without altering the available bounds', () => {
    component.openAllDetailsModal();
    component.setAllDashboardDateRange('from', '2023-10-01');
    component.setAllDashboardDateRange('to', '2023-10-02');
    expect(component.allDashboardChartData).toEqual([]);
    expect(component.allDashboardSummaryCards[0].value).toBe('0');
    expect(component.allDashboardDateBounds).toEqual({ min: '2023-09-29', max: '2023-10-31' });
    component.transfers = [];
    component.resetAllDashboardDateRange();
    expect(component.allDashboardDateBounds).toEqual({ min: '', max: '' });
  });

  it('compares overall interest with the previous recorded month and follows chart selections', () => {
    const totalRecords = [
      { date: "Sep'26", total: 1500, difference: 40 },
      { date: "Aug'26", total: 1460, difference: 50 },
      { date: "Jul'26", total: 1410, difference: 30 }
    ];
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: 'All', type: 'Total', totalRecords
    }));
    component.openAllDetailsModal();
    for (const metric of ['overallBalance', 'overallInterest']) {
      component.selectAllDashboardMetric(metric);
      expect(component.allDashboardSummaryCards.length).toBe(4);
      let card = component.allDashboardSummaryCards[3];
      expect(card.label).toBe('Current monthly interest');
      expect(card.value).toBe('₹ 40.00');
      expect(card.detail).toBe('Sep 2026 | Previous (Aug 2026): ₹ 50.00 | Difference: ₹ -10.00');
      const totalIndex = metric === 'overallBalance' ? 1 : 0;
      expect(component.allDashboardSummaryCards[totalIndex].value).toBe('₹ 120.00');
      for (const type of ['bar', 'line', 'pie', 'doughnut']) {
        component.selectChartType(type);
        component.selectAllDashboardChartItem({
          name: 'Aug 2026', value: metric === 'overallBalance' ? 1460 : 50
        });
        card = component.allDashboardSummaryCards[3];
        expect(card.label).toBe('Selected monthly interest');
        expect(card.value).toBe('₹ 50.00');
        expect(card.detail).toBe('Aug 2026 | Previous (Jul 2026): ₹ 30.00 | Difference: ₹ 20.00');
        expect(card.color).toBe(component.allDashboardChartColorScheme.domain[type === 'line' ? 0 : 1]);
        expect(component.allDashboardSummaryCards[totalIndex]).toEqual({
          label: 'Total interest', value: '₹ 120.00', detail: 'Sum of all recorded monthly interest'
        });
      }
      component.selectAllDashboardChartItem({
        name: 'Jul 2026', value: metric === 'overallBalance' ? 1410 : 30
      });
      expect(component.allDashboardSummaryCards[3].detail).toContain('No previous recorded month');
      component.clearAllDashboardSelection();
      expect(component.allDashboardSummaryCards[3].value).toBe('₹ 40.00');
    }
    expect(totalRecords.map(({ date }) => date)).toEqual(["Sep'26", "Aug'26", "Jul'26"]);
    component.selectAllDashboardMetric('kumarPfAmount');
    expect(component.allDashboardSummaryCards.length).toBe(3);
  });

  it('shows unavailable overall interest when there are no recorded months', () => {
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: 'All', type: 'Total', totalRecords: []
    }));
    component.openAllDetailsModal();
    component.selectAllDashboardMetric('overallBalance');
    expect(component.allDashboardSummaryCards[3]).toEqual({
      label: 'Current monthly interest', value: '—', detail: 'No recorded interest'
    });
  });

  it('matches highlight dots to their chart periods and leaves aggregate cards neutral', () => {
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '4', name: 'Kumar', title: 'Gratuity', description: 'History', type: 'Gratuity',
      gratuityRecords: [
        { date: "Sep'26", gratuity: 200, difference: 20 },
        { date: "Aug'26", gratuity: 180, difference: 10 }
      ]
    }));
    component.openAllDetailsModal();
    expect(component.allDashboardSummaryCards.every(({ color }) => color === undefined)).toBeTrue();
    component.selectAllDashboardMetric('kumarGratuity');
    expect(component.allDashboardSummaryCards[0].color).toBe(component.allDashboardChartColorScheme.domain[1]);
    expect(component.allDashboardSummaryCards[1].color).toBe(component.allDashboardChartColorScheme.domain[0]);
    expect(component.allDashboardSummaryCards[0].colorLabel).toBe('Chart color for Sep 2026');
    expect(component.allDashboardSummaryCards[2].color).toBeUndefined();
  });

  it('formats chart tooltip values with the selected metric currency', () => {
    expect(component.formatChartValue(1234.5)).toBe('$ 1,234.50');

    component.selectMetric('amountReceivedINR');
    expect(component.formatChartValue(1234.5)).toBe('₹ 1,234.50');

    component.selectMetric('conversionRate');
    expect(component.formatChartValue(53.5)).toBe('₹ 53.50 / AUD');
  });

  for (const { current, expected } of [
    { current: 200, expected: '₹ 20.00' },
    { current: 180, expected: '₹ 0.00' },
    { current: 160, expected: '₹ -20.00' }
  ]) {
    it(`shows the Vasuki super period difference for a current balance of ${current}`, () => {
      const records = [
        { date: "Sep'26", gratuity: current, difference: 999 },
        { date: "Aug'26", gratuity: 180, difference: 888 }
      ];
      gratuityDataService.getGratuityData.and.returnValue(of({
        id: '6', name: 'Vasuki', title: 'Super', description: 'History', type: 'Super',
        gratuityRecords: records
      }));
      component.openAllDetailsModal();
      component.selectAllDashboardMetric('vasukiSuper');
      const cards = component.allDashboardSummaryCards;
      expect(cards.length).toBe(3);
      expect(cards[0].value).toBe(`₹ ${current}.00`);
      expect(cards[1].value).toBe('₹ 180.00');
      expect(cards[2].value).toBe('2');
      expect(cards[0].detail).toBe(`Difference: ${expected} (Sep 2026 minus Aug 2026)`);
      expect(cards[1].detail).toBeUndefined();
      expect(cards[2].detail).toBeUndefined();
      expect(records.map(({ date }) => date)).toEqual(["Sep'26", "Aug'26"]);
      component.selectAllDashboardMetric('vasukiGratuity');
      expect(component.allDashboardSummaryCards.length).toBe(3);
    });
  }

  for (const recordCount of [0, 1]) {
    it(`shows an unavailable Vasuki super difference with ${recordCount} recorded periods`, () => {
      gratuityDataService.getGratuityData.and.returnValue(of({
        id: '6', name: 'Vasuki', title: 'Super', description: 'History', type: 'Super',
        gratuityRecords: [{ date: "Sep'26", gratuity: 200, difference: 20 }].slice(0, recordCount)
      }));
      component.openAllDetailsModal();
      component.selectAllDashboardMetric('vasukiSuper');
      expect(component.allDashboardSummaryCards.length).toBe(3);
      expect(component.allDashboardSummaryCards[0].detail).toBe(
        'Difference: — (Two recorded periods are needed)'
      );
    });
  }

  it('highlights lowest and highest eligible rates with transfer dates without changing chart records', () => {
    component.transfers = [
      { ...transfers[0], conversionRate: 0.5 },
      { ...transfers[1], conversionRate: 54 },
      { ...transfers[0], dateOfTransfer: '01-Aug-23', conversionRate: 1 }
    ];
    component.selectAllDashboardMetric('conversionRate');
    const cards = component.allDashboardSummaryCards;
    expect(cards.map(({ label }) => label)).toEqual(['Lowest exchange rate', 'Highest exchange rate', 'Transfers']);
    expect(cards[0].value).toBe('₹ 1.00 / AUD');
    expect(cards[0].detail).toBe('Transfer date: 01 Aug 2023');
    expect(cards[0].color).toBe(component.allDashboardChartColorScheme.domain[2]);
    expect(cards[1].value).toBe('₹ 54.00 / AUD');
    expect(cards[1].detail).toBe('Transfer date: 31 Oct 2023');
    expect(cards[2].value).toBe('3');
    expect(component.allDashboardChartData.length).toBe(3);
  });

  it('shows a selected super period and compares it to the preceding record, not the latest period', () => {
    gratuityDataService.getGratuityData.and.returnValue(of({
      id: '6', name: 'Vasuki', title: 'Super', description: 'History', type: 'Super',
      gratuityRecords: [
        { date: "Sep'26", gratuity: 250, difference: 50 },
        { date: "Aug'26", gratuity: 200, difference: 20 },
        { date: "Jul'26", gratuity: 180, difference: 10 }
      ]
    }));
    component.openAllDetailsModal();
    component.selectAllDashboardMetric('vasukiSuper');
    for (const type of ['bar', 'line', 'pie', 'doughnut']) {
      component.selectChartType(type);
      component.selectAllDashboardChartItem({ name: 'Aug 2026', value: 200 });
      const cards = component.allDashboardSummaryCards;
      expect(cards[0].value).toBe('₹ 200.00');
      expect(cards[0].detail).toBe('Difference: ₹ 20.00 (Aug 2026 minus Jul 2026)');
      expect(cards[1].value).toBe('₹ 180.00');
      expect(cards[1].detail).toBe('Jul 2026');
      expect(cards[2]).toEqual({ label: 'Selected record', value: '2 of 3', detail: 'Aug 2026' });
    }
    component.selectAllDashboardChartItem({ name: 'Jul 2026', value: 180 });
    expect(component.allDashboardSummaryCards[2].value).toBe('1 of 3');
    expect(component.allDashboardSummaryCards[1].value).toBe('—');
    expect(component.allDashboardSummaryCards[0].detail).toContain('No previous recorded period');
    component.clearAllDashboardSelection();
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 250.00');
    expect(component.allDashboardSummaryCards[2]).toEqual({ label: 'Recorded periods', value: '3' });
    component.selectAllDashboardChartItem({ name: 'Sep 2026', value: 250 });
    expect(component.allDashboardSummaryCards[2].value).toBe('3 of 3');
  });

  it('matches paired metric cards by the selected month', () => {
    totalBalanceService.getTotals.and.returnValue(of({
      id: '7', name: 'All', type: 'Total',
      totalRecords: [
        { date: "Sep'26", total: 1000, difference: 30 },
        { date: "Aug'26", total: 900, difference: 20 }
      ]
    }));
    component.openAllDetailsModal();
    component.selectAllDashboardMetric('overallBalance');
    component.selectAllDashboardChartItem({ name: 'Aug 2026', value: 900 });
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 900.00');
    expect(component.allDashboardSummaryCards[1].value).toBe('₹ 50.00');
    expect(component.allDashboardSummaryCards[1].detail).toBe('Sum of all recorded monthly interest');
    expect(component.allDashboardSummaryCards[1].color).toBeUndefined();
    expect(component.allDashboardSummaryCards[3].value).toBe('₹ 20.00');
    expect(component.allDashboardSummaryCards[2]).toEqual({
      label: 'Selected record', value: '1 of 2', detail: 'Aug 2026'
    });
    component.selectAllDashboardMetric('overallInterest');
    expect(component.selectedAllDashboardDatum).toBeNull();
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 50.00');
    expect(component.allDashboardSummaryCards[2]).toEqual({ label: 'Recorded periods', value: '2' });
  });

  it('shows selected transfer amounts and its transaction position', () => {
    component.openAllDetailsModal();
    component.selectAllDashboardChartItem({ name: '29 Sep 2023', value: 100 });
    expect(component.allDashboardSummaryCards.map(({ value }) => value)).toEqual(['1 of 2', '$100.00', '₹ 5,350']);
    expect(component.allDashboardSummaryCards[0]).toEqual({
      label: 'Selected transaction', value: '1 of 2', detail: '29 Sep 2023'
    });
    expect(component.allDashboardSummaryCards[1].detail).toBe('29 Sep 2023');
    component.closeAllDetails();
    component.openAllDetailsModal();
    expect(component.selectedAllDashboardDatum).toBeNull();
    expect(component.allDashboardSummaryCards[1].value).toBe('$300.00');
    expect(component.allDashboardSummaryCards[0]).toEqual({ label: 'Transfers', value: '2' });
    component.selectAllDashboardMetric('amountReceivedINR');
    component.selectAllDashboardChartItem({ name: '31 Oct 2023', value: 10800 });
    expect(component.allDashboardSummaryCards[0].value).toBe('2 of 2');
  });

  it('selects the correct transfer with a repeated date and shows selected and previous rates', () => {
    component.transfers = [
      { ...transfers[0], conversionRate: 0.5 },
      { ...transfers[0], conversionRate: 55 }
    ];
    component.selectAllDashboardMetric('conversionRate');
    component.selectAllDashboardChartItem({ name: '29 Sep 2023', value: 55, series: 'Exchange rate' });
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 55.00 / AUD');
    expect(component.allDashboardSummaryCards[1].value).toBe('₹ 0.50 / AUD');
    expect(component.allDashboardSummaryCards[2]).toEqual({
      label: 'Selected transaction', value: '2 of 2', detail: '29 Sep 2023'
    });
    component.selectAllDashboardChartItem({ name: '29 Sep 2023', value: 0.5 });
    expect(component.allDashboardSummaryCards[1].value).toBe('—');
    expect(component.allDashboardSummaryCards[1].detail).toBe('No previous recorded transfer');
    expect(component.allDashboardSummaryCards[2].value).toBe('1 of 2');
    component.clearAllDashboardSelection();
    expect(component.allDashboardSummaryCards[0].label).toBe('Lowest exchange rate');
    expect(component.allDashboardSummaryCards[0].value).toBe('₹ 55.00 / AUD');
    expect(component.allDashboardSummaryCards[2]).toEqual({ label: 'Transfers', value: '2' });
  });

  it('reports unmatched or ambiguous selections without changing the selected cards', () => {
    component.selectAllDashboardChartItem({ name: '29 Sep 2023', value: 100 });
    component.selectAllDashboardChartItem({ name: 'Unknown', value: 100 });
    expect(component.selectedAllDashboardDatum?.name).toBe('29 Sep 2023');
    expect(component.toastMessage).toContain('Select a specific chart item');
    component.selectAllDashboardChartItem(null);
    expect(component.toastMessage).toBe('Unable to select this chart item.');
    component.ngOnDestroy();
  });

  it('shows an explicit empty rate summary when no rates qualify', () => {
    component.transfers = [{ ...transfers[0], conversionRate: 0.9 }];
    component.selectAllDashboardMetric('conversionRate');
    expect(component.allDashboardSummaryCards[0].value).toBe('—');
    expect(component.allDashboardSummaryCards[1].detail).toBe('No exchange rates of 1 or above');
    expect(component.allDashboardSummaryCards[0].color).toBeUndefined();
  });

  it('matches rate highlight colors to the chart and legend when transfer dates repeat', () => {
    component.transfers = [
      { ...transfers[0], conversionRate: 50 },
      { ...transfers[0], conversionRate: 55 },
      { ...transfers[1], conversionRate: 60 }
    ];
    component.selectAllDashboardMetric('conversionRate');
    const records = component.allDashboardChartData;
    const colors = new ColorHelper(
      component.allDashboardChartColorScheme, ScaleType.Ordinal, records.map(({ name }) => name)
    );
    for (const type of ['bar', 'pie', 'doughnut']) {
      component.selectChartType(type);
      expect(component.allDashboardSummaryCards[0].color).toBe(colors.getColor('29 Sep 2023'));
      expect(component.allDashboardSummaryCards[1].color).toBe(colors.getColor('31 Oct 2023'));
      expect(component.allDashboardSummaryCards[1].color).toBe(component.allDashboardChartColorScheme.domain[1]);
      expect(component.allDashboardChartData).toEqual(records);
    }
  });

  it('uses the single line series color for both exchange rate highlights', () => {
    component.selectAllDashboardMetric('conversionRate');
    component.selectChartType('line');
    const colors = new ColorHelper(
      component.allDashboardChartColorScheme, ScaleType.Ordinal,
      component.allDashboardLineChartData.map(({ name }) => name)
    );
    const seriesName = component.allDashboardLineChartData[0].name;
    for (const card of component.allDashboardSummaryCards.slice(0, 2)) {
      expect(card.color).toBe(colors.getColor(seriesName));
      expect(card.colorLabel).toBe(`Chart color for ${seriesName}`);
    }
    component.selectChartType('bar');
    expect(component.allDashboardSummaryCards[1].color).toBe(component.allDashboardChartColorScheme.domain[1]);
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

  it('starts the transfer dashboard collapsed and toggles it with the accordion control', () => {
    expect(component.isTransferSectionExpanded).toBeFalse();

    component.toggleTransferSection();

    expect(component.isTransferSectionExpanded).toBeTrue();

    component.toggleTransferSection();

    expect(component.isTransferSectionExpanded).toBeFalse();
  });

  it('sorts transfer amounts and keeps original indexes for row actions', () => {
    component.sortTransfers('amountTransferredAUD');

    expect(component.sortedTransfers.map((row) => row.transfer.amountTransferredAUD)).toEqual([100, 200]);
    expect(component.sortedTransfers.map((row) => row.index)).toEqual([0, 1]);

    component.sortTransfers('amountTransferredAUD');

    expect(component.sortedTransfers.map((row) => row.transfer.amountTransferredAUD)).toEqual([200, 100]);
    expect(component.sortedTransfers.map((row) => row.index)).toEqual([1, 0]);
  });

  it('defaults to descending transfer dates despite backend date format variations', () => {
    component.transfers = [
      { ...transfers[1], dateOfTransfer: '7-Aug-24' },
      { ...transfers[0], dateOfTransfer: '05-July-26' },
      { ...transfers[0], dateOfTransfer: '29-Sep-23' }
    ];

    expect(component.sortKey).toBe('dateOfTransfer');
    expect(component.sortDirection).toBe('desc');
    expect(component.sortedTransfers.map((row) => row.transfer.dateOfTransfer))
      .toEqual(['05-July-26', '7-Aug-24', '29-Sep-23']);
    expect(component.sortedTransfers.map(({ index }) => index)).toEqual([1, 0, 2]);
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

  it('updates the selected record after confirming and refreshes dashboard data', async () => {
    const updatedTransfer = {
      ...transfers[1],
      amountTransferredAUD: 250,
      amountReceivedINR: 13500
    };
    const updatedTransfers = [transfers[0], updatedTransfer];
    transferService.updateTransfers.and.returnValue(of(updatedTransfers));
    component.editTransfer(1);
    component.editForm.controls.amountTransferredAUD.setValue(250);
    await verifyEditCode();

    component.saveTransfer();

    expect(transferService.updateTransfers).toHaveBeenCalledWith(updatedTransfers);
    expect(component.transfers).toEqual(updatedTransfers);
    expect(component.totalTransferredAUD).toBe(350);
    expect(component.editingTransferIndex).toBeNull();
    expect(component.toastMessage).toBe('Transfer updated successfully.');
    expect(changeDetector.detectChanges).toHaveBeenCalled();
  });

  it('saves a date-picker value in the backend date format after confirmation', async () => {
    const updatedTransfers = [transfers[0], { ...transfers[1], receivedDate: '14-Nov-23' }];
    transferService.updateTransfers.and.returnValue(of(updatedTransfers));
    component.editTransfer(1);
    component.editForm.controls.dateOfTransfer.setValue('2023-10-31');
    component.editForm.controls.receivedDate.setValue('2023-11-14');
    await verifyEditCode();

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

  it('keeps the editor open and reports a failed update after confirmation', async () => {
    transferService.updateTransfers.and.returnValue(
      throwError(() => new Error('Update failed'))
    );
    component.editTransfer(0);
    await verifyEditCode();

    component.saveTransfer();

    expect(component.editingTransferIndex).toBe(0);
    expect(component.saveError).toBe('Update failed');
    expect(component.transfers).toEqual(transfers);
  });

  it('does not save an edited transfer until its confirmation code is verified', () => {
    component.editTransfer(0);

    component.saveTransfer();

    expect(transferService.updateTransfers).not.toHaveBeenCalled();
    expect(component.canSaveChanges).toBeFalse();
  });

  it('requires confirmation and saves the remaining transfers after deleting one', async () => {
    const remainingTransfers = [transfers[1]];
    transferService.updateTransfers.and.returnValue(of(remainingTransfers));

    component.requestDeleteTransfer(0);
    expect(transferService.updateTransfers).not.toHaveBeenCalled();

    component.deleteConfirmationCode.setValue('12345678901234');
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
    component.deleteConfirmationCode.setValue('12345678901234');
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
    component.deleteConfirmationCode.setValue('12345678901234');
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
      confirmationCodeService,
      pfDataService,
      gratuityDataService,
      totalBalanceService
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
