import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Download, Import, ParkingCircle, Route, X } from "lucide-react";
import type { IdeaDraftInput } from "./types";
import { useIdeaStore } from "./store/ideaStore";
import { ParkingLotScene } from "./scene/ParkingLotScene";
import { IdeaModal } from "./ui/IdeaModal";
import { IdeaInspector } from "./ui/IdeaInspector";
import { PARKING_SLOTS } from "./scene/layout";

const GITHUB_PAGES_URL = "https://adarsh1313.github.io/idea-parking-lot/";

function encodeMigrationPayload(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeMigrationPayload(encoded: string) {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function isLocalDevelopmentHost() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const {
    ideas,
    pendingIdea,
    selectedIdeaId,
    loaded,
    loadIdeas,
    startPendingIdea,
    cancelPendingIdea,
    savePendingIdea,
    selectIdea,
    updateIdea,
    deleteIdea,
    toggleActive,
    exportIdeas,
    importIdeas
  } = useIdeaStore();

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const migrationPayload = params.get("importIdeas");

    if (migrationPayload) {
      void importIdeas(decodeMigrationPayload(migrationPayload)).then(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
      return;
    }

    if (params.get("migrate") === "github" && isLocalDevelopmentHost()) {
      const payload = encodeMigrationPayload(JSON.stringify(exportIdeas()));
      window.location.assign(`${GITHUB_PAGES_URL}?importIdeas=${payload}`);
    }
  }, [exportIdeas, importIdeas, loaded]);

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId]
  );
  const editingIdea = useMemo(
    () => ideas.find((idea) => idea.id === editingIdeaId) ?? null,
    [editingIdeaId, ideas]
  );
  const activeCount = ideas.filter((idea) => idea.status === "active").length;

  async function handleSavePending(input: IdeaDraftInput) {
    await savePendingIdea(input);
  }

  async function handleEditIdea(input: IdeaDraftInput) {
    if (!editingIdeaId) {
      return;
    }

    await updateIdea(editingIdeaId, input);
    setEditingIdeaId(null);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(exportIdeas(), null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `idea-parking-lot-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | undefined) {
    if (!file) {
      return;
    }

    await importIdeas(await file.text());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <main className="app-shell">
      <Suspense fallback={<div className="scene-loader">Preparing the lot...</div>}>
        <ParkingLotScene />
      </Suspense>

      <section className="top-hud" aria-label="Parking lot status">
        <div>
          <p className="eyebrow">Idea Parking Lot</p>
          <h1>Park sparks before they vanish.</h1>
        </div>
        <div className="hud-stats" aria-live="polite">
          <span><ParkingCircle size={18} /> {ideas.length}/24 parked</span>
          <span><Route size={18} /> {activeCount} active</span>
        </div>
      </section>

      <section className="bottom-toolbar" aria-label="Backup controls">
        <button type="button" onClick={handleExport} disabled={!loaded}>
          <Download size={18} />
          Export
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!loaded}>
          <Import size={18} />
          Import
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
      </section>

      <section className="visually-hidden" aria-label="Accessible parking spaces">
        {PARKING_SLOTS.map((slot) => {
          const occupied = ideas.some((idea) => idea.slotIndex === slot.index);

          return (
            <button
              key={slot.index}
              type="button"
              disabled={occupied}
              onClick={() => startPendingIdea(slot.index)}
            >
              Start idea in slot {slot.index + 1}
            </button>
          );
        })}
      </section>

      {pendingIdea ? (
        <IdeaModal
          title="New idea"
          accentColor={pendingIdea.carColor}
          submitLabel="Save and park"
          onCancel={cancelPendingIdea}
          onSubmit={handleSavePending}
        />
      ) : null}

      {editingIdea ? (
        <IdeaModal
          title="Tune this idea"
          accentColor={editingIdea.carColor}
          submitLabel="Save changes"
          initialValue={{
            title: editingIdea.title,
            description: editingIdea.description,
            linksText: editingIdea.links.join("\n")
          }}
          onCancel={() => setEditingIdeaId(null)}
          onSubmit={handleEditIdea}
        />
      ) : null}

      {selectedIdea ? (
        <IdeaInspector
          idea={selectedIdea}
          onClose={() => selectIdea(null)}
          onEdit={() => setEditingIdeaId(selectedIdea.id)}
          onDelete={() => void deleteIdea(selectedIdea.id)}
          onToggleActive={() => void toggleActive(selectedIdea.id)}
        />
      ) : null}

      <button className="clear-selection" type="button" aria-label="Clear selected idea" onClick={() => selectIdea(null)}>
        <X size={18} />
      </button>
    </main>
  );
}
