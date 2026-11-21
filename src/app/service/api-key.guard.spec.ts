import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { ApiEncryptionService } from '../shared/service/api-encryption.service';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let encryption: ApiEncryptionService;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    encryption = new ApiEncryptionService();
    guard = new ApiKeyGuard(encryption, TestBed.inject(Router));
  });

  it('requests a key for protected routes and reuses it for the other route', async () => {
    const targets: (string | null)[] = [];
    guard.requested$.subscribe((target) => targets.push(target));
    const result = guard.canMatch({ path: 'dashboard' });
    expect(typeof result).not.toBe('boolean');
    if (typeof result === 'boolean') {
      fail('Expected a pending key request.');
      return;
    }

    const allowed = firstValueFrom(result);
    expect(targets.at(-1)).toBe('dashboard');
    guard.unlock('runtime test key');
    expect(await allowed).toBeTrue();
    expect(targets.at(-1)).toBeNull();
    expect(guard.canMatch({ path: 'my-access' })).toBeTrue();
  });

  it('cancels the protected navigation without retaining a key', async () => {
    const result = guard.canMatch({ path: 'my-access' });
    if (typeof result === 'boolean') {
      fail('Expected a pending key request.');
      return;
    }
    const allowed = firstValueFrom(result);
    guard.cancel();
    const redirect = await allowed;
    expect(redirect instanceof UrlTree).toBeTrue();
    expect(redirect.toString()).toBe('/');
    expect(encryption.hasPassphrase).toBeFalse();
  });
});
