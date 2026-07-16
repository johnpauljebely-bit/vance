import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, TASK_BOARD_COLUMNS } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function AdminTaskBoard() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", "TaskBoard"],
    queryFn: () => adminApi.listOrders(),
    refetchInterval: 10000,
  });

  const move = useMutation({
    mutationFn: ({ id, status }) => adminApi.updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Move failed"),
  });

  const grouped = TASK_BOARD_COLUMNS.reduce((acc, col) => {
    acc[col] = orders.filter((o) => o.status === col);
    return acc;
  }, {});

  return (
    <div data-testid="admin-taskboard-page" className="space-y-6">
      <p className="text-sm text-[#8A8588] max-w-2xl">
        Move accepted orders through each stage. Full drag-and-drop ships in the
        next iteration — for now, use the arrows to advance or step back.
      </p>

      {isLoading ? (
        <p className="text-sm text-[#8A8588]">Loading…</p>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
          data-testid="taskboard-columns"
        >
          {TASK_BOARD_COLUMNS.map((col, colIdx) => (
            <div
              key={col}
              data-testid={`taskboard-column-${col.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
              className="rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-white p-3 min-h-[240px]"
            >
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-bold uppercase tracking-widest">
                  {col.replace("Delivered – ", "Del. ")}
                </p>
                <span className="rounded-full bg-[#F7F5F2] px-2 py-0.5 text-[10px] font-bold text-[#8A8588] tabular-nums">
                  {grouped[col].length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {grouped[col].length === 0 ? (
                  <p className="text-xs text-[#8A8588] italic px-2 py-8 text-center">
                    Empty
                  </p>
                ) : (
                  grouped[col].map((o) => (
                    <div
                      key={o.id}
                      data-testid={`taskcard-${o.id}`}
                      className="rounded-[12px] border border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] p-3 hover:border-[#1A1A1A] transition-colors"
                    >
                      <p className="text-sm font-bold truncate">{o.client_name}</p>
                      <p className="text-xs text-[#8A8588] truncate">
                        {o.commission_type}
                      </p>
                      <div className="mt-2">
                        <StatusPill status={o.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          disabled={colIdx === 0 || move.isPending}
                          onClick={() =>
                            move.mutate({
                              id: o.id,
                              status: TASK_BOARD_COLUMNS[colIdx - 1],
                            })
                          }
                          data-testid={`taskcard-back-${o.id}`}
                          className="flex-1 flex items-center justify-center gap-1 rounded-[8px] border border-[rgba(26,26,26,0.1)] px-2 py-1 text-[10px] font-bold text-[#1A1A1A] hover:bg-white disabled:opacity-40"
                          aria-label="Move back"
                        >
                          <ArrowLeft size={12} /> Back
                        </button>
                        <button
                          type="button"
                          disabled={
                            colIdx === TASK_BOARD_COLUMNS.length - 1 || move.isPending
                          }
                          onClick={() =>
                            move.mutate({
                              id: o.id,
                              status: TASK_BOARD_COLUMNS[colIdx + 1],
                            })
                          }
                          data-testid={`taskcard-next-${o.id}`}
                          className="flex-1 flex items-center justify-center gap-1 rounded-[8px] bg-[#FF6B35] px-2 py-1 text-[10px] font-bold text-white hover:brightness-95 disabled:opacity-40"
                          aria-label="Move forward"
                        >
                          Next <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
