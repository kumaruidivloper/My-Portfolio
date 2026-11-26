import { Component, Input } from '@angular/core';
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
export class WorkExperienceComponent {
  @Input() companyDeatils?: { companies: CompanyExperience[] };
  @Input() proud?: { title: string; companies: string };
  @Input() profile?: { name: string; title: string; userImage: string };

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
}
