import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { templatesApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, X, Check } from "lucide-react";

export default function AdminTemplates() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: templatesApi.list,
  });
  const [adding, setAdding] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-templates"] });

  const createTemplate = useMutation({
    mutationFn: (payload) => templatesApi.create(payload),
    onSuccess: () => {
      toast.success("Template added");
      setAdding(false);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to add template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id) => templatesApi.remove(id),
    onSuccess: () => {
      toast.success("Template deleted");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to delete"),
  });

  return (
    <div data-testid="admin-templates-page" className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8A8588]">
          Quick-reply templates for the Messages composer — add, edit, or remove any of these.
        </p>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          data-testid="template-add-toggle"
          className="btn-primary shrink-0 !px-4 !py-2 text-xs"
        >
          <Plus size={14} /> New template
        </button>
      </div>

      {adding && (
        <TemplateForm
          onCancel={() => setAdding(false)}
          onSave={(payload) => createTemplate.mutate(payload)}
          saving={createTemplate.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-[#8A8588]">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-[#1A1A1A]/15 bg-white p-10 text-center text-sm text-[#8A8588]">
          No templates yet — add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onDelete={() => deleteTemplate.mutate(t.id)}
              deleting={deleteTemplate.isPending}
              onSaved={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onDelete, deleting, onSaved }) {
  const [editing, setEditing] = useState(false);

  const updateTemplate = useMutation({
    mutationFn: (patch) => templatesApi.update(template.id, patch),
    onSuccess: () => {
      toast.success("Template saved");
      setEditing(false);
      onSaved();
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to save"),
  });

  if (editing) {
    return (
      <TemplateForm
        initial={template}
        onCancel={() => setEditing(false)}
        onSave={(payload) => updateTemplate.mutate(payload)}
        saving={updateTemplate.isPending}
      />
    );
  }

  return (
    <div
      data-testid={`template-card-${template.id}`}
      className="rounded-[16px] border border-[rgba(26,26,26,0.08)] bg-white p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold tracking-[-0.01em]">{template.title}</h3>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid={`template-edit-${template.id}`}
            className="rounded-full p-1.5 text-[#8A8588] hover:bg-[#F7F5F2] hover:text-[#1A1A1A]"
            aria-label="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            data-testid={`template-delete-${template.id}`}
            className="rounded-full p-1.5 text-[#8A8588] hover:bg-red-50 hover:text-[#EF4444]"
            aria-label="Delete"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-[#1A1A1A]/75 leading-relaxed">{template.body}</p>
    </div>
  );
}

function TemplateForm({ initial, onCancel, onSave, saving }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are both required");
      return;
    }
    onSave({ title: title.trim(), body: body.trim() });
  };

  return (
    <form
      onSubmit={submit}
      data-testid="template-form"
      className="rounded-[16px] border-2 border-[#FF6B35]/30 bg-white p-5 space-y-3"
    >
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="template-title-input"
          className="input-base mt-1.5"
          placeholder="e.g. Deposit reminder"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-[#8A8588]">Message body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          data-testid="template-body-input"
          rows={4}
          className="input-base mt-1.5 resize-y"
          placeholder="What gets inserted into the composer…"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} data-testid="template-save-btn" className="btn-primary !px-4 !py-2 text-xs">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-testid="template-cancel-btn"
          className="btn-secondary !px-4 !py-2 text-xs"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  );
}
