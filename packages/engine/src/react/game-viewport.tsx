import { PerspectiveCamera } from "@internal/three"
import { useEffect, useRef } from "react"
import type { Game } from "../game.ts"
import { useGameAssets } from "./game-assets.tsx"
import { FramePipeline } from "../rendering/frame-pipeline.ts"

export interface GameViewportProps {
  readonly className?: string
  readonly game: Game
}

export function GameViewport({ className, game }: GameViewportProps) {
  const assets = useGameAssets()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const world = game.createWorld({ assets })
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
  }, [assets, game])

  return <canvas className={className} ref={canvasRef} />
}
