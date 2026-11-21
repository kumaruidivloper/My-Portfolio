import { Injectable } from '@angular/core';
import { CanMatch, Route, Router, UrlTree } from '@angular/router';
import { BehaviorSubject, finalize, Observable, ReplaySubject } from 'rxjs';
import { ApiEncryptionService } from '../shared/service/api-encryption.service';
import { ProtectedDestination } from './dashboard-access.guard';

@Injectable({ providedIn: 'root' })
export class ApiKeyGuard implements CanMatch {
  private readonly requested = new BehaviorSubject<ProtectedDestination | null>(null);
  readonly requested$ = this.requested.asObservable();
  private pending: ReplaySubject<boolean | UrlTree> | null = null;

  constructor(private readonly encryption: ApiEncryptionService, private readonly router: Router) {}

  canMatch(route: Route): boolean | Observable<boolean | UrlTree> {
    if (this.encryption.hasPassphrase) {
      return true;
    }

    this.cancel();
    const pending = new ReplaySubject<boolean | UrlTree>(1);
    this.pending = pending;
    this.requested.next(route.path === 'my-access' ? 'my-access' : 'dashboard');
    return pending.pipe(finalize(() => {
      if (this.pending === pending) {
        this.pending = null;
        this.requested.next(null);
      }
    }));
  }

  unlock(passphrase: string): void {
    if (!this.pending) {
      return;
    }
    this.encryption.setPassphrase(passphrase);
    this.finish(true);
  }

  cancel(): void {
    this.finish(false);
  }

  private finish(allowed: boolean): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    this.pending = null;
    this.requested.next(null);
    pending.next(allowed ? true : this.router.parseUrl('/'));
    pending.complete();
  }
}
