import type { PlaneSpec, Vec3 } from './types'

export function planeSurfaceNormal(plane: PlaneSpec): Vec3 {
  return roundVec3(normalizeVec3(rotateVec3({ x: 0, y: 0, z: 1 }, plane.rotation), { x: 0, y: 1, z: 0 }))
}

export function worldToPlaneLocal(point: Vec3, plane: PlaneSpec): Vec3 {
  return inverseRotateVec3(subtractVec3(point, plane.position), plane.rotation)
}

export function planeLocalToWorld(point: Vec3, plane: PlaneSpec): Vec3 {
  return addVec3(plane.position, rotateVec3(point, plane.rotation))
}

export function rotateVec3(vector: Vec3, rotation: Vec3): Vec3 {
  return rotateZ(rotateY(rotateX(vector, rotation.x), rotation.y), rotation.z)
}

export function inverseRotateVec3(vector: Vec3, rotation: Vec3): Vec3 {
  return rotateX(rotateY(rotateZ(vector, -rotation.z), -rotation.y), -rotation.x)
}

export function normalizeVec3(vector: Vec3, fallback: Vec3): Vec3 {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  if (length <= 0.000001) return fallback
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  }
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function scaleVec3(vector: Vec3, value: number): Vec3 {
  return { x: vector.x * value, y: vector.y * value, z: vector.z * value }
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function roundVec3(vector: Vec3): Vec3 {
  return {
    x: roundNumber(vector.x),
    y: roundNumber(vector.y),
    z: roundNumber(vector.z),
  }
}

export function roundNumber(value: number) {
  const rounded = Number(value.toFixed(6))
  return Object.is(rounded, -0) ? 0 : rounded
}

function rotateX(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x,
    y: vector.y * cos - vector.z * sin,
    z: vector.y * sin + vector.z * cos,
  }
}

function rotateY(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x * cos + vector.z * sin,
    y: vector.y,
    z: -vector.x * sin + vector.z * cos,
  }
}

function rotateZ(vector: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
    z: vector.z,
  }
}
