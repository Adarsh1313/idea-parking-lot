import { FormEvent, useState } from "react";
import { BadgeCheck, Link, ShieldCheck, X } from "lucide-react";
import type { IdeaDraftInput } from "../types";

type IdeaModalProps = {
  title: string;
  submitLabel: string;
  accentColor: string;
  initialValue?: IdeaDraftInput;
  onCancel: () => void;
  onSubmit: (input: IdeaDraftInput) => Promise<void>;
};

export function IdeaModal({
  title,
  submitLabel,
  accentColor,
  initialValue,
  onCancel,
  onSubmit
}: IdeaModalProps) {
  const [draft, setDraft] = useState<IdeaDraftInput>({
    ideaId: initialValue?.ideaId ?? "",
    title: initialValue?.title ?? "",
    description: initialValue?.description ?? "",
    linksText: initialValue?.linksText ?? ""
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSubmit(draft);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save this idea.");
    } finally {
      setSaving(false);
    }
  }

  function insertDescriptionIndent(element: HTMLTextAreaElement) {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const indent = "  ";
    const nextDescription = `${draft.description?.slice(0, start) ?? ""}${indent}${draft.description?.slice(end) ?? ""}`;

    setDraft((current) => ({ ...current, description: nextDescription }));
    requestAnimationFrame(() => {
      element.selectionStart = start + indent.length;
      element.selectionEnd = start + indent.length;
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="idea-modal" onSubmit={handleSubmit} aria-label={title}>
        <div className="modal-header">
          <div>
            <span className="car-swatch" style={{ background: accentColor }} />
            <h2>{title}</h2>
            <p className="security-copy"><ShieldCheck size={14} /> Security checks the permit before opening the gate.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Cancel idea" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <label>
          Idea ID
          <span className="field-hint"><BadgeCheck size={14} /> Optional. Auto-assigned if blank.</span>
          <input
            value={draft.ideaId}
            maxLength={24}
            onChange={(event) => setDraft((current) => ({ ...current, ideaId: event.target.value }))}
            placeholder="IDEA-042"
          />
        </label>

        <label>
          Title
          <input
            autoFocus
            value={draft.title}
            maxLength={80}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="A tiny product that..."
          />
        </label>

        <label>
          Description
          <textarea
            value={draft.description}
            rows={4}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                insertDescriptionIndent(event.currentTarget);
              }
            }}
            placeholder="What would make this worth revisiting?"
          />
        </label>

        <label>
          Links
          <span className="field-hint"><Link size={14} /> One per line, or comma separated</span>
          <textarea
            value={draft.linksText}
            rows={3}
            onChange={(event) => setDraft((current) => ({ ...current, linksText: event.target.value }))}
            placeholder="https://example.com"
          />
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            <ShieldCheck size={17} />
            {saving ? "Checking permit..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
