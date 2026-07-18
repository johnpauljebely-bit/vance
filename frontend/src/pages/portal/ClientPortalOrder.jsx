import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalApi, ORDER_STATUSES } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ArrowLeft, Star, Loader2, MessageSquare, Download, FileText } from "lucide-react";
import PaymentDueCard from "./PaymentDueCard";
import MessageComposer from "@/components/site/MessageComposer";

const STATUS_SEQUENCE = [
  "New",
  "Accepted – Awaiting Deposit",
  "In Queue",
  "Sketching",
  "Final Review",
  "Delivered – Awaiting Review",
  "Closed",
];

export default function ClientPortalOrder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "review" ? "review" : "overview";
  const [tab, setTab] = useState(initialTab);
  const qc = useQueryClient();

  const { data: order } = useQuery({
    queryKey: ["portal-order", id],
    queryFn: () => portalApi.getOrder(id),
    // Fast enough to feel "live" (status bar, payment confirmation) without
    // a real push channel — no WebSocket/SSE infra exists in this app yet.
    refetchInterval: 4000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["portal-messages", id],
    queryFn: () => portalApi.listMessages(id),
    refetchInterval: 4000,
    enabled: !!order,
  });

  if (!order) return <p className="text-sm text-[#8A8588]">Loading order…</p>;

  const currentIdx = STATUS_SEQUENCE.indexOf(order.status);
  const canReview =
    order.status === "Delivered – Awaiting Review" ||
    order.status === "Delivered – Awaiting Final Payment";

  // The payment-request embed card's "Pay" button can be clicked from the
  // Messages tab, where the Payment Due section isn't even in the DOM (it
  // only renders on Overview) — switch tabs first, then scroll once it's
  // mounted, instead of a plain #anchor link that silently does nothing.
  const goToPayment = () => {
    setTab("overview");
    setTimeout(() => document.getElementById("payment-due")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div data-testid="portal-order-page" className="space-y-8">
      <Link
        to="/portal"
        data-testid="portal-back-link"
        className="inline-flex items-center gap-2 text-sm text-[#8A8588] hover:text-[#1A1A1A]"
      >
        <ArrowLeft size={14} /> All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8A8588]">
            {order.commission_type}
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-[-0.03em]">
            Order #{order.id.slice(0, 8)}
          </h1>
        </div>
        <StatusPill status={order.status} className="text-xs" />
      </div>

      {/* Status bar */}
      <div
        data-testid="order-status-bar"
        className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-5 md:p-6"
      >
        <div className="relative">
          {/* Each dot is centered within its own 1/n-width flex slot, so its
              true center sits at (i+0.5)/n of the row — not i/(n-1). The
              line has to start/end at that same offset (half a slot in from
              each edge) or it visually overshoots past the end dots and the
              orange progress never lines up under the current dot. */}
          <div
            className="absolute top-3 h-0.5 bg-[#1A1A1A]/10 rounded"
            style={{
              left: `${(50 / STATUS_SEQUENCE.length)}%`,
              right: `${(50 / STATUS_SEQUENCE.length)}%`,
            }}
          />
          <div
            className="absolute top-3 h-0.5 bg-[#FF6B35] rounded transition-all duration-500 ease-in-out"
            style={{
              left: `${(50 / STATUS_SEQUENCE.length)}%`,
              width: `${Math.max(0, (currentIdx / STATUS_SEQUENCE.length) * 100)}%`,
            }}
          />
          <ol className="relative flex justify-between">
            {STATUS_SEQUENCE.map((s, i) => (
              <li key={s} className="flex flex-col items-center text-center flex-1">
                <span
                  className={`h-6 w-6 rounded-full border-2 ${
                    i <= currentIdx
                      ? "bg-[#FF6B35] border-[#FF6B35]"
                      : "bg-white border-[#1A1A1A]/20"
                  }`}
                />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-[#1A1A1A]/60 max-w-[90px]">
                  {s.replace("Delivered – ", "Del. ")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" data-testid="portal-tabs">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} testid="portal-tab-overview">
          Overview
        </TabBtn>
        <TabBtn active={tab === "messages"} onClick={() => setTab("messages")} testid="portal-tab-messages">
          <MessageSquare size={12} /> Messages
        </TabBtn>
        {canReview && (
          <TabBtn active={tab === "review"} onClick={() => setTab("review")} testid="portal-tab-review">
            <Star size={12} /> Leave a review
          </TabBtn>
        )}
      </div>

      {tab === "overview" && <OverviewTab order={order} />}
      {tab === "messages" && <MessagesTab orderId={id} messages={messages} onGoToPayment={goToPayment} />}
      {tab === "review" && canReview && <ReviewTab orderId={id} onDone={() => qc.invalidateQueries()} />}
    </div>
  );
}

function TabBtn({ active, onClick, testid, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[#1A1A1A] text-white"
          : "bg-white border border-[rgba(26,26,26,0.1)] text-[#1A1A1A]/70 hover:text-[#1A1A1A]"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewTab({ order }) {
  return (
    <div className="space-y-4" data-testid="portal-overview-tab">
      <PaymentDueCard order={order} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Brief</p>
          <p className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">{order.description}</p>
        </div>
        <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 space-y-4">
          <MetaRow label="Payment" value={order.payment_status || "—"} />
          <MetaRow label="Budget" value={order.budget || "Quote pending"} />
          <MetaRow label="Created" value={new Date(order.created_at).toLocaleDateString()} />
        </div>
      </div>

      {order.status === "Closed" && <BrandKitCard orderId={order.id} />}
    </div>
  );
}

function BrandKitCard({ orderId }) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("vance_client_token");
      const res = await fetch(portalApi.brandKitUrl(orderId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "VanceLogo_BrandKit.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Could not download brand kit yet");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6" data-testid="brand-kit-card">
      <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Brand Kit</p>
      <h3 className="mt-1 text-lg font-bold">Your final logo files, all formats.</h3>
      <p className="mt-2 text-sm text-[#1A1A1A]/70">
        6 ready-to-use variants — black &amp; white, transparent, and color-on-accent — zipped up.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        data-testid="download-brand-kit-btn"
        className="btn-primary mt-4"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Download Brand Kit
      </button>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function MessagesTab({ orderId, messages, onGoToPayment }) {
  const qc = useQueryClient();
  const listRef = useRef(null);

  const send = useMutation({
    mutationFn: ({ body, attachments }) => portalApi.sendMessage(orderId, body, attachments),
    onSuccess: (newMsg) => {
      qc.setQueryData(["portal-messages", orderId], (prev) => [...(prev || []), newMsg]);
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to send"),
  });

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <div className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white overflow-hidden" data-testid="portal-messages-tab">
      <div
        ref={listRef}
        className="h-[420px] overflow-y-auto p-6 space-y-3 bg-[#F7F5F2]"
        data-testid="messages-list"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-[#8A8588] py-16">
            No messages yet — say hi.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} me="client" onGoToPayment={onGoToPayment} />)
        )}
      </div>
      <MessageComposer
        onSend={(body, attachments) => send.mutate({ body, attachments })}
        sending={send.isPending}
        placeholder="Type a message…"
        testIdPrefix="portal-message"
      />
    </div>
  );
}

export function MessageBubble({ msg, me, onGoToPayment }) {
  const mine = msg.from_side === me;

  if (msg.kind === "payment_request") {
    const { stage, amount } = msg.payload || {};
    const label = stage === "final" ? "Pay Final Balance" : stage === "full" ? "Pay Full Amount" : "Pay Deposit";
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          data-testid={`msg-${msg.id}`}
          className="max-w-[80%] rounded-[16px] border-2 border-[#FF6B35]/25 bg-white p-4 shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF6B35]">
            Payment Requested
          </p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[#1A1A1A]">
            ${(amount ?? 0).toFixed(2)} <span className="text-sm font-semibold text-[#8A8588]">USD</span>
          </p>
          <p className="mt-0.5 text-xs text-[#8A8588] capitalize">{stage} payment</p>
          {me === "client" && (
            <button
              type="button"
              onClick={onGoToPayment}
              data-testid={`msg-pay-btn-${msg.id}`}
              className="btn-primary mt-3 inline-flex !py-2 !px-4 text-xs"
            >
              {label}
            </button>
          )}
          <p className="mt-2 text-[10px] text-[#8A8588]">
            {new Date(msg.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  if (msg.kind === "payment_confirmation") {
    const { stage, method } = msg.payload || {};
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          data-testid={`msg-${msg.id}`}
          className="max-w-[80%] rounded-[16px] border-2 border-amber-400/40 bg-amber-50 p-4 shadow-sm"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            Awaiting Confirmation
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1A1A1A] capitalize">
            {method} payment sent for {stage}
          </p>
          <p className="mt-1 text-xs text-[#8A8588]">Vance will confirm this shortly.</p>
          <p className="mt-2 text-[10px] text-[#8A8588]">
            {new Date(msg.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        data-testid={`msg-${msg.id}`}
        className={`max-w-[80%] rounded-[16px] px-4 py-2.5 text-sm shadow-sm ${
          mine ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A] border border-[rgba(26,26,26,0.08)]"
        }`}
      >
        {msg.body && <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>}
        {(msg.attachments && msg.attachments.length > 0
          ? msg.attachments
          : (msg.attachment_file_ids || []).map((id) => ({ file_id: id, filename: "Attachment", content_type: "" }))
        ).map((att) => {
          const url = `${process.env.REACT_APP_BACKEND_URL}/api/files/${att.file_id}`;
          const isImage = att.content_type?.startsWith("image/");
          return isImage ? (
            <a
              key={att.file_id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`msg-attachment-${att.file_id}`}
              className="mt-2 block"
            >
              <img
                src={url}
                alt={att.filename}
                className="max-h-48 max-w-full rounded-[10px] border border-[rgba(26,26,26,0.08)] object-cover"
              />
            </a>
          ) : (
            <a
              key={att.file_id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`msg-attachment-${att.file_id}`}
              className={`mt-2 flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-xs font-semibold underline ${
                mine ? "bg-white/10 text-white" : "bg-[#F7F5F2] text-[#1A1A1A]"
              }`}
            >
              <FileText size={12} className="shrink-0" />
              <span className="truncate">{att.filename}</span>
            </a>
          );
        })}
        <p className={`mt-1 text-[10px] ${mine ? "text-white/50" : "text-[#8A8588]"}`}>
          {new Date(msg.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function ReviewTab({ orderId, onDone }) {
  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: () => portalApi.submitReview(orderId, quote, rating),
    onSuccess: () => {
      toast.success("Review submitted — thank you!");
      setSubmitted(true);
      onDone?.();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to submit"),
  });

  if (submitted) {
    return (
      <div className="rounded-[20px] bg-white p-8 text-center" data-testid="portal-review-done">
        <Star size={32} className="mx-auto text-[#FF6B35]" />
        <p className="mt-3 font-bold">Thanks for the review!</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (quote.trim().length >= 10) submit.mutate();
      }}
      className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 space-y-4"
      data-testid="portal-review-form"
    >
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Rating
        </label>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              data-testid={`review-star-${n}`}
              className="p-1"
            >
              <Star
                size={22}
                className={n <= rating ? "fill-[#FF6B35] text-[#FF6B35]" : "text-[#8A8588]"}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">
          Your review
        </label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          minLength={10}
          rows={5}
          data-testid="review-quote-textarea"
          placeholder="Working with Vance was…"
          className="input-base mt-1.5"
          required
        />
      </div>
      <button
        type="submit"
        disabled={quote.trim().length < 10 || submit.isPending}
        data-testid="review-submit-btn"
        className="btn-primary"
      >
        {submit.isPending ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
