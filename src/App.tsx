import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudOff, Download, Import, Maximize2, ParkingCircle, PictureInPicture2, Route, X } from "lucide-react";
import type { IdeaDraftInput } from "./types";
import { useIdeaStore } from "./store/ideaStore";
import { ParkingLotScene } from "./scene/ParkingLotScene";
import { IdeaModal } from "./ui/IdeaModal";
import { IdeaInspector } from "./ui/IdeaInspector";
import { PARKING_SLOTS } from "./scene/layout";
import {
  clearStoredGitHubToken,
  hasGitHubSyncToken,
  pullIdeasFromGitHub,
  pushIdeasToGitHub,
  storeGitHubToken
} from "./data/githubSync";

const GITHUB_PAGES_URL = "https://adarsh1313.github.io/idea-parking-lot/";
const AMBIENT_WINDOW_NAME = "idea-parking-lot-ambient";

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
  const isAmbientMode = new URLSearchParams(window.location.search).get("ambient") === "1";
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [githubSyncEnabled, setGithubSyncEnabled] = useState(hasGitHubSyncToken);
  const [syncStatus, setSyncStatus] = useState(githubSyncEnabled ? "GitHub sync ready" : "Local only");
  const [remoteLoaded, setRemoteLoaded] = useState(!githubSyncEnabled);
  const lastSyncedPayloadRef = useRef<string | null>(null);
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
    archiveIdea,
    exportIdeas,
    importIdeas
  } = useIdeaStore();

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (!isAmbientMode) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadIdeas();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isAmbientMode, loadIdeas]);

  useEffect(() => {
    if (!loaded || !githubSyncEnabled) {
      return;
    }

    let cancelled = false;
    setSyncStatus("Loading GitHub database...");

    void pullIdeasFromGitHub()
      .then(async (remotePayload) => {
        if (cancelled) {
          return;
        }

        if (remotePayload) {
          await importIdeas(JSON.stringify(remotePayload));
          lastSyncedPayloadRef.current = JSON.stringify(remotePayload);
          setSyncStatus(`Synced ${remotePayload.ideas.length} ideas from GitHub`);
        } else {
          setSyncStatus("Creating GitHub database...");
        }

        setRemoteLoaded(true);
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }

        setRemoteLoaded(true);
        setGithubSyncEnabled(false);
        setSyncStatus(caughtError instanceof Error ? caughtError.message : "Could not load GitHub database.");
      });

    return () => {
      cancelled = true;
    };
  }, [githubSyncEnabled, importIdeas, loaded]);

  useEffect(() => {
    if (!loaded || !githubSyncEnabled || !remoteLoaded) {
      return;
    }

    const payload = exportIdeas();
    const serializedPayload = JSON.stringify(payload);

    if (serializedPayload === lastSyncedPayloadRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSyncStatus("Saving to GitHub...");
      void pushIdeasToGitHub(payload)
        .then(() => {
          lastSyncedPayloadRef.current = serializedPayload;
          setSyncStatus("Saved to GitHub");
        })
        .catch((caughtError) => {
          setSyncStatus(caughtError instanceof Error ? caughtError.message : "Could not save to GitHub.");
        });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [exportIdeas, githubSyncEnabled, ideas, loaded, remoteLoaded]);

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
  const visibleIdeas = ideas.filter((idea) => idea.status !== "archived");
  const activeCount = ideas.filter((idea) => idea.status === "active").length;
  const archivedCount = ideas.filter((idea) => idea.status === "archived").length;
  const parkableSlotCount = PARKING_SLOTS.filter((slot) => slot.kind === "standard").length;

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

  async function handleGitHubSyncToggle() {
    if (githubSyncEnabled) {
      clearStoredGitHubToken();
      setGithubSyncEnabled(false);
      setRemoteLoaded(true);
      setSyncStatus("Local only");
      return;
    }

    const token = window.prompt(
      "Paste a GitHub fine-grained token with Contents: Read and write access for Adarsh1313/idea-parking-lot."
    );

    if (!token?.trim()) {
      return;
    }

    storeGitHubToken(token);
    setRemoteLoaded(false);
    setGithubSyncEnabled(true);
    setSyncStatus("Connecting to GitHub...");
  }

  function openAmbientWindow() {
    const width = 430;
    const height = 300;
    const screenWithOffsets = window.screen as Screen & { availLeft?: number; availTop?: number };
    const screenLeft = screenWithOffsets.availLeft ?? window.screenLeft ?? 0;
    const screenTop = screenWithOffsets.availTop ?? window.screenTop ?? 0;
    const left = Math.max(0, screenLeft + window.screen.availWidth - width - 18);
    const top = Math.max(0, screenTop + window.screen.availHeight - height - 60);
    const url = new URL(window.location.href);
    url.searchParams.set("ambient", "1");
    url.searchParams.delete("importIdeas");
    url.searchParams.delete("migrate");

    const ambientWindow = window.open(
      url.toString(),
      AMBIENT_WINDOW_NAME,
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );

    ambientWindow?.focus();
  }

  function openFullApp() {
    const url = new URL(window.location.href);
    url.searchParams.delete("ambient");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <main className={isAmbientMode ? "app-shell ambient-shell" : "app-shell"}>
      <Suspense fallback={<div className="scene-loader">Preparing the lot...</div>}>
        <ParkingLotScene interactive={!isAmbientMode} />
      </Suspense>

      {isAmbientMode ? (
        <section className="ambient-hud" aria-label="Ambient parking lot status">
          <span><ParkingCircle size={15} /> {visibleIdeas.length}/{parkableSlotCount}</span>
          <span><Route size={15} /> {activeCount}</span>
          <button type="button" onClick={openFullApp} aria-label="Open full Idea Parking Lot app">
            <Maximize2 size={15} />
          </button>
        </section>
      ) : null}

      {!isAmbientMode ? <section className="top-hud" aria-label="Parking lot status">
        <div>
          <p className="eyebrow">Idea Parking Lot</p>
          <h1>Park sparks before they vanish.</h1>
        </div>
        <div className="hud-stats" aria-live="polite">
          <span><ParkingCircle size={18} /> {visibleIdeas.length}/{parkableSlotCount} parked</span>
          <span><Route size={18} /> {activeCount} active</span>
          <span>{archivedCount} archived</span>
        </div>
      </section> : null}

      {!isAmbientMode ? <section className="bottom-toolbar" aria-label="Backup controls">
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
        <button type="button" onClick={() => void handleGitHubSyncToggle()} disabled={!loaded}>
          {githubSyncEnabled ? <CloudOff size={18} /> : <Cloud size={18} />}
          {githubSyncEnabled ? "Disconnect GitHub" : "Connect GitHub"}
        </button>
        <button type="button" onClick={openAmbientWindow} disabled={!loaded}>
          <PictureInPicture2 size={18} />
          Ambient Lot
        </button>
        <span className="sync-status">{syncStatus}</span>
      </section> : null}

      <section className="visually-hidden" aria-label="Accessible parking spaces">
        {PARKING_SLOTS.map((slot) => {
          const occupied = visibleIdeas.some((idea) => idea.slotIndex === slot.index);
          const unavailable = occupied || slot.kind !== "standard";

          return (
            <button
              key={slot.index}
              type="button"
              disabled={unavailable}
              onClick={() => startPendingIdea(slot.index)}
            >
              {slot.kind === "standard" ? `Start idea in ${slot.label}` : `${slot.label} is reserved for lot scenery`}
            </button>
          );
        })}
      </section>

      {!isAmbientMode && pendingIdea ? (
        <IdeaModal
          title="New idea"
          accentColor={pendingIdea.carColor}
          submitLabel="Approve parking"
          onCancel={cancelPendingIdea}
          onSubmit={handleSavePending}
        />
      ) : null}

      {!isAmbientMode && editingIdea ? (
        <IdeaModal
          title="Tune this idea"
          accentColor={editingIdea.carColor}
          submitLabel="Save changes"
          initialValue={{
            ideaId: editingIdea.ideaId,
            title: editingIdea.title,
            description: editingIdea.description,
            linksText: editingIdea.links.join("\n")
          }}
          onCancel={() => setEditingIdeaId(null)}
          onSubmit={handleEditIdea}
        />
      ) : null}

      {!isAmbientMode && selectedIdea ? (
        <IdeaInspector
          idea={selectedIdea}
          onClose={() => selectIdea(null)}
          onEdit={() => setEditingIdeaId(selectedIdea.id)}
          onDelete={() => void deleteIdea(selectedIdea.id)}
          onToggleActive={() => void toggleActive(selectedIdea.id)}
          onArchive={() => void archiveIdea(selectedIdea.id)}
        />
      ) : null}

      {!isAmbientMode ? <button className="clear-selection" type="button" aria-label="Clear selected idea" onClick={() => selectIdea(null)}>
        <X size={18} />
      </button> : null}
    </main>
  );
}
