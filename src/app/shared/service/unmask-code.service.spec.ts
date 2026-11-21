import { UnmaskCodeService } from './unmask-code.service';

describe('UnmaskCodeService', () => {
  it('rejects a code that does not match the configured reveal code', async () => {
    const service = new UnmaskCodeService();
    expect(await service.verify('not-the-code')).toBeFalse();
    expect(await service.verify('incorrect')).toBeFalse();
  });
});
