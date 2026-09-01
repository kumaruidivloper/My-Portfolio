import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-about-skills',
  templateUrl: './about-skills.component.html',
  styleUrls: ['./about-skills.component.scss'],
  standalone: false
})
export class AboutSkillsComponent {
  @Input() technology: any;
  @Input() barAnimation = false;
  @Input() transition: string[] = [];
  @Input() barRange: (value: number) => string = (value: number) => `${value}%`;
}
