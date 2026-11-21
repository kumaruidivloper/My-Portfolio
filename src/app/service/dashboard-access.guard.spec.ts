import { Router, UrlTree } from '@angular/router';
import { environment } from '../../environments/environment';
import { DashboardAccessGuard } from './dashboard-access.guard';

describe('DashboardAccessGuard', () => {
  let guard: DashboardAccessGuard;
  let redirect: UrlTree;
  let originalProduction: boolean;

  beforeEach(() => {
    originalProduction = environment.production;
    redirect = new UrlTree();
    const router = jasmine.createSpyObj<Router>('Router', ['parseUrl']);
    router.parseUrl.and.returnValue(redirect);
    guard = new DashboardAccessGuard(router);
  });

  afterEach(() => {
    environment.production = originalProduction;
  });

  it('allows direct access in development', () => {
    environment.production = false;

    expect(guard.canMatch({ path: 'dashboard' }, [])).toBeTrue();
    expect(guard.canMatch({ path: 'my-access' }, [])).toBeTrue();
  });

  it('consumes a production grant after one matching navigation', () => {
    environment.production = true;
    guard.grantOneTimeAccess('my-access');

    expect(guard.canMatch({ path: 'my-access' }, [])).toBeTrue();
    expect(guard.canMatch({ path: 'my-access' }, [])).toBe(redirect);
  });

  it('rejects a mismatched destination and consumes the grant', () => {
    environment.production = true;
    guard.grantOneTimeAccess();

    expect(guard.canMatch({ path: 'my-access' }, [])).toBe(redirect);
    expect(guard.canMatch({ path: 'dashboard' }, [])).toBe(redirect);
  });
});
