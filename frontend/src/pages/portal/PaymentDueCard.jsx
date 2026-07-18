import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { portalApi, publicApi } from "@/lib/api";
import { toast } from "sonner";
import { CreditCard, Gamepad2, Landmark, Loader2, CheckCircle2 } from "lucide-react";

const stripePromise = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
  : null;

const DEPOSIT_STATUS = "Accepted – Awaiting Deposit";
const FINAL_STATUS = "Delivered – Awaiting Final Payment";
const AWAITING_CONFIRM_STATUS = "Awaiting Manual Payment Confirmation";

export default function PaymentDueCard({ order }) {
  const pendingStage = order.status === AWAITING_CONFIRM_STATUS ? order.payment_confirmation_requested?.stage : null;
  const stage =
    (order.status === DEPOSIT_STATUS || pendingStage === "deposit") && !order.deposit_paid
      ? "deposit"
      : (order.status === FINAL_STATUS || pendingStage === "final") && !order.final_paid
      ? "final"
      : null;

  if (!stage) return null;

  if (!order.quoted_price) {
    return (
      <div id="payment-due" className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 scroll-mt-6" data-testid="payment-due-card">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Payment</p>
        <p className="mt-2 text-sm text-[#1A1A1A]/70">
          Your project hasn't been quoted a price yet — Vance will follow up before payment is needed.
        </p>
      </div>
    );
  }

  const fullPayment = stage === "deposit" && order.full_payment_requested;
  const amount = order.quoted_price * (fullPayment ? 1 : 0.5);

  if (order.payment_confirmation_requested) {
    return (
      <div
        id="payment-due"
        className="rounded-[20px] border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6 scroll-mt-6"
        data-testid="payment-due-card"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
          Payment pending confirmation
        </p>
        <p className="mt-2 text-sm text-[#1A1A1A]/80">
          We've noted your {order.payment_confirmation_requested.method} payment for the{" "}
          {order.payment_confirmation_requested.stage} — Vance will confirm shortly.
        </p>
      </div>
    );
  }

  return (
    <div id="payment-due" className="rounded-[20px] border border-[rgba(26,26,26,0.08)] bg-white p-6 scroll-mt-6" data-testid="payment-due-card">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
        Payment due — {fullPayment ? "full payment" : stage === "deposit" ? "50% deposit" : "50% final payment"}
      </p>
      <h3 className="mt-1 text-2xl font-bold tracking-[-0.02em]">
        ${amount.toFixed(2)} USD
      </h3>

      <div className="mt-5 space-y-3">
        <StripeMethod orderId={order.id} stage={stage} />
        <InteracMethod orderId={order.id} stage={stage} amount={amount} />
        <RobuxMethod orderId={order.id} stage={stage} code={order.unique_payment_code} />
      </div>
    </div>
  );
}

function StripeMethod({ orderId, stage }) {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!stripePromise) {
      toast.error("Stripe isn't configured yet");
      return;
    }
    setLoading(true);
    try {
      const { client_secret } = await portalApi.createPaymentIntent(orderId, stage);
      setClientSecret(client_secret);
      setOpen(true);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not start payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[rgba(26,26,26,0.1)] p-4" data-testid="payment-method-stripe">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard size={16} /> Card (Stripe)
        </div>
        {!open && (
          <button
            type="button"
            onClick={start}
            disabled={loading}
            data-testid="stripe-pay-now-btn"
            className="btn-primary !px-4 !py-2 text-xs"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Pay Now"}
          </button>
        )}
      </div>
      {open && clientSecret && stripePromise && (
        <div className="mt-4">
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripeCheckoutForm orderId={orderId} stage={stage} />
          </Elements>
        </div>
      )}
    </div>
  );
}

function StripeCheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Payment failed");
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      setDone(true);
      toast.success("Payment received — confirming…");
    }
  };

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-[#22C55E]" data-testid="stripe-payment-done">
        <CheckCircle2 size={16} /> Payment received — this will update shortly.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} data-testid="stripe-payment-form" className="space-y-3">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || submitting}
        data-testid="stripe-submit-btn"
        className="btn-primary w-full"
      >
        {submitting ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : "Confirm payment"}
      </button>
    </form>
  );
}

function InteracMethod({ orderId, stage, amount }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: publicApi.getSettings });
  const [confirmed, setConfirmed] = useState(false);

  const confirmPayment = useMutation({
    mutationFn: () => portalApi.markPaymentRequested(orderId, stage, "interac"),
    onSuccess: () => {
      setConfirmed(true);
      toast.success("Noted — Vance will confirm shortly.");
      qc.invalidateQueries({ queryKey: ["portal-order", orderId] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed"),
  });

  return (
    <div className="rounded-[14px] border border-[rgba(26,26,26,0.1)] p-4" data-testid="payment-method-interac">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Landmark size={16} /> Interac e-Transfer
      </div>
      <p className="mt-2 text-xs text-[#1A1A1A]/70">
        Send <span className="font-bold text-[#1A1A1A]">${amount.toFixed(2)} USD</span> to{" "}
        <span className="font-bold text-[#1A1A1A]">{settings?.interac_email || "—"}</span> via Interac e-Transfer
        (Canada only), then confirm below.
      </p>
      <button
        type="button"
        onClick={() => confirmPayment.mutate()}
        disabled={confirmPayment.isPending || confirmed}
        data-testid="interac-confirm-btn"
        className="btn-primary mt-3 w-full !py-2 text-xs"
      >
        {confirmed ? "Noted — awaiting confirmation" : confirmPayment.isPending ? "Sending…" : "Confirm Payment"}
      </button>
    </div>
  );
}

const ROBUX_PAYMENT_LINK = "https://www.roblox.com/games/121574145109643/Payments";

function RobuxMethod({ orderId, stage, code }) {
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  const confirmPayment = useMutation({
    mutationFn: () => portalApi.markPaymentRequested(orderId, stage, "robux"),
    onSuccess: () => {
      setConfirmed(true);
      toast.success("Noted — Vance will confirm shortly.");
      qc.invalidateQueries({ queryKey: ["portal-order", orderId] });
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed"),
  });

  return (
    <div className="rounded-[14px] border border-[rgba(26,26,26,0.1)] p-4" data-testid="payment-method-robux">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Gamepad2 size={16} /> Robux
      </div>
      <p className="mt-2 text-xs text-[#1A1A1A]/70">
        Enter code <span className="font-bold text-[#1A1A1A]">{code || "—"}</span>{" "}
        in-game and purchase the matching dev products.
      </p>
      <a
        href={ROBUX_PAYMENT_LINK}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="robux-game-link"
        className="btn-secondary mt-3 block w-full !py-2 text-center text-xs"
      >
        Pay with Robux →
      </a>
      <button
        type="button"
        onClick={() => confirmPayment.mutate()}
        disabled={confirmPayment.isPending || confirmed}
        data-testid="robux-confirm-btn"
        className="btn-primary mt-2 w-full !py-2 text-xs"
      >
        {confirmed ? "Noted — awaiting confirmation" : confirmPayment.isPending ? "Sending…" : "Confirm Payment"}
      </button>
    </div>
  );
}
