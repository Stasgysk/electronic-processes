const { isSessionExpired } = require('../../utils/UserUtils');

describe('isSessionExpired()', () => {
  it('returns true when expiresAt is in the past', () => {
    const session = { expiresAt: new Date(Date.now() - 1000) };
    expect(isSessionExpired(session)).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const session = { expiresAt: new Date(Date.now() + 60_000) };
    expect(isSessionExpired(session)).toBe(false);
  });

  it('returns true when expiresAt is exactly now (boundary)', () => {
    const now = new Date();
    const session = { expiresAt: now };
    jest.useFakeTimers();
    jest.setSystemTime(now.getTime() + 1);
    expect(isSessionExpired(session)).toBe(true);
    jest.useRealTimers();
  });
});
