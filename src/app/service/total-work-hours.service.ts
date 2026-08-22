import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TotalWorkHoursService {
  myTotalWorkedHours: number = 0;
  constructor() { }

  totalWorkedHours(): number {
    const startDate = new Date(2007, 4, 1);
    const currentDate = new Date();
    const workdayStartHour = 9;
    const workdayHours = 9;

    if (currentDate < startDate) {
      return 0;
    }

    let totalWorkedHours = 0;
    const day = new Date(startDate);
    day.setHours(0, 0, 0, 0);

    while (day <= currentDate) {
      const dayOfWeek = day.getDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

      if (isWeekday) {
        const isCurrentDay = day.toDateString() === currentDate.toDateString();

        if (!isCurrentDay) {
          totalWorkedHours += workdayHours;
        } else {
          const workdayStart = new Date(day);
          workdayStart.setHours(workdayStartHour, 0, 0, 0);
          const elapsedHours = (currentDate.getTime() - workdayStart.getTime()) / (60 * 60 * 1000);
          totalWorkedHours += Math.min(workdayHours, Math.max(0, elapsedHours));
        }
      }

      day.setDate(day.getDate() + 1);
    }

    return Math.floor(totalWorkedHours);
  }
}
