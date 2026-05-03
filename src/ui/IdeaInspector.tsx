import { Edit3, ExternalLink, Power, Trash2, X } from "lucide-react";
import type { Idea } from "../types";

type IdeaInspectorProps = {
  idea: Idea;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
};

export function IdeaInspector({ idea, onClose, onEdit, onDelete, onToggleActive }: IdeaInspectorProps) {
  return (
    <aside className="idea-inspector" aria-label="Selected idea">
      <div className="inspector-header">
        <span className="car-swatch" style={{ background: idea.carColor }} />
        <button type="button" className="icon-button" aria-label="Close idea details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <p className="eyebrow">{idea.status === "active" ? "Active loop" : `Slot ${idea.slotIndex + 1}`}</p>
      <h2>{idea.title}</h2>
      {idea.description ? <FormattedDescription value={idea.description} /> : <p className="idea-description muted">No notes yet.</p>}

      <div className="link-list">
        {idea.links.map((link) => (
          <a key={link} href={link} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />
            {link}
          </a>
        ))}
      </div>

      <div className="inspector-actions">
        <button type="button" className={idea.status === "active" ? "primary-button active" : "primary-button"} onClick={onToggleActive}>
          <Power size={17} />
          {idea.status === "active" ? "Park it" : "Set active"}
        </button>
        <button type="button" className="secondary-button" onClick={onEdit}>
          <Edit3 size={17} />
          Edit
        </button>
        <button type="button" className="danger-button" onClick={onDelete}>
          <Trash2 size={17} />
          Delete
        </button>
      </div>
    </aside>
  );
}

function FormattedDescription({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);

  return (
    <div className="idea-description formatted-description">
      {lines.map((line, index) => {
        const isListLine = /^\s*(?:[-*]|\d+\.)\s+/.test(line);

        return (
          <div key={`${line}-${index}`} className={isListLine ? "description-list-line" : "description-line"}>
            {line || "\u00a0"}
          </div>
        );
      })}
    </div>
  );
}
