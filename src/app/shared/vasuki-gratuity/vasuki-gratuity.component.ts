import { Component } from '@angular/core';
import { GratuityResourceId } from '../service/gratuity-data.service';

@Component({
  selector: 'app-vasuki-gratuity',
  templateUrl: './vasuki-gratuity.component.html',
  standalone: false
})
export class VasukiGratuityComponent {
  readonly resourceId: GratuityResourceId = '5';
  readonly ownerName = 'Vasuki';
}
