import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalApi, ORDER_STATUSES } from "@/lib/api";
import StatusPill from "@/pages/admin/_StatusPill";
import { toast } from "sonner";
import { ArrowLeft, Send, Star, Loader2, MessageSquare } from "lucide-react";

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
    refetchInterval: 20000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["portal-messages", id],
    queryFn: () => portalApi.listMessages(id),
    refetchInterval: 12000,
    enabled: !!order,
  });

  if (!order) return <p className="text-sm text-[#8A8588]">Loading order…</p>;

  const currentIdx = STATUS_SEQUENCE.indexOf(order.status);
  const canReview =
    order.status === "Delivered – Awaiting Review" ||
    order.status === "Delivered – Awaiting Final Payment";

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
          <div className="absolute inset-x-0 top-3 h-0.5 bg-[#1A1A1A]/10 rounded" />
          <div
            className="absolute top-3 left-0 h-0.5 bg-[#FF6B35] rounded transition-all duration-500 ease-in-out"
            style={{
              width: `${Math.max(0, (currentIdx / (STATUS_SEQUENCE.length - 1)) * 100)}%`,
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
      {tab === "messages" && <MessagesTab orderId={id} messages={messages} />}
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="portal-overview-tab">
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

function MessagesTab({ orderId, messages }) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const listRef = useRef(null);

  const send = useMutation({
    mutationFn: (b) => portalApi.sendMessage(orderId, b),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["portal-messages", orderId] });
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
          messages.map((m) => <MessageBubble key={m.id} msg={m} me="client" />)
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate(body.trim());
        }}
        className="border-t border-[rgba(26,26,26,0.08)] p-3 flex gap-2"
      >
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          data-testid="portal-message-input"
          className="input-base flex-1"
        />
        <button
          type="submit"
          disabled={!body.trim() || send.isPending}
          data-testid="portal-message-send"
          className="btn-primary"
        >
          {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
}

export function MessageBubble({ msg, me }) {
  const mine = msg.from_side === me;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        data-testid={`msg-${msg.id}`}
        className={`max-w-[80%] rounded-[16px] px-4 py-2.5 text-sm shadow-sm ${
          mine ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A] border border-[rgba(26,26,26,0.08)]"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
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
