import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, publicApi, ORDER_STATUSES } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, Upload, CheckCircle2, XCircle } from "lucide-react";
import FileDropzone from "@/components/site/FileDropzone";
import AnnotationCanvas from "@/components/site/AnnotationCanvas";

const ANNOTATABLE_STATUSES = new Set(["Final Review", "Delivered – Awaiting Review"]);

export default function AdminOrders() {
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => adminApi.listOrders(filter),
    refetchInterval: 6000,
  });

  return (
    <div data-testid="admin-orders-page" className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" data-testid="orders-tabs">
        <FilterBtn cur={filter} val="All" onClick={setFilter} />
        {ORDER_STATUSES.map((s) => (
          <FilterBtn key={s} cur={filter} val={s} onClick={setFilter} />
        ))}
      </div>

      <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-sm text-[#8A8588]">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#8A8588]">
              No orders yet
            </p>
            <p className="mt-2 text-[#1A1A1A]/70">
              Accept a commission request from the inbox — an order will be auto-created.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="orders-table">
            <thead className="bg-[#F7F5F2] text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
              <tr>
                <th className="text-left px-6 py-3">Client</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Payment</th>
                <th className="text-left px-6 py-3">Updated</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(26,26,26,0.06)]">
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr
                    data-testid={`order-row-${o.id}`}
                    className="hover:bg-[#F7F5F2] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold">{o.client_name}</p>
                      <p className="text-xs text-[#8A8588]">{o.client_email}</p>
                    </td>
                    <td className="px-6 py-4 text-[#1A1A1A]/80">{o.commission_type}</td>
                    <td className="px-6 py-4">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-6 py-4 text-[#1A1A1A]/80">
                      {o.payment_confirmation_requested ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-pill bg-[#6B7280]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6B7280]"
                          data-testid={`payment-pending-pill-${o.id}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#6B7280]" />
                          Awaiting confirmation · {o.payment_confirmation_requested.method}
                        </span>
                      ) : (
                        o.payment_status || "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#8A8588] tabular-nums">
                      {new Date(o.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-[#8A8588]">
                      {expandedId === o.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  {expandedId === o.id && (
                    <tr>
                      <td colSpan={6} className="bg-[#F7F5F2] px-6 py-5">
                        <OrderDetailPanel order={o} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OrderDetailPanel({ order }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(order.quoted_price ?? "");
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [darkAccent, setDarkAccent] = useState(order.accent_color_dark ?? "");
  const [lightAccent, setLightAccent] = useState(order.accent_color_light ?? "");
  const [deadline, setDeadline] = useState(order.deadline ?? "");
  const [closingOpen, setClosingOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });

  const closeOrder = useMutation({
    mutationFn: () => adminApi.closeOrder(order.id, closeReason.trim()),
    onSuccess: () => {
      toast.success("Order closed — client notified by email");
      setClosingOpen(false);
      setCloseReason("");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to close order"),
  });

  const updateStatus = useMutation({
    mutationFn: (status) => adminApi.updateOrderStatus(order.id, status),
    onSuccess: () => {
      toast.success("Status updated — client notified by email");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to update status"),
  });

  const savePrice = useMutation({
    mutationFn: () => adminApi.updateOrderPricing(order.id, parseFloat(price)),
    onSuccess: () => {
      toast.success("Price saved");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save price"),
  });

  const setLogo = useMutation({
    mutationFn: (url) => adminApi.updateDeliveredLogo(order.id, url),
    onSuccess: () => {
      toast.success("Delivered logo attached");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to attach logo"),
  });

  const saveDeadline = useMutation({
    mutationFn: () => adminApi.updateDeadline(order.id, deadline || null),
    onSuccess: () => {
      toast.success("Deadline saved");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save deadline"),
  });

  const saveAccentColors = useMutation({
    mutationFn: () => adminApi.updateAccentColors(order.id, darkAccent.trim() || null, lightAccent.trim() || null),
    onSuccess: () => {
      toast.success("Accent colors saved");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save accent colors"),
  });

  const confirmPayment = useMutation({
    mutationFn: () =>
      adminApi.confirmPayment(
        order.id,
        order.payment_confirmation_requested?.stage || (order.deposit_paid ? "final" : "deposit"),
        order.payment_confirmation_requested?.method || "manual"
      ),
    onSuccess: () => {
      toast.success("Payment confirmed");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to confirm"),
  });

  const uploadLogo = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const result = await publicApi.uploadReference(file);
      setLogo.mutate(result.url);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={`order-detail-${order.id}`}>
      <div className="mb-5" onClick={(e) => e.stopPropagation()}>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Order status
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <select
            value={order.status}
            onChange={(e) => updateStatus.mutate(e.target.value)}
            disabled={updateStatus.isPending}
            data-testid={`order-status-select-${order.id}`}
            className="input-base max-w-xs"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {updateStatus.isPending && <Loader2 size={14} className="animate-spin text-[#8A8588]" />}
        </div>
        <p className="mt-1 text-[10px] text-[#8A8588]">
          Every change logs to the order activity and emails the client automatically.
        </p>
      </div>

      {order.status !== "Closed" && (
        <div className="mb-5" onClick={(e) => e.stopPropagation()}>
          {!closingOpen ? (
            <button
              type="button"
              onClick={() => setClosingOpen(true)}
              data-testid={`order-close-btn-${order.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] hover:underline"
            >
              <XCircle size={14} /> Close order
            </button>
          ) : (
            <div className="rounded-[14px] border border-[#EF4444]/30 bg-[#EF4444]/5 p-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
                Close order — reason (sent to client)
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                data-testid={`order-close-reason-${order.id}`}
                className="input-base mt-1.5 resize-y"
                rows={2}
                placeholder="e.g. Project cancelled at client's request, refund issued."
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => closeOrder.mutate()}
                  disabled={closeOrder.isPending}
                  data-testid={`order-close-confirm-${order.id}`}
                  className="rounded-pill bg-[#EF4444] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {closeOrder.isPending ? <Loader2 size={13} className="animate-spin" /> : "Confirm close"}
                </button>
                <button
                  type="button"
                  onClick={() => setClosingOpen(false)}
                  data-testid={`order-close-cancel-${order.id}`}
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Quoted price (USD)
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid={`order-price-input-${order.id}`}
            className="input-base"
            placeholder="e.g. 500"
          />
          <button
            type="button"
            onClick={() => savePrice.mutate()}
            disabled={!price || savePrice.isPending}
            data-testid={`order-price-save-${order.id}`}
            className="btn-secondary shrink-0 !px-4"
          >
            {savePrice.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[#8A8588]">
          Deposit and final payment are each 50% of this.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Deadline
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            data-testid={`order-deadline-input-${order.id}`}
            className="input-base"
          />
          <button
            type="button"
            onClick={() => saveDeadline.mutate()}
            disabled={saveDeadline.isPending}
            data-testid={`order-deadline-save-${order.id}`}
            className="btn-secondary shrink-0 !px-4"
          >
            {saveDeadline.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[#8A8588]">Shows up on the Calendar tab, color-coded by urgency.</p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Delivered logo
        </label>
        {order.delivered_logo_url ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[#22C55E] font-semibold">
            <CheckCircle2 size={14} /> Attached — used for Brand Kit
          </div>
        ) : (
          <FileDropzone
            testId={`order-logo-upload-${order.id}`}
            accept="image/*"
            onFiles={uploadLogo}
            className="mt-1.5 flex items-center gap-2 rounded-[10px] border-2 border-dashed border-[rgba(26,26,26,0.2)] bg-white px-3 py-2.5 text-xs transition-colors hover:border-[#FF6B35]"
            activeClassName="border-[#FF6B35]"
          >
            <Upload size={14} className="text-[#8A8588]" />
            {uploading ? "Uploading…" : "Upload final logo"}
          </FileDropzone>
        )}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Brand kit accent colors
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={darkAccent || "#1A1A1A"}
              onChange={(e) => setDarkAccent(e.target.value)}
              data-testid={`order-accent-dark-${order.id}`}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-[8px] border border-[rgba(26,26,26,0.15)]"
              title="Dark accent"
            />
            <input
              type="color"
              value={lightAccent || "#FFFFFF"}
              onChange={(e) => setLightAccent(e.target.value)}
              data-testid={`order-accent-light-${order.id}`}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-[8px] border border-[rgba(26,26,26,0.15)]"
              title="Light accent"
            />
          </div>
          <button
            type="button"
            onClick={() => saveAccentColors.mutate()}
            disabled={saveAccentColors.isPending}
            data-testid={`order-accent-save-${order.id}`}
            className="btn-secondary shrink-0 !px-3 text-xs"
          >
            {saveAccentColors.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-[#8A8588]">
          Used for the dark/light-background logo variants in the Brand Kit.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Payment
        </label>
        {order.payment_confirmation_requested ? (
          <div className="mt-1.5">
            <p className="text-xs text-[#1A1A1A]/80">
              Client marked {order.payment_confirmation_requested.stage} paid via{" "}
              {order.payment_confirmation_requested.method}.
            </p>
            <button
              type="button"
              onClick={() => confirmPayment.mutate()}
              disabled={confirmPayment.isPending}
              data-testid={`order-confirm-payment-${order.id}`}
              className="btn-primary mt-2 !py-1.5 !px-3 text-xs"
            >
              {confirmPayment.isPending ? "Confirming…" : "Confirm payment"}
            </button>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-[#8A8588]">
            Deposit: {order.deposit_paid ? "Paid" : "Pending"} · Final: {order.final_paid ? "Paid" : "Pending"}
          </p>
        )}
      </div>
      </div>

      {order.delivered_logo_url && ANNOTATABLE_STATUSES.has(order.status) && (
        <AdminAnnotationsSection orderId={order.id} imageUrl={order.delivered_logo_url} />
      )}
    </div>
  );
}

function AdminAnnotationsSection({ orderId, imageUrl }) {
  const qc = useQueryClient();
  const { data: annotations = [] } = useQuery({
    queryKey: ["admin-annotations", orderId],
    queryFn: () => adminApi.listAnnotations(orderId),
    refetchInterval: 6000,
  });

  const deletePin = useMutation({
    mutationFn: (annotationId) => adminApi.deleteAnnotation(orderId, annotationId),
    onSuccess: () => {
      toast.success("Pin cleared");
      qc.invalidateQueries({ queryKey: ["admin-annotations", orderId] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to delete"),
  });

  if (annotations.length === 0) return null;

  return (
    <div className="mt-5 border-t border-[rgba(26,26,26,0.06)] pt-5" onClick={(e) => e.stopPropagation()}>
      <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
        Client revision pins ({annotations.length})
      </label>
      <div className="mt-2 max-w-lg">
        <AnnotationCanvas
          imageUrl={imageUrl}
          annotations={annotations}
          interactive={false}
          onDeletePin={(id) => deletePin.mutate(id)}
        />
      </div>
    </div>
  );
}

function FilterBtn({ cur, val, onClick }) {
  const active = cur === val;
  return (
    <button
      type="button"
      onClick={() => onClick(val)}
      data-testid={`orders-filter-${val.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
      className={`rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[#1A1A1A] text-white"
          : "bg-white border border-[rgba(26,26,26,0.1)] text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
      }`}
    >
      {val === "All"
        ? "All"
        : val.length > 22
        ? val.replace("Delivered – ", "Del. ").replace("Awaiting ", "")
        : val}
    </button>
  );
}
