import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, adminMsgApi, publicApi } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { MessageBubble } from "@/pages/portal/ClientPortalOrder";
import { toast } from "sonner";
import { Send, Loader2, Search, Package, Upload, X } from "lucide-react";
import FileDropzone from "@/components/site/FileDropzone";

export default function AdminMessages() {
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", "messages"],
    queryFn: () => adminApi.listOrders(),
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        !q ||
        o.client_name?.toLowerCase().includes(q) ||
        o.client_email?.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const selected = filtered.find((o) => o.id === selectedId) || filtered[0];

  return (
    <div
      data-testid="admin-messages-page"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-11rem)]"
    >
      <aside className="lg:col-span-4 rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white flex flex-col min-h-[400px]">
        <div className="p-3 border-b border-[rgba(26,26,26,0.06)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8588]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders…"
              data-testid="messages-search"
              className="w-full rounded-[10px] border border-[rgba(26,26,26,0.1)] bg-[#F7F5F2] pl-9 pr-3 py-2 text-sm outline-none focus:border-[#FF6B35]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="messages-order-list">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#8A8588]">
              No orders yet — accept a request to start a thread.
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                data-testid={`messages-order-${o.id}`}
                className={`w-full text-left px-4 py-3 border-b border-[rgba(26,26,26,0.05)] transition-colors ${
                  selected?.id === o.id ? "bg-[#FF6B35]/5" : "hover:bg-[#F7F5F2]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{o.client_name}</p>
                    <p className="text-xs text-[#8A8588] truncate">{o.commission_type}</p>
                  </div>
                  <StatusPill status={o.status} />
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className="lg:col-span-8 rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden flex flex-col min-h-[400px]"
        data-testid="messages-thread"
      >
        {selected ? (
          <MessageThread order={selected} />
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-[#8A8588]">
            Select an order to view its messages.
          </div>
        )}
      </section>
    </div>
  );
}

function SendKitPanel({ order, onClose, onSent }) {
  const [logoUrl, setLogoUrl] = useState(order.delivered_logo_url || null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("Here's your brand kit!");

  const uploadLogo = async (files) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    try {
      const result = await publicApi.uploadReference(file);
      setLogoUrl(result.url);
    } catch {
      toast.error("Logo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const send = useMutation({
    mutationFn: () => adminApi.sendKit(order.id, { delivered_logo_url: logoUrl, message }),
    onSuccess: () => {
      toast.success("Brand kit sent");
      onSent();
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to send kit"),
  });

  return (
    <div className="border-b border-[rgba(26,26,26,0.08)] bg-[#F7F5F2] p-4" data-testid="send-kit-panel">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Send Brand Kit
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[#8A8588] hover:text-[#1A1A1A]">
          <X size={16} />
        </button>
      </div>

      {!logoUrl ? (
        <FileDropzone
          testId="send-kit-logo-upload"
          accept="image/*"
          onFiles={uploadLogo}
          className="mt-3 flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[rgba(26,26,26,0.2)] bg-white px-6 py-6 text-center transition-colors hover:border-[#FF6B35] hover:bg-[#FF6B35]/5"
          activeClassName="border-[#FF6B35] bg-[#FF6B35]/5"
        >
          <Upload size={20} className="text-[#8A8588]" />
          <p className="mt-2 text-sm font-semibold">
            {uploading ? "Uploading…" : "Upload the final logo"}
          </p>
        </FileDropzone>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          {logoPreview && <img src={logoPreview} alt="" className="h-12 w-12 rounded-[8px] object-contain bg-white border border-[rgba(26,26,26,0.08)]" />}
          <p className="text-xs text-[#8A8588]">Logo attached ✓</p>
        </div>
      )}

      <div className="mt-3">
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          data-testid="send-kit-message"
          className="input-base mt-1.5"
        />
      </div>

      <button
        type="button"
        onClick={() => send.mutate()}
        disabled={!logoUrl || uploading || send.isPending}
        data-testid="send-kit-confirm-btn"
        className="btn-primary mt-3"
      >
        {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
        Generate &amp; send kit
      </button>
    </div>
  );
}

function MessageThread({ order }) {
  const orderId = order.id;
  const [body, setBody] = useState("");
  const [sendKitOpen, setSendKitOpen] = useState(false);
  const qc = useQueryClient();
  const listRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-messages", orderId],
    queryFn: () => adminMsgApi.list(orderId),
    refetchInterval: 10000,
  });

  const send = useMutation({
    mutationFn: (b) => adminMsgApi.send(orderId, b),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin-messages", orderId] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to send"),
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <header className="px-5 py-3 border-b border-[rgba(26,26,26,0.08)] flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{order.client_name}</p>
          <p className="text-xs text-[#8A8588]">{order.client_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSendKitOpen((o) => !o)}
            data-testid="send-kit-open-btn"
            className="inline-flex items-center gap-1.5 rounded-pill border border-[rgba(26,26,26,0.15)] px-3 py-1.5 text-xs font-semibold hover:bg-[#1A1A1A] hover:text-white transition-colors"
          >
            <Package size={14} /> Send Kit
          </button>
          <StatusPill status={order.status} />
        </div>
      </header>
      {sendKitOpen && (
        <SendKitPanel
          order={order}
          onClose={() => setSendKitOpen(false)}
          onSent={() => qc.invalidateQueries({ queryKey: ["admin-messages", orderId] })}
        />
      )}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F7F5F2]"
        data-testid="admin-messages-list"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-[#8A8588] py-16">
            No messages yet.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} me="admin" />)
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate(body.trim());
        }}
        className="p-3 border-t border-[rgba(26,26,26,0.08)] flex gap-2"
      >
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to client…"
          data-testid="admin-message-input"
          className="input-base flex-1"
        />
        <button
          type="submit"
          disabled={!body.trim() || send.isPending}
          data-testid="admin-message-send"
          className="btn-primary"
        >
          {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </>
  );
}
