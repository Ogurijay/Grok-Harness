import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ModelInfo } from "../shared/types";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`model-effort-caret ${open ? "open" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 3.5 5 6.5 8 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pickEffort(model: ModelInfo | undefined, current: string): string | undefined {
  const efforts = model?.efforts ?? [];
  if (!efforts.length) return undefined;
  if (current && efforts.includes(current)) return current;
  if (model?.defaultEffort && efforts.includes(model.defaultEffort)) return model.defaultEffort;
  if (efforts.includes("high")) return "high";
  return efforts[efforts.length - 1];
}

export function ModelEffortPicker({
  models,
  modelId,
  effort,
  disabled,
  onChange,
}: {
  models: ModelInfo[];
  modelId?: string;
  effort?: string;
  disabled?: boolean;
  onChange: (modelId: string, effort?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | undefined>();
  const selected = models.find((model) => model.modelId === modelId) ?? models[0];
  const currentId = selected?.modelId ?? modelId ?? "";
  const efforts = selected?.efforts?.length ? selected.efforts : [];
  const currentEffort = effort && efforts.includes(effort) ? effort : pickEffort(selected, effort ?? "");
  const label = selected
    ? currentEffort
      ? `${selected.name} · ${currentEffort}`
      : selected.name
    : currentId || "模型";

  useLayoutEffect(() => {
    if (!open) {
      setBox(undefined);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = 300;
      const height = pop?.offsetHeight ?? 280;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const below = rect.bottom + 6;
      const above = rect.top - height - 6;
      const top =
        below + height > window.innerHeight - 8 && above > 8 ? Math.max(8, above) : Math.min(below, window.innerHeight - height - 8);
      setBox({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, models.length, currentId, efforts.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (triggerRef.current?.contains(node) || popRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseModel(nextId: string) {
    const model = models.find((item) => item.modelId === nextId);
    const nextEffort = pickEffort(model, currentEffort ?? "");
    onChange(nextId, nextEffort);
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`chip model-effort-chip ${open ? "open" : ""}`}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="模型和思考长度"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="model-effort-label">{label}</span>
        <Chevron open={open} />
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              className="model-effort-pop"
              role="dialog"
              aria-label="选择模型和思考长度"
              style={box ? { top: box.top, left: box.left, width: box.width } : { visibility: "hidden" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="model-effort-kicker">模型</div>
              <div className="model-effort-list">
                {models.length === 0 ? (
                  <div className="model-effort-empty">还没有可用模型</div>
                ) : (
                  models.map((model) => {
                    const active = model.modelId === currentId;
                    return (
                      <button
                        key={model.modelId}
                        className={active ? "active" : undefined}
                        type="button"
                        onClick={() => chooseModel(model.modelId)}
                      >
                        <strong>{model.name}</strong>
                        <span>{model.modelId}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {efforts.length > 0 ? (
                <div className="model-effort-thinking">
                  <div className="model-effort-kicker">思考长度</div>
                  <div className="effort-seg" role="radiogroup" aria-label="思考长度">
                    {efforts.map((item) => (
                      <button
                        key={item}
                        type="button"
                        role="radio"
                        aria-checked={item === currentEffort}
                        className={item === currentEffort ? "on" : undefined}
                        onClick={() => {
                          if (!currentId) return;
                          onChange(currentId, item);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
