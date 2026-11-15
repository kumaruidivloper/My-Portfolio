import { Injectable } from '@angular/core';
import { CanMatch, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { environment } from '../../environments/environment';

export type ProtectedDestination = 'dashboard' | 'my-access';

@Injectable({
  providedIn: 'root'
})
export class DashboardAccessGuard implements CanMatch {
  private grantedDestination: ProtectedDestination | null = null;

  constructor(private router: Router) {}

  grantOneTimeAccess(destination: ProtectedDestination = 'dashboard'): void {
    this.grantedDestination = destination;
  }

  canMatch(route: Route, _segments: UrlSegment[]): boolean | UrlTree {
    if (!environment.production) {
      return true;
    }

    const hasAccess = this.grantedDestination !== null && this.grantedDestination === route.path;
    this.grantedDestination = null;

    return hasAccess || this.router.parseUrl('/');
  }
}
