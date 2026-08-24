import { Injectable } from '@angular/core';
import { TimeState } from '../model/time-state';

@Injectable({
  providedIn: 'root'
})
export class TimeService {
  getState(date: Date = new Date()): TimeState {
    const day = date.getDay();
    const hour = date.getHours();
    const isWeekend = day === 0 || day === 6;

    return {
      isWeekend,
      isWorkingHours: !isWeekend && hour >= 9 && hour < 18,
      isDaytime: hour >= 7 && hour < 19
    };
  }
}
