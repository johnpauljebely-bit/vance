import { useCallback, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const MIN_SIZE = 0.04;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// Canva/Photoshop-style layer editor: click to place, drag to move, drag
// corners/edges to resize. Multiple independent watermark instances, each
// {x_pct, y_pct, w_pct, h_pct} relative to the canvas image. Opacity is a
// single global control (passed in, rendered by the parent) — position and
// size are the only per-instance, fully-manual controls.
export default function WatermarkCanvasEditor({
  backgroundUrl,
  watermarkUrl,
  opacity,
  instances,
  onChange,
}) {
  const containerRef = useRef(null);
  const [selected, setSelected] = useState(instances.length ? 0 : null);
  const dragRef = useRef(null); // { mode: 'move'|'resize', index, handle, startX, startY, orig }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const updateInstance = (index, patch) => {
    onChange(instances.map((inst, i) => (i === index ? { ...inst, ...patch } : inst)));
  };

  const addInstance = () => {
    const next = [...instances, { x_pct: 0.3, y_pct: 0.3, w_pct: 0.3, h_pct: 0.3 }];
    onChange(next);
    setSelected(next.length - 1);
  };

  const removeInstance = (index) => {
    const next = instances.filter((_, i) => i !== index);
    onChange(next);
    setSelected(null);
  };

  const getRect = () => containerRef.current.getBoundingClientRect();

  const onPointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = getRect();
      const dxPct = (e.clientX - drag.startX) / rect.width;
      const dyPct = (e.clientY - drag.startY) / rect.height;
      const o = drag.orig;

      if (drag.mode === "move") {
        updateInstance(drag.index, {
          x_pct: clamp01(Math.min(1 - o.w_pct, Math.max(0, o.x_pct + dxPct))),
          y_pct: clamp01(Math.min(1 - o.h_pct, Math.max(0, o.y_pct + dyPct))),
        });
        return;
      }

      // resize
      let { x_pct, y_pct, w_pct, h_pct } = o;
      const h = drag.handle;
      if (h.includes("e")) w_pct = Math.max(MIN_SIZE, Math.min(1 - o.x_pct, o.w_pct + dxPct));
      if (h.includes("s")) h_pct = Math.max(MIN_SIZE, Math.min(1 - o.y_pct, o.h_pct + dyPct));
      if (h.includes("w")) {
        const newW = Math.max(MIN_SIZE, o.w_pct - dxPct);
        x_pct = Math.max(0, o.x_pct + o.w_pct - newW);
        w_pct = o.x_pct + o.w_pct - x_pct;
      }
      if (h.includes("n")) {
        const newH = Math.max(MIN_SIZE, o.h_pct - dyPct);
        y_pct = Math.max(0, o.y_pct + o.h_pct - newH);
        h_pct = o.y_pct + o.h_pct - y_pct;
      }
      updateInstance(drag.index, { x_pct, y_pct, w_pct, h_pct });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instances]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove]);

  const startDrag = (e, index, mode, handle = null) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(index);
    dragRef.current = {
      mode,
      index,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...instances[index] },
    };
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
  };

  const handleCursor = (h) => {
    if (h === "n" || h === "s") return "ns-resize";
    if (h === "e" || h === "w") return "ew-resize";
    if (h === "ne" || h === "sw") return "nesw-resize";
    return "nwse-resize";
  };

  const handlePos = (h) => {
    const pos = { top: "50%", left: "50%" };
    if (h.includes("n")) pos.top = "0%";
    if (h.includes("s")) pos.top = "100%";
    if (h.includes("w")) pos.left = "0%";
    if (h.includes("e")) pos.left = "100%";
    return pos;
  };

  return (
    <div>
      <div
        ref={containerRef}
        data-testid="watermark-canvas"
        onClick={() => setSelected(null)}
        className="relative w-full aspect-square overflow-hidden rounded-[12px] border border-[rgba(26,26,26,0.1)] bg-[repeating-conic-gradient(#e8e5e0_0%_25%,white_0%_50%)] bg-[length:20px_20px]"
      >
        {backgroundUrl && (
          <img
            src={backgroundUrl}
            alt="Preview background"
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            draggable={false}
          />
        )}

        {instances.map((inst, i) => (
          <div
            key={i}
            data-testid={`watermark-instance-${i}`}
            onMouseDown={(e) => startDrag(e, i, "move")}
            className={`absolute cursor-move select-none ${
              selected === i ? "outline outline-2 outline-[#0201FC]" : "outline outline-1 outline-white/50 hover:outline-[#0201FC]/60"
            }`}
            style={{
              left: `${inst.x_pct * 100}%`,
              top: `${inst.y_pct * 100}%`,
              width: `${inst.w_pct * 100}%`,
              height: `${inst.h_pct * 100}%`,
            }}
          >
            {watermarkUrl && (
              <img
                src={watermarkUrl}
                alt={`Watermark ${i + 1}`}
                className="h-full w-full object-contain pointer-events-none"
                style={{ opacity }}
                draggable={false}
              />
            )}

            {selected === i && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeInstance(i);
                  }}
                  data-testid={`watermark-instance-${i}-remove`}
                  aria-label="Remove watermark layer"
                  className="absolute -top-3 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#EF4444] text-white shadow"
                >
                  <Trash2 size={12} />
                </button>
                {HANDLES.map((h) => (
                  <div
                    key={h}
                    onMouseDown={(e) => startDrag(e, i, "resize", h)}
                    style={{ ...handlePos(h), cursor: handleCursor(h) }}
                    className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0201FC] bg-white"
                  />
                ))}
              </>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addInstance}
        data-testid="watermark-add-instance"
        className="btn-secondary mt-3 w-full"
      >
        <Plus size={16} /> Add watermark layer
      </button>
      <p className="mt-2 text-xs text-[#8A8588]">
        Click a layer to select it, drag to move, drag a handle to resize. Add as many independent layers as you need.
      </p>
    </div>
  );
}
