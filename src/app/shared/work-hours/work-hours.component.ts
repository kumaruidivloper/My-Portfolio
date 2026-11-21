import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TimeService } from '../service/time.service';
import { TotalWorkHoursService } from '../service/total-work-hours.service';

@Component({
  selector: 'app-work-hours',
  templateUrl: './work-hours.component.html',
  styleUrls: ['./work-hours.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class WorkHoursComponent implements OnInit, OnDestroy {
  @Input() label = '';

  currentTime = new Date();
  isWorkingHours = false;
  isTotalWorkHoursVisible = false;
  totalWorkedHours = 0;
  private timeInterval?: ReturnType<typeof setInterval>;

  constructor(
    private timeService: TimeService,
    private totalWorkHoursService: TotalWorkHoursService
  ) {}

  ngOnInit(): void {
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  toggle(): void {
    this.isTotalWorkHoursVisible = !this.isTotalWorkHoursVisible;
    this.totalWorkedHours = this.totalWorkHoursService.totalWorkedHours();
  }

  private updateTime(): void {
    this.currentTime = new Date();
    this.isWorkingHours = this.timeService.getState(this.currentTime).isWorkingHours;
    this.totalWorkedHours = this.totalWorkHoursService.totalWorkedHours();
  }
}
