import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-work-experience',
  templateUrl: './work-experience.component.html',
  styleUrls: ['./work-experience.component.scss'],
  standalone: false
})
export class WorkExperienceComponent {
  @Input() companyDeatils: any;
  @Input() proud: any;
}
