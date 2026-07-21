export const MIN_VIDEO_WIDTH = 240;
export const DEFAULT_VIDEO_WIDTH = 520;

export interface MediaDimensions {
  width: number;
  height: number;
}

export function clampMediaWidth(width: number, maxWidth: number, minWidth = MIN_VIDEO_WIDTH) {
  const safeMax = Math.max(minWidth, Math.round(maxWidth));
  return Math.min(safeMax, Math.max(minWidth, Math.round(width)));
}

export function resizeMediaByAspectRatio(
  width: number,
  maxWidth: number,
  aspectRatio: number,
  minWidth = MIN_VIDEO_WIDTH,
): MediaDimensions {
  const nextWidth = clampMediaWidth(width, maxWidth, minWidth);
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  return {
    width: nextWidth,
    height: Math.round(nextWidth / safeRatio),
  };
}
