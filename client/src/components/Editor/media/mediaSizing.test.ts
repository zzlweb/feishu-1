import { describe, expect, it } from 'vitest';
import { clampMediaWidth, resizeMediaByAspectRatio } from './mediaSizing';

describe('media sizing', () => {
  it('clamps video width to the editor bounds', () => {
    expect(clampMediaWidth(120, 800)).toBe(240);
    expect(clampMediaWidth(640, 800)).toBe(640);
    expect(clampMediaWidth(960, 800)).toBe(800);
  });

  it('preserves the video aspect ratio', () => {
    expect(resizeMediaByAspectRatio(640, 900, 16 / 9)).toEqual({ width: 640, height: 360 });
  });

  it('falls back to 16:9 for invalid metadata', () => {
    expect(resizeMediaByAspectRatio(480, 900, 0)).toEqual({ width: 480, height: 270 });
  });
});
