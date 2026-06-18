import { GameViewport, useGameLocalStorage, type GameStorageRecord } from "@internal/engine"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { exampleGame, exampleGameEffects } from "./game.ts"
import { exampleGameConfig } from "./config.ts"
import "./styles.css"

export function ExampleGameApp() {
  const storage = useGameLocalStorage()
  const labelsStorage = useMemo(() => storage.collection("labels"), [storage])
  const [labels, setLabels] = useState<ReadonlyArray<GameStorageRecord>>([])
  const [value, setValue] = useState("")
  const [fovDegrees, setFovDegrees] = useState(exampleGameEffects.fovDegrees)
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading")

  useEffect(() => {
    let active = true
    labelsStorage.list().then(
      (storedLabels) => {
        if (!active) return
        setLabels(storedLabels)
        setStatus("ready")
      },
      () => {
        if (active) setStatus("error")
      },
    )
    return () => {
      active = false
    }
  }, [labelsStorage])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = value.trim()
    if (!label || status === "saving") return

    setStatus("saving")
    labelsStorage.append(label).then(
      (entry) => {
        setLabels((current) => [...current, entry])
        setValue("")
        setStatus("ready")
      },
      () => setStatus("error"),
    )
  }

  const updateFov = (nextFov: number) => {
    exampleGameEffects.fovDegrees = nextFov
    setFovDegrees(nextFov)
  }

  return (
    <main className="example-game">
      <GameViewport className="example-game__viewport" game={exampleGame} />
      <section className="example-game__hud" aria-label="Example game details">
        <p className="example-game__eyebrow">Internal Game Engine</p>
        <h1>{exampleGameConfig.title}</h1>
        <p>Stationary model preview with ordered engine preprocess and postprocess effects.</p>
        <dl>
          <div>
            <dt>Camera</dt>
            <dd>Stationary</dd>
          </div>
          <div>
            <dt>Preprocess</dt>
            <dd>Shader, animation</dd>
          </div>
          <div>
            <dt>Postprocess</dt>
            <dd>FOV</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>Female idle</dd>
          </div>
        </dl>
        <section className="example-game__controls" aria-label="Render controls">
          <label htmlFor="fov-control">
            <span>FOV</span>
            <output htmlFor="fov-control">{fovDegrees}°</output>
          </label>
          <input
            id="fov-control"
            max={95}
            min={35}
            onChange={(event) => updateFov(Number(event.currentTarget.value))}
            step={1}
            type="range"
            value={fovDegrees}
          />
        </section>
        <form className="example-game__labels" onSubmit={submit}>
          <label htmlFor="persistent-label">Persistent label</label>
          <input
            autoComplete="off"
            id="persistent-label"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type a label and press Enter"
            value={value}
          />
          <p className="example-game__storage-status">
            {status === "loading" && "Loading saved labels..."}
            {status === "saving" && "Saving..."}
            {status === "error" && "Storage unavailable"}
            {status === "ready" && `${labels.length} saved label${labels.length === 1 ? "" : "s"}`}
          </p>
          <div className="example-game__label-list" aria-live="polite">
            {labels.map((label) => (
              <span key={label.id}>{label.value}</span>
            ))}
          </div>
        </form>
      </section>
    </main>
  )
}
