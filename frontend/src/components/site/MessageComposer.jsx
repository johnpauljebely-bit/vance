import { useState } from "react";
import { publicApi } from "@/lib/api";
import { toast } from "sonner";
import { Send, Loader2, Paperclip, X, FileText } from "lucide-react";
import FileDropzone from "./FileDropzone";

const MAX_FILES = 4;
const MAX_SIZE_MB = 10;

// Shared message composer for both the admin and client-portal message
// threads — real drag-and-drop/browse file attachment (previously the
// composer had no attach control at all, only a text input).
export default function MessageComposer({ onSend, sending, placeholder = "Type a message…", testIdPrefix }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);

  const uploadFiles = async (list) => {
    if (files.length + list.length > MAX_FILES) {
      toast.error(`Max ${MAX_FILES} attachments`);
      return;
    }
    for (const file of list) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is over ${MAX_SIZE_MB}MB`);
        continue;
      }
      const localId = crypto.randomUUID();
      setFiles((prev) => [...prev, { localId, name: file.name, uploading: true, file_id: null }]);
      try {
        const result = await publicApi.uploadReference(file);
        setFiles((prev) =>
          prev.map((f) => (f.localId === localId ? { ...f, uploading: false, file_id: result.file_id } : f))
        );
      } catch {
        toast.error(`Upload failed: ${file.name}`);
        setFiles((prev) => prev.filter((f) => f.localId !== localId));
      }
    }
  };

  const removeFile = (localId) => setFiles((prev) => prev.filter((f) => f.localId !== localId));

  const submit = (e) => {
    e.preventDefault();
    if (!body.trim() && files.length === 0) return;
    if (files.some((f) => f.uploading)) {
      toast.error("Wait for uploads to finish");
      return;
    }
    onSend(body.trim(), files.map((f) => f.file_id).filter(Boolean));
    setBody("");
    setFiles([]);
  };

  return (
    <form onSubmit={submit} className="border-t border-[rgba(26,26,26,0.08)] p-3" data-testid={`${testIdPrefix}-form`}>
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid={`${testIdPrefix}-pending-files`}>
          {files.map((f) => (
            <span
              key={f.localId}
              className="inline-flex items-center gap-1.5 rounded-pill bg-[#F7F5F2] border border-[rgba(26,26,26,0.1)] px-2.5 py-1 text-xs"
            >
              {f.uploading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
              <span className="max-w-[120px] truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(f.localId)}
                aria-label={`Remove ${f.name}`}
                className="text-[#8A8588] hover:text-[#EF4444]"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <FileDropzone
          testId={`${testIdPrefix}-attach`}
          accept="image/*,.pdf,.doc,.docx,.zip"
          multiple
          onFiles={uploadFiles}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(26,26,26,0.15)] text-[#8A8588] transition-colors hover:border-[#FF6B35] hover:text-[#FF6B35]"
          activeClassName="border-[#FF6B35] text-[#FF6B35] bg-[#FF6B35]/5"
        >
          <Paperclip size={16} />
        </FileDropzone>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          data-testid={`${testIdPrefix}-input`}
          className="input-base flex-1"
        />
        <button
          type="submit"
          disabled={(!body.trim() && files.length === 0) || sending}
          data-testid={`${testIdPrefix}-send`}
          className="btn-primary shrink-0"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </form>
  );
}
