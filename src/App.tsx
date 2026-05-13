import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Download,
  Eye,
  Import,
  LockKeyhole,
  Maximize2,
  ParkingCircle,
  PictureInPicture2,
  Route,
  X
} from "lucide-react";
import type { IdeaDraftInput } from "./types";
import { useIdeaStore } from "./store/ideaStore";
import { ParkingLotScene } from "./scene/ParkingLotScene";
import { IdeaModal } from "./ui/IdeaModal";
import { IdeaInspector } from "./ui/IdeaInspector";
import { PARKING_SLOTS } from "./scene/layout";
import {
  clearOwnerSession,
  getStoredOwnerEmail,
  hasOwnerSession,
  hasGitHubSyncToken,
  pullIdeasFromGitHub,
  pushIdeasToGitHub,
  storeOwnerSession,
  storeOwnerEmail,
  storeGitHubToken,
  verifyOwnerCredentials
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
  const [ownerModeEnabled, setOwnerModeEnabled] = useState(hasOwnerSession);
  const [viewerIntroStep, setViewerIntroStep] = useState<"hidden" | "story" | "auth">(() =>
    !hasOwnerSession() && !isAmbientMode ? "story" : "hidden"
  );
  const [authEmail, setAuthEmail] = useState(getStoredOwnerEmail);
  const [authPassword, setAuthPassword] = useState("");
  const [syncKeyInput, setSyncKeyInput] = useState("");
  const [showPublishSetup, setShowPublishSetup] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Loading shared GitHub database...");
  const [remoteLoaded, setRemoteLoaded] = useState(false);
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

  async function refreshSharedIdeas(statusPrefix = "Viewing") {
    const remotePayload = await pullIdeasFromGitHub();

    if (!remotePayload) {
      setSyncStatus(ownerModeEnabled ? "Owner mode ready. Public garage has not been published yet." : "No shared ideas have been published yet.");
      return;
    }

    await importIdeas(JSON.stringify(remotePayload));
    lastSyncedPayloadRef.current = JSON.stringify(remotePayload);
    setSyncStatus(ownerModeEnabled ? `Owner mode ready. Public garage shows ${remotePayload.ideas.length} shared ideas.` : `${statusPrefix} ${remotePayload.ideas.length} shared ideas`);
  }

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    let cancelled = false;
    setSyncStatus("Loading shared GitHub database...");

    void refreshSharedIdeas()
      .then(() => {
        if (cancelled) {
          return;
        }
        setRemoteLoaded(true);
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }

        setRemoteLoaded(true);
        setSyncStatus(caughtError instanceof Error ? caughtError.message : "Could not load shared GitHub database.");
      });

    return () => {
      cancelled = true;
    };
  }, [loaded, ownerModeEnabled]);

  useEffect(() => {
    if (!loaded || ownerModeEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSharedIdeas("Updated");
    }, isAmbientMode ? 10000 : 30000);

    return () => window.clearInterval(intervalId);
  }, [isAmbientMode, loaded, ownerModeEnabled]);

  useEffect(() => {
    if (!loaded || !ownerModeEnabled || !remoteLoaded) {
      return;
    }

    if (!hasGitHubSyncToken()) {
      setSyncStatus("Owner mode ready on this device. Public viewers only see ideas that have already been published.");
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
          setSyncStatus("Saved to GitHub. Public viewers can see the latest garage.");
        })
        .catch((caughtError) => {
          setSyncStatus(caughtError instanceof Error ? caughtError.message : "Could not save to GitHub.");
        });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [exportIdeas, ownerModeEnabled, ideas, loaded, remoteLoaded]);

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
  const visibleIdeas = useMemo(() => ideas.filter((idea) => idea.status !== "archived"), [ideas]);
  const visibleIdeaBySlot = useMemo(
    () => new Map(visibleIdeas.map((idea) => [idea.slotIndex, idea])),
    [visibleIdeas]
  );
  const archivedIdeas = useMemo(() => ideas.filter((idea) => idea.status === "archived"), [ideas]);
  const editingIdea = useMemo(
    () => ideas.find((idea) => idea.id === editingIdeaId) ?? null,
    [editingIdeaId, ideas]
  );
  const modalOpen = Boolean(pendingIdea || editingIdea);
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
    if (ownerModeEnabled) {
      clearOwnerSession();
      setOwnerModeEnabled(false);
      setViewerIntroStep("story");
      setRemoteLoaded(true);
      setSyncStatus("Viewer mode");
      return;
    }

    if (!authEmail.trim() || !authPassword.trim()) {
      setSyncStatus("Enter the owner email and password to unlock editing for 30 days.");
      return;
    }

    const validOwner = await verifyOwnerCredentials(authEmail, authPassword);

    if (!validOwner) {
      setSyncStatus("That owner login did not match.");
      return;
    }

    storeOwnerEmail(authEmail);
    storeOwnerSession();
    setAuthPassword("");
    setRemoteLoaded(false);
    setOwnerModeEnabled(true);
    setViewerIntroStep("hidden");
    setShowPublishSetup(!hasGitHubSyncToken());
    setSyncStatus(hasGitHubSyncToken() ? "Owner mode unlocked for 30 days. Loading shared database..." : "Owner mode unlocked for 30 days.");
  }

  function handleSavePublishKey() {
    if (!syncKeyInput.trim()) {
      setSyncStatus("Enter the GitHub publish key to update the public garage from this browser.");
      return;
    }

    storeGitHubToken(syncKeyInput);
    setSyncKeyInput("");
    setShowPublishSetup(false);
    setSyncStatus("Public sync enabled on this browser.");
  }

  function handleOwnerButton() {
    if (ownerModeEnabled) {
      void handleGitHubSyncToggle();
      return;
    }

    setViewerIntroStep("auth");
    setSyncStatus("Enter the owner email and password to unlock editing for 30 days.");
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

  const showViewerIntro = viewerIntroStep !== "hidden";

  return (
    <main className={isAmbientMode ? "app-shell ambient-shell" : "app-shell"}>
      <Suspense fallback={<div className="scene-loader">Preparing the lot...</div>}>
        <ParkingLotScene interactive={!isAmbientMode} canEdit={ownerModeEnabled} showSlotLabels={!modalOpen && !showViewerIntro} />
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
        {ownerModeEnabled ? (
          <>
            <button type="button" onClick={handleExport} disabled={!loaded}>
              <Download size={18} />
              Export
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!loaded}>
              <Import size={18} />
              Import
            </button>
          </>
        ) : null}
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
        <button type="button" onClick={handleOwnerButton} disabled={!loaded}>
          {ownerModeEnabled ? <CloudOff size={18} /> : <Cloud size={18} />}
          {ownerModeEnabled ? "Lock Owner Mode" : "Owner Login"}
        </button>
        <button type="button" onClick={openAmbientWindow} disabled={!loaded}>
          <PictureInPicture2 size={18} />
          Ambient Lot
        </button>
        {ownerModeEnabled && !hasGitHubSyncToken() ? (
          <button type="button" onClick={() => setShowPublishSetup(true)} disabled={!loaded}>
            Enable Public Sync
          </button>
        ) : null}
        <span className="sync-status">{syncStatus}</span>
      </section> : null}

      {!isAmbientMode && showViewerIntro ? (
        <section className="intro-overlay" aria-label="Viewer welcome">
          {viewerIntroStep === "story" ? (
            <section className="intro-card" aria-label="Idea lot story">
              <button type="button" className="icon-button intro-close" aria-label="Close viewer intro" onClick={() => setViewerIntroStep("hidden")}>
                <X size={18} />
              </button>
              <p className="eyebrow">Public View</p>
              <h2>Peek at Adarsh&apos;s idea lot.</h2>
              <p>
                This project is where I park the ideas I get for products, experiments, and tiny internet side quests so they do not disappear by the
                next morning while I am busy shipping current work.
              </p>
              <p>
                I love driving cars, so the whole metaphor came from that instinct. I keep this lot running in the background as a little reminder to
                stay focused, avoid doomscrolling, and keep executing the projects that used to just live in my head.
              </p>
              <div className="intro-actions">
                <button type="button" className="primary-button" onClick={() => setViewerIntroStep("auth")}>
                  Continue
                </button>
                <button type="button" className="secondary-button" onClick={() => setViewerIntroStep("hidden")}>
                  <Eye size={17} />
                  View only
                </button>
              </div>
            </section>
          ) : null}

          {viewerIntroStep === "auth" ? (
            <section className="intro-card" aria-label="Owner login">
              <button type="button" className="icon-button intro-close" aria-label="Close owner login" onClick={() => setViewerIntroStep("hidden")}>
                <X size={18} />
              </button>
              <p className="eyebrow">Owner Login</p>
              <h2>Unlock the lot.</h2>
              <div className="owner-login-form">
                <label>
                  Owner email
                  <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  Owner password
                  <input
                    value={authPassword}
                    type="password"
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="Password"
                  />
                </label>
              </div>
              <p className="viewer-note">Owner sessions stay unlocked on this browser for 30 days.</p>
              <p className="viewer-note">If you stumbled onto this website, click view only to see my current projects and the ones I&apos;ve parked in my head.</p>
              <div className="intro-actions">
                <button type="button" className="primary-button" onClick={() => void handleGitHubSyncToggle()}>
                  <LockKeyhole size={17} />
                  Unlock editing
                </button>
                <button type="button" className="secondary-button" onClick={() => setViewerIntroStep("hidden")}>
                  <Eye size={17} />
                  View only
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {!isAmbientMode && showPublishSetup ? (
        <section className="intro-overlay" aria-label="Public sync setup">
          <section className="intro-card" aria-label="Public sync setup card">
            <button type="button" className="icon-button intro-close" aria-label="Close public sync setup" onClick={() => setShowPublishSetup(false)}>
              <X size={18} />
            </button>
            <p className="eyebrow">Owner Setup</p>
            <h2>Enable the public garage.</h2>
            <p>
              This browser can edit locally already. Add your GitHub publish key once here if you want everyone else to see the latest parked and active ideas.
            </p>
            <div className="owner-login-form">
              <label>
                GitHub publish key
                <input
                  value={syncKeyInput}
                  type="password"
                  onChange={(event) => setSyncKeyInput(event.target.value)}
                  placeholder="Fine-grained GitHub token"
                />
              </label>
            </div>
            <div className="intro-actions">
              <button type="button" className="primary-button" onClick={handleSavePublishKey}>
                Save publish key
              </button>
              <button type="button" className="secondary-button" onClick={() => setShowPublishSetup(false)}>
                Later
              </button>
            </div>
          </section>
        </section>
      ) : null}

      <section className="visually-hidden" aria-label="Accessible parking spaces">
        {PARKING_SLOTS.map((slot) => {
          const occupyingIdea = visibleIdeaBySlot.get(slot.index);
          const occupied = Boolean(occupyingIdea);
          const unavailable = occupied || slot.kind !== "standard";

          return (
            <div key={slot.index}>
              <button
                type="button"
                disabled={unavailable || !ownerModeEnabled}
                onClick={() => startPendingIdea(slot.index)}
              >
                {slot.kind === "standard" ? `Start idea in ${slot.label}` : `${slot.label} is a disability parking space`}
              </button>
              {occupyingIdea ? (
                <button type="button" onClick={() => selectIdea(occupyingIdea.id)}>
                  {`Open idea in ${slot.label}`}
                </button>
              ) : null}
            </div>
          );
        })}
        {archivedIdeas.map((idea) => (
          <button key={idea.id} type="button" onClick={() => selectIdea(idea.id)}>
            {`Open archived idea ${idea.ideaId}`}
          </button>
        ))}
      </section>

      {!isAmbientMode && ownerModeEnabled && pendingIdea ? (
        <IdeaModal
          title="New idea"
          accentColor={pendingIdea.carColor}
          submitLabel="Approve parking"
          onCancel={cancelPendingIdea}
          onSubmit={handleSavePending}
        />
      ) : null}

      {!isAmbientMode && ownerModeEnabled && editingIdea ? (
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
          canEdit={ownerModeEnabled}
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
