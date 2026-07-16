import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { AlertTriangle, Boxes } from 'lucide-react'
import { Component, Suspense, useLayoutEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Object3D, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { resolveComponentAssetSource } from '../../domain/scene/componentAssets'
import { buildComponentRenderableBox, prepareComponentGltfScene } from './componentGltfMaterials'

type ComponentAssetThumbnailProps = {
  assetKey?: string
  assetUrl?: string
  color: string
  label: string
}

export function ComponentAssetThumbnail({ assetKey, assetUrl, color, label }: ComponentAssetThumbnailProps) {
  const assetSource = resolveComponentAssetSource(assetKey, assetUrl)
  if (!assetSource) {
    return (
      <div className="asset-thumbnail asset-thumbnail-empty" style={{ '--asset-color': color } as CSSProperties} aria-label={`${label} 无模型预览`}>
        <Boxes size={18} />
      </div>
    )
  }

  return (
    <AssetThumbnailErrorBoundary
      resetKey={assetSource.url}
      fallback={
        <div className="asset-thumbnail asset-thumbnail-error" aria-label={`${label} 模型加载失败`}>
          <AlertTriangle size={16} />
          <span>失败</span>
        </div>
      }
    >
      <div className="asset-thumbnail" aria-label={`${label} 模型预览`}>
        <Canvas camera={{ position: [0.72, 0.64, 1.25], fov: 32 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} frameloop="always">
          <ThumbnailCamera />
          <ambientLight intensity={1.8} />
          <directionalLight position={[2, 3, 4]} intensity={1.4} />
          <Suspense fallback={<ThumbnailLoadingMesh color={color} />}>
            <ThumbnailModel url={assetSource.url} />
          </Suspense>
        </Canvas>
        <span className="asset-thumbnail-badge">{assetSource.source === 'builtin' ? '内置' : '外部'}</span>
      </div>
    </AssetThumbnailErrorBoundary>
  )
}

function ThumbnailCamera() {
  const { camera } = useThree()
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

function ThumbnailModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url)
  const { scene, scale, offset } = useMemo(() => normalizePreviewScene(gltf.scene), [gltf.scene])

  return (
    <group rotation={[0.08, -0.38, 0]}>
      <primitive object={scene} position={[offset.x, offset.y, offset.z]} scale={[scale, scale, scale]} />
    </group>
  )
}

function ThumbnailLoadingMesh({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[0.42, 0.28, 0.26]} />
      <meshStandardMaterial color={color} transparent opacity={0.38} roughness={0.8} />
    </mesh>
  )
}

function normalizePreviewScene(sourceScene: Object3D) {
  const scene = sourceScene.clone(true)
  prepareComponentGltfScene(scene)

  const box = buildComponentRenderableBox(scene)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
  const scale = 0.88 / maxDimension

  return {
    scene,
    scale,
    offset: {
      x: -center.x * scale,
      y: -center.y * scale,
      z: -center.z * scale,
    },
  }
}

type AssetThumbnailErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
  resetKey: string
}

class AssetThumbnailErrorBoundary extends Component<AssetThumbnailErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps: AssetThumbnailErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
