import { Component } from '@angular/core';
import { GratuityResourceId } from '../service/gratuity-data.service';

@Component({
  selector: 'app-vasuki-super',
  templateUrl: './vasuki-super.component.html',
  standalone: false
})
export class VasukiSuperComponent {
  readonly resourceId: GratuityResourceId = '6';
  readonly ownerName = 'Vasuki';
}
