import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TotalWorkHoursService {
  myTotalWorkedHours: number = 0;
  constructor() { }

  totalWorkedHours(): number {
    // Define the start date (May 2007)
    const startDate: any = new Date(2007, 4); // Note: Months are zero-based, so 4 represents May

    // Get the current date
    const currentDate: any = new Date();

    // Calculate the number of weeks between the start date and the current date
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksWorked = Math.floor((currentDate - startDate) / millisecondsPerWeek);

    // Define the weekly working hours
    const weeklyHours = 45;

    // Calculate the total worked hours
    
    return weeksWorked * weeklyHours;
  }
}
