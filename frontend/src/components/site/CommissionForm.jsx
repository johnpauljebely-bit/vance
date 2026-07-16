import { useState } from "react";
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

const MAX_FILES = 4;
const MAX_SIZE_MB = 10;

export default function CommissionForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [commissionType, setCommissionType] = useState("Logo Design");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.includes("@") &&
    commissionType &&
    description.trim().length >= 10 &&
    !submitting;

  const handleFilePick = async (e) => {
    const list = Array.from(e.target.files || []);
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
    if (!canSubmit) return;

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
        className="reveal-on-scroll bg-white py-20 md:py-32"
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
              <span className="accent-italic text-[#FF6B35]">thanks!</span>
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
      className="reveal-on-scroll bg-white py-20 md:py-32"
    >
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
            Start a commission
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.03em] md:text-5xl">
            Tell me about your{" "}
            <span className="accent-italic text-[#FF6B35]">project.</span>
          </h2>
          <p className="mt-4 text-[#1A1A1A]/70">
            The more detail you can share, the better my quote and turnaround
            estimate will be.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          data-testid="commission-form"
          className="mt-10 card-base space-y-5"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Your name" required>
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
            <Field label="Email address" required>
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

          <Field label="Project brief" required hint="Vision, tagline, references, target audience — anything helps.">
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
            <label
              data-testid="form-upload-dropzone"
              className="flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed border-[rgba(26,26,26,0.2)] bg-[#F7F5F2] px-6 py-10 text-center transition-colors hover:border-[#FF6B35] hover:bg-[#FF6B35]/5"
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleFilePick}
                data-testid="form-upload-input"
              />
              <Upload size={24} className="text-[#8A8588]" />
              <p className="mt-3 text-sm font-semibold">
                Click or drop files here
              </p>
              <p className="mt-1 text-xs text-[#8A8588]">
                JPG · PNG · WebP · max {MAX_SIZE_MB}MB each
              </p>
            </label>

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
              <a href="/terms" className="underline hover:text-[#FF6B35]">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-[#FF6B35]">
                Privacy Policy
              </a>
              .
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              data-testid="commission-submit-btn"
              className="btn-primary min-w-[180px]"
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
      </div>
    </section>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-widest text-[#1A1A1A]/80">
        {label}
        {required && <span className="text-[#FF6B35]"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#8A8588]">{hint}</p>}
    </div>
  );
}
