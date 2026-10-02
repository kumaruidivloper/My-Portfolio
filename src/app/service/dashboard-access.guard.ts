import { Injectable } from '@angular/core';
import { CanMatch, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardAccessGuard implements CanMatch {
  private hasOneTimeAccess = false;

  constructor(private router: Router) {}

  grantOneTimeAccess(): void {
    this.hasOneTimeAccess = true;
  }

  canMatch(_route: Route, _segments: UrlSegment[]): boolean | UrlTree {
    if (!environment.production) {
      return true;
    }

    const hasAccess = this.hasOneTimeAccess;
    this.hasOneTimeAccess = false;

    return hasAccess || this.router.parseUrl('/');
  }
}
