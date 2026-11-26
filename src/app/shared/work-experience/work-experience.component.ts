import { Component, Input, OnDestroy } from '@angular/core';
import { formatProfileTitle } from '../profile-title';

interface CompanyExperience {
  name: string;
  from: string;
  to: string;
}

interface CompanyBrand {
  match: string;
  label: string;
  logo: string;
}

@Component({
  selector: 'app-work-experience',
  templateUrl: './work-experience.component.html',
  styleUrls: ['./work-experience.component.scss'],
  standalone: false
})
export class WorkExperienceComponent implements OnDestroy {
  @Input() companyDeatils?: { companies: CompanyExperience[] };
  @Input() proud?: { title: string; companies: string };
  @Input() profile?: { name: string; title: string; userImage: string };

  private drag?: {
    pointerId: number;
    startX: number;
    startY: number;
    badge: HTMLElement;
    hanger: HTMLElement;
    leftLimit: number;
    rightLimit: number;
  };
  private returningCard?: HTMLElement;
  private returnTimer?: ReturnType<typeof setTimeout>;

  private readonly brands: CompanyBrand[] = [
    { match: 'dart innovation', label: 'Dart Innovations', logo: 'assets/img/companies/dart.jpg' },
    { match: 'xentaqsys', label: 'Xentaqsys', logo: 'assets/img/companies/xentaqsys.png' },
    { match: 'schindlers', label: 'Schindlers', logo: 'assets/img/companies/schindlers.png' },
    { match: 'cognizant', label: 'Cognizant', logo: 'assets/img/companies/cognizant.png' },
    { match: 'volvo', label: 'Volvo', logo: 'assets/img/companies/volvo.png' },
    { match: 'mindtree', label: 'Mindtree', logo: 'assets/img/companies/mindtree.png' },
    { match: 'boeing', label: 'Boeing', logo: 'assets/img/companies/boeing.png' },
    { match: 'harman', label: 'Harman', logo: 'assets/img/companies/harman.svg' },
    { match: 'tata consultancy', label: 'TCS', logo: 'assets/img/companies/tcs.png' }
  ];

  get profileRole(): string {
    return formatProfileTitle(this.profile?.title.replace(/^I am (?:an? )?/i, '') ?? '');
  }

  brandFor(name: string): CompanyBrand | undefined {
    return this.brands.find(brand => name.toLowerCase().includes(brand.match));
  }

  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
  }

  companyName(name: string): string {
    return name.replace(/^Cognizant Technology and Solution India Pvt Ltd$/i, 'Cognizant Technology & Solution India Pvt Ltd');
  }

  qrData(company: CompanyExperience): string {
    return `${this.companyName(company.name)}\nFrom: ${company.from}\nTo: ${company.to}`;
  }

  startDrag(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary || this.drag || !(event.currentTarget instanceof HTMLElement)) {
      return;
    }
    const badge = event.currentTarget;
    const hanger = badge.parentElement!;
    const bounds = badge.getBoundingClientRect();
    const viewportWidth = badge.ownerDocument.documentElement.clientWidth;
    const tiltLimit = (space: number) => Math.min(8, Math.atan(Math.max(0, space - 8) / hanger.offsetHeight) * 180 / Math.PI);
    this.finishReturn();
    this.drag = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      badge, hanger, leftLimit: tiltLimit(bounds.left), rightLimit: tiltLimit(viewportWidth - bounds.right)
    };
    hanger.classList.add('is-dragging');
    badge.setPointerCapture(event.pointerId);
  }

  moveDrag(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const distance = Math.max(0, event.clientY - drag.startY);
    const pull = 64 * distance / (distance + 100);
    const tilt = Math.max(-drag.rightLimit, Math.min(drag.leftLimit, -(event.clientX - drag.startX) / 14));
    drag.hanger.style.setProperty('--card-pull', `${pull}px`);
    drag.hanger.style.setProperty('--card-tilt', `${tilt}deg`);
  }

  endDrag(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    this.drag = undefined;
    drag.hanger.classList.add('is-returning');
    drag.hanger.classList.remove('is-dragging');
    drag.hanger.style.setProperty('--card-pull', '0px');
    drag.hanger.style.setProperty('--card-tilt', '0deg');
    if (drag.badge.hasPointerCapture(event.pointerId)) {
      drag.badge.releasePointerCapture(event.pointerId);
    }
    this.returningCard = drag.hanger;
    this.returnTimer = setTimeout(() => this.finishReturn(), 650);
  }

  ngOnDestroy(): void {
    this.finishReturn();
  }

  private finishReturn(): void {
    clearTimeout(this.returnTimer);
    this.returningCard?.classList.remove('is-returning');
    this.returningCard = undefined;
    this.returnTimer = undefined;
  }
}
