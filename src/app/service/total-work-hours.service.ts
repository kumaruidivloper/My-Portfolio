import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TotalWorkHoursService {
  constructor() { }

  totalWorkedHours(): number {
    const startDate = new Date(2007, 4, 1);
    const currentDate = new Date();
    const workdayStartHour = 9;
    const workdayHours = 9;

    if (currentDate < startDate) {
      return 0;
    }

    const currentDay = new Date(currentDate);
    currentDay.setHours(0, 0, 0, 0);
    const elapsedDays = Math.floor((currentDay.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const fullWeeks = Math.floor(elapsedDays / 7);
    const remainingDays = elapsedDays % 7;
    let weekdays = fullWeeks * 5;

    for (let dayOffset = 0; dayOffset < remainingDays; dayOffset++) {
      const dayOfWeek = (startDate.getDay() + dayOffset) % 7;
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdays++;
      }
    }

    let totalWorkedHours = weekdays * workdayHours;
    if (currentDay.getDay() >= 1 && currentDay.getDay() <= 5) {
      const workdayStart = new Date(currentDay);
      workdayStart.setHours(workdayStartHour, 0, 0, 0);
      const elapsedHours = (currentDate.getTime() - workdayStart.getTime()) / (60 * 60 * 1000);
      totalWorkedHours += Math.min(workdayHours, Math.max(0, elapsedHours));
    }

    return Math.floor(totalWorkedHours);
  }
}
