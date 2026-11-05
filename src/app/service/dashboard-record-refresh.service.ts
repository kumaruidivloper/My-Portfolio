import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DashboardRecordRefreshService {
  private readonly updated = new Subject<boolean>();
  readonly updated$ = this.updated.asObservable();

  notifyUpdated(refreshDashboard = true): void {
    this.updated.next(refreshDashboard);
  }
}