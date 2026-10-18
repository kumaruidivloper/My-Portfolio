import { booleanAttribute, ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-dashboard-loader',
  templateUrl: './dashboard-loader.component.html',
  styleUrls: ['./dashboard-loader.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  host: {
    role: 'status',
    '[class.inline]': 'inline',
    '[attr.aria-label]': 'label'
  }
})
export class DashboardLoaderComponent {
  /** Announced to screen readers; never shown visually. */
  @Input() label = 'Loading';
  /** Small spinner that sits inside buttons and text rows. */
  @Input({ transform: booleanAttribute }) inline = false;
}
