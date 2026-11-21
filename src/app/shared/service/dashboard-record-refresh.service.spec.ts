import { DashboardRecordRefreshService } from './dashboard-record-refresh.service';

describe('DashboardRecordRefreshService', () => {
  it('notifies subscribers whether the dashboard should refresh', () => {
    const service = new DashboardRecordRefreshService();
    const updates: boolean[] = [];
    const subscription = service.updated$.subscribe((refresh) => updates.push(refresh));

    service.notifyUpdated();
    service.notifyUpdated(false);
    subscription.unsubscribe();
    service.notifyUpdated();

    expect(updates).toEqual([true, false]);
  });
});
