import { Injectable } from '@angular/core';
import { hashConfirmationCode } from './confirmation-code.service';

const UNMASK_CODE_SHA256 = 'f0836781f6216a183a1a0b66ff2e7801908e3cdb4fe7c928175d6cfd7096595b';

@Injectable({ providedIn: 'root' })
export class UnmaskCodeService {
  async verify(code: string): Promise<boolean> {
    return await hashConfirmationCode(code, globalThis.crypto?.subtle) === UNMASK_CODE_SHA256;
  }
}
