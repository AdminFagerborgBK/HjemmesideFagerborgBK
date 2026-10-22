import { describe, expect, it } from 'vitest';
import { HOMEPAGE_MOBILE_VIDEO_LIMIT, HOMEPAGE_VIDEO_LIMIT } from './homepageMedia';

describe('homepage video limits', () => {
  it('renders four videos on large screens (2x2 grid)', () => {
    expect(HOMEPAGE_VIDEO_LIMIT).toBe(4);
  });
  it('shows three videos on mobile and three across below xl', () => {
    expect(HOMEPAGE_MOBILE_VIDEO_LIMIT).toBe(3);
  });
});
