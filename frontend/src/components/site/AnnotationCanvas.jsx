import { useRef, useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";

/**
 * Shared click-to-pin revision annotation tool. Used read/write on the
 * client portal (drop pins) and read-only (+ optional delete) on the admin
 * side, so feedback is visually anchored to the exact same image/coords
 * on both sides.
 */
export default function AnnotationCanvas({
  imageUrl,
  annotations,
  interactive = false,
  onAddPin,
  onDeletePin,
  adding = false,
}) {
  const imgRef = useRef(null);
  const [pendingPct, setPendingPct] = useState(null);
  const [comment, setComment] = useState("");

  const handleClick = (e) => {
    if (!interactive || pendingPct) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x_pct = (e.clientX - rect.left) / rect.width;
    const y_pct = (e.clientY - rect.top) / rect.height;
    setPendingPct({ x_pct, y_pct });
    setComment("");
  };

  const submitPin = () => {
    if (!comment.trim() || !pendingPct) return;
    onAddPin({ ...pendingPct, comment: comment.trim() });
    setPendingPct(null);
    setComment("");
  };

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] ${
          interactive ? "cursor-crosshair" : ""
        }`}
        data-testid="annotation-canvas"
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Delivered preview"
          onClick={handleClick}
          className="block w-full select-none"
          draggable={false}
        />
        {annotations.map((a, i) => (
          <div
            key={a.id}
            data-testid={`annotation-pin-${a.id}`}
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#FF6B35] text-[11px] font-bold text-white shadow-md"
            style={{ left: `${a.x_pct * 100}%`, top: `${a.y_pct * 100}%` }}
            title={a.comment}
          >
            {i + 1}
          </div>
        ))}
        {pendingPct && (
          <div
            className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#1A1A1A] text-[11px] font-bold text-white shadow-md"
            style={{ left: `${pendingPct.x_pct * 100}%`, top: `${pendingPct.y_pct * 100}%` }}
          >
            {annotations.length + 1}
          </div>
        )}
      </div>

      {pendingPct && (
        <div className="mt-3 rounded-[12px] border-2 border-[#FF6B35]/30 bg-white p-3" data-testid="annotation-pin-form">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What would you like changed here?"
            rows={2}
            autoFocus
            data-testid="annotation-comment-input"
            className="input-base resize-y text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={submitPin}
              disabled={!comment.trim() || adding}
              data-testid="annotation-submit-btn"
              className="btn-primary !px-3 !py-1.5 text-xs"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : "Drop pin"}
            </button>
            <button
              type="button"
              onClick={() => setPendingPct(null)}
              data-testid="annotation-cancel-btn"
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {interactive && !pendingPct && (
        <p className="mt-2 text-xs text-[#8A8588]">Click anywhere on the image to leave feedback at that spot.</p>
      )}

      {annotations.length > 0 && (
        <div className="mt-4 space-y-2">
          {annotations.map((a, i) => (
            <div
              key={a.id}
              data-testid={`annotation-comment-${a.id}`}
              className="flex items-start gap-3 rounded-[10px] bg-[#F7F5F2] px-3 py-2 text-sm"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <p>{a.comment}</p>
                <p className="mt-0.5 text-[10px] text-[#8A8588]">{new Date(a.created_at).toLocaleString()}</p>
              </div>
              {onDeletePin && (
                <button
                  type="button"
                  onClick={() => onDeletePin(a.id)}
                  data-testid={`annotation-delete-${a.id}`}
                  className="shrink-0 rounded-full p-1 text-[#8A8588] hover:bg-red-50 hover:text-[#EF4444]"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
