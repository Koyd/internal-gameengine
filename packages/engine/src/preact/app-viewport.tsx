import { PerspectiveCamera } from "@framework/three"
import { useEffect, useRef } from "preact/hooks"
import type { App } from "../app.ts"
import { useAppAssets } from "./app-assets.tsx"
import { FramePipeline } from "../rendering/frame-pipeline.ts"

export interface AppViewportProps {
  readonly className?: string
  readonly app: App
}

export function AppViewport({ className, app }: AppViewportProps) {
  const assets = useAppAssets()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const world = app.createWorld({ assets })
    const pipeline = new FramePipeline({ canvas, ...world })

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (world.camera instanceof PerspectiveCamera) {
        world.camera.aspect = width / Math.max(1, height)
        world.camera.updateProjectionMatrix()
      }
      pipeline.resize(width, height)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    pipeline.start()

    return () => {
      observer.disconnect()
      pipeline.dispose()
    }
  }, [assets, app])

  return <canvas className={className} ref={canvasRef} />
}
