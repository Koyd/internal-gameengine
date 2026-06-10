import { GameViewport, useGameLocalStorage, type GameStorageRecord } from "@internal/engine"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { exampleGame } from "./game.ts"
import { exampleGameConfig } from "./config.ts"
import "./styles.css"

export function ExampleGameApp() {
  const storage = useGameLocalStorage()
  const labelsStorage = useMemo(() => storage.collection("labels"), [storage])
  const [labels, setLabels] = useState<ReadonlyArray<GameStorageRecord>>([])
  const [value, setValue] = useState("")
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

  return (
    <main className="example-game">
      <GameViewport className="example-game__viewport" game={exampleGame} />
      <section className="example-game__hud" aria-label="Example game details">
        <p className="example-game__eyebrow">Internal Game Engine</p>
        <h1>{exampleGameConfig.title}</h1>
        <p>Camera orbit and cube translation run as framebuffer-bound preprocesses.</p>
        <dl>
          <div>
            <dt>Camera</dt>
            <dd>Orbiting</dd>
          </div>
          <div>
            <dt>Cube</dt>
            <dd>Translating</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>Engine framebuffer</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>Runtime-cached Adam head</dd>
          </div>
        </dl>
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
