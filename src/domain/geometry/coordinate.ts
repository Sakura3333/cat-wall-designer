import type { Vec2 } from '../scene/types'

export function viewportToImagePoint(point: Vec2, imageSize: { width: number; height: number }, viewportSize: { width: number; height: number }): Vec2 {
  const imageRatio = imageSize.width / imageSize.height
  const viewportRatio = viewportSize.width / viewportSize.height
  const rendered =
    imageRatio > viewportRatio
      ? { width: viewportSize.width, height: viewportSize.width / imageRatio, x: 0, y: (viewportSize.height - viewportSize.width / imageRatio) / 2 }
      : { width: viewportSize.height * imageRatio, height: viewportSize.height, x: (viewportSize.width - viewportSize.height * imageRatio) / 2, y: 0 }

  return {
    x: clamp(((point.x - rendered.x) / rendered.width) * imageSize.width, 0, imageSize.width),
    y: clamp(((point.y - rendered.y) / rendered.height) * imageSize.height, 0, imageSize.height),
  }
}

export function imageToViewportPoint(point: Vec2, imageSize: { width: number; height: number }, viewportSize: { width: number; height: number }): Vec2 {
  const imageRatio = imageSize.width / imageSize.height
  const viewportRatio = viewportSize.width / viewportSize.height
  const rendered =
    imageRatio > viewportRatio
      ? { width: viewportSize.width, height: viewportSize.width / imageRatio, x: 0, y: (viewportSize.height - viewportSize.width / imageRatio) / 2 }
      : { width: viewportSize.height * imageRatio, height: viewportSize.height, x: (viewportSize.width - viewportSize.height * imageRatio) / 2, y: 0 }

  return {
    x: rendered.x + (point.x / imageSize.width) * rendered.width,
    y: rendered.y + (point.y / imageSize.height) * rendered.height,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
