import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicApi } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMISSION_TYPES } from "@/lib/brand";
import { toast } from "sonner";
import { Upload, X, CheckCircle2, Loader2 } from "lucide-react";
import FileDropzone from "./FileDropzone";

const MAX_FILES = 4;
const MAX_SIZE_MB = 10;

export default function CommissionForm() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: publicApi.getSettings });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commissionType, setCommissionType] = useState("Logo Design");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const fieldErrors = {
    name: name.trim().length > 0 ? null : "Enter your name.",
    email: email.includes("@") ? null : "Enter a valid email address.",
    description:
      description.trim().length >= 10
        ? null
        : `Add a bit more detail (at least 10 characters — ${description.trim().length}/10 so far).`,
  };
  const isValid = Object.values(fieldErrors).every((e) => !e);
  const canSubmit = isValid && !submitting;

  const handleFilePick = async (list) => {
    if (!list.length) return;

    if (files.length + list.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} reference images`);
      return;
    }

    for (const file of list) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is over ${MAX_SIZE_MB}MB`);
        continue;
      }
      const placeholder = {
        localId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        uploading: true,
        file_id: null,
      };
      setFiles((prev) => [...prev, placeholder]);
      try {
        const result = await publicApi.uploadReference(file);
        setFiles((prev) =>
          prev.map((f) =>
            f.localId === placeholder.localId
              ? { ...f, uploading: false, file_id: result.file_id }
              : f
          )
        );
      } catch (err) {
        toast.error(`Upload failed: ${file.name}`);
        setFiles((prev) => prev.filter((f) => f.localId !== placeholder.localId));
      }
    }
    e.target.value = "";
  };

  const removeFile = (localId) => {
    setFiles((prev) => prev.filter((f) => f.localId !== localId));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (!isValid) {
      const firstError = Object.values(fieldErrors).find(Boolean);
      toast.error(firstError || "Please fill in the required fields.");
      return;
    }
    if (submitting) return;

    // Wait for any still-uploading refs
    if (files.some((f) => f.uploading)) {
      toast.error("Wait for uploads to finish");
      return;
    }

    setSubmitting(true);
    try {
      await publicApi.submitRequest({
        name: name.trim(),
        email: email.trim(),
        commission_type: commissionType,
        description: description.trim(),
        budget: budget.trim() || null,
        reference_file_ids: files.map((f) => f.file_id).filter(Boolean),
      });
      setSubmitted(true);
      toast.success("Request sent — check your inbox soon.");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to send request";
      toast.error(typeof msg === "string" ? msg : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section
        id="request"
        data-testid="commission-form-section"
        className="section-tinted-selection selection-ink-dark bg-white py-20 md:py-32"
        style={{ "--section-accent": "#43FD6B", "--section-accent-text": "#15803D" }}
      >
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <div
            data-testid="commission-success"
            className="card-base flex flex-col items-center text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E]/15">
              <CheckCircle2 size={32} className="text-[#22C55E]" />
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-[-0.03em] md:text-4xl">
              Request sent —{" "}
              <span className="accent-italic">thanks!</span>
            </h2>
            <p className="mt-3 max-w-md text-[#1A1A1A]/70">
              You'll get a personal reply from Vance within a few days. If it's a
              fit, I'll send a deposit link and portal invite.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setName("");
                setEmail("");
                setDescription("");
                setBudget("");
                setFiles([]);
              }}
              data-testid="submit-another-btn"
              className="btn-secondary mt-8"
            >
              Submit another request
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="request"
      data-testid="commission-form-section"
      className="section-tinted-selection reveal-on-scroll bg-white py-20 md:py-32"
      style={{ "--section-accent": "#0201FC" }}
    >
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">
            Start a commission
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
            Tell me about your{" "}
            <span className="accent-italic">project.</span>
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70">
            The more detail you can share, the better my quote and turnaround
            estimate will be.
          </p>
        </div>

        {settings && settings.business_open === false && (
          <div
            data-testid="commission-form-closed-banner"
            className="mt-8 rounded-[16px] border-2 border-[#F59E0B]/30 bg-[#F59E0B]/10 px-5 py-4 text-center text-sm font-semibold text-[#1A1A1A]"
          >
            {settings.away_message || "Currently not taking new commissions — check back soon."}
          </div>
        )}

        {settings && settings.open_slots === 0 ? (
          <WaitlistSignup />
        ) : (
        <form
          onSubmit={onSubmit}
          data-testid="commission-form"
          className="mt-10 card-base space-y-5"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Your name" required error={attempted ? fieldErrors.name : null}>
              <input
                data-testid="form-name-input"
                className="input-base"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </Field>
            <Field label="Email address" required error={attempted ? fieldErrors.email : null}>
              <input
                data-testid="form-email-input"
                className="input-base"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </Field>
          </div>

          <Field label="Commission type" required>
            <Select value={commissionType} onValueChange={setCommissionType}>
              <SelectTrigger
                data-testid="form-type-select"
                className="input-base h-auto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMISSION_TYPES.map((t) => (
                  <SelectItem
                    key={t}
                    value={t}
                    data-testid={`form-type-option-${t.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Project brief"
            required
            hint="Vision, tagline, references, target audience — anything helps."
            error={attempted ? fieldErrors.description : null}
          >
            <textarea
              data-testid="form-description-textarea"
              className="input-base min-h-[160px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="I'm launching a coffee subscription brand called Northline — modern, warm, a bit playful. Would love a logo + palette + brand guide…"
              minLength={10}
              required
            />
          </Field>

          <Field
            label="Budget or package (optional)"
            hint="Ballpark budget or the package you're interested in."
          >
            <input
              data-testid="form-budget-input"
              className="input-base"
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="$500 – $1,500 USD"
            />
          </Field>

          <Field
            label="Reference images (optional)"
            hint={`Up to ${MAX_FILES} images, ${MAX_SIZE_MB}MB each. JPG, PNG, or WebP.`}
          >
            <FileDropzone
              testId="form-upload-dropzone"
              accept="image/*"
              multiple
              onFiles={handleFilePick}
              className="flex flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[rgba(26,26,26,0.2)] bg-[#F7F5F2] px-6 py-10 text-center transition-colors hover:section-accent-border hover:bg-[color:color-mix(in_srgb,var(--section-accent)_5%,transparent)]"
              activeClassName="section-accent-border bg-[color:color-mix(in_srgb,var(--section-accent)_8%,transparent)]"
            >
              <Upload size={24} className="text-[#8A8588]" />
              <p className="mt-3 text-sm font-semibold">
                Click or drop files here
              </p>
              <p className="mt-1 text-xs text-[#8A8588]">
                JPG · PNG · WebP · max {MAX_SIZE_MB}MB each
              </p>
            </FileDropzone>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2" data-testid="form-upload-list">
                {files.map((f) => (
                  <li
                    key={f.localId}
                    className="flex items-center gap-3 rounded-[12px] border border-[rgba(26,26,26,0.08)] bg-white px-4 py-2 text-sm"
                  >
                    {f.uploading ? (
                      <Loader2 size={16} className="animate-spin text-[#8A8588]" />
                    ) : (
                      <CheckCircle2 size={16} className="text-[#22C55E]" />
                    )}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-[#8A8588]">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.localId)}
                      data-testid={`remove-file-${f.localId}`}
                      aria-label={`Remove ${f.name}`}
                      className="text-[#8A8588] hover:text-[#EF4444]"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#8A8588]">
              By submitting, you agree to our{" "}
              <a href="/terms" className="underline hover:section-accent-text">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:section-accent-text">
                Privacy Policy
              </a>
              .
            </p>
            <button
              type="submit"
              disabled={submitting}
              data-testid="commission-submit-btn"
              className={`btn-primary min-w-[180px] ${!isValid ? "opacity-60" : ""}`}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending…
                </>
              ) : (
                <>Send Request</>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </section>
  );
}

function WaitlistSignup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.includes("@")) {
      toast.error("Enter your name and a valid email");
      return;
    }
    setSubmitting(true);
    try {
      await publicApi.joinWaitlist(name.trim(), email.trim().toLowerCase());
      setJoined(true);
      toast.success("You're on the waitlist!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not join waitlist");
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return (
      <div data-testid="waitlist-success" className="mt-10 card-base text-center">
        <CheckCircle2 size={32} className="mx-auto text-[#22C55E]" />
        <h3 className="mt-3 text-xl font-bold tracking-[-0.02em]">You're on the list.</h3>
        <p className="mt-2 text-[#1A1A1A]/70">
          I'll email you the moment a commission slot opens up.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} data-testid="waitlist-form" className="mt-10 card-base space-y-5" noValidate>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] section-accent-text">Commissions are full</p>
        <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em]">Join the waitlist.</h3>
        <p className="mt-2 text-[#1A1A1A]/70">
          I'll email you as soon as a slot opens up so you can submit your request.
        </p>
      </div>
      <Field label="Your name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="waitlist-name-input"
          className="input-base"
          placeholder="Jane Doe"
        />
      </Field>
      <Field label="Email address" required>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="waitlist-email-input"
          className="input-base"
          placeholder="jane@example.com"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        data-testid="waitlist-submit-btn"
        className="btn-primary w-full justify-center"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : "Notify me when a slot opens"}
      </button>
    </form>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
        {label}
        {required && <span className="section-accent-text"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-semibold text-[#EF4444]" data-testid="field-error">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-[#8A8588]">{hint}</p>
      )}
    </div>
  );
}
