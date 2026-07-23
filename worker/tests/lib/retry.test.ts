import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from '../../src/lib/retry';

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and returns on eventual success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');

    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws last error after all retries exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockRejectedValueOnce(new Error('fail3'));

    await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow('fail3');
  });

  it('applies exponential backoff delays', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');

    const promise = retryWithBackoff(fn, 3, 1000);

    // First retry: 1000ms delay
    await vi.advanceTimersByTimeAsync(1000);
    // Second retry: 2000ms delay
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('wraps non-Error throws in Error', async () => {
    const fn = vi.fn().mockRejectedValueOnce('string error');
    await expect(retryWithBackoff(fn, 1, 10)).rejects.toThrow('string error');
  });
});
