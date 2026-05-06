import { create } from "zustand";
import { deleteIdeaById, getAllIdeas, putIdea, replaceIdeas } from "../data/db";
import { isParkableSlot } from "../scene/layout";
import type { Idea, IdeaDraftInput, IdeaParkingLotExport } from "../types";
import { createExportPayload, normalizeIdeaInput, parseImportPayload } from "../utils/ideaValidation";

type PendingIdea = {
  slotIndex: number;
  carColor: string;
};

type IdeaState = {
  ideas: Idea[];
  pendingIdea: PendingIdea | null;
  selectedIdeaId: string | null;
  loaded: boolean;
  error: string | null;
  loadIdeas: () => Promise<void>;
  startPendingIdea: (slotIndex: number) => void;
  cancelPendingIdea: () => void;
  savePendingIdea: (input: IdeaDraftInput) => Promise<Idea>;
  selectIdea: (id: string | null) => void;
  updateIdea: (id: string, input: IdeaDraftInput) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  archiveIdea: (id: string) => Promise<void>;
  exportIdeas: () => IdeaParkingLotExport;
  importIdeas: (raw: string) => Promise<void>;
};

const CAR_COLORS = ["#e35f45", "#f4c84f", "#78c6c8", "#7db46c", "#d76ba7", "#5d8fe8"];

function nextCarColor() {
  return CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
}

function sortIdeas(ideas: Idea[]) {
  return [...ideas].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function now() {
  return new Date().toISOString();
}

function normalizeStatus(status: Idea["status"] | string): Idea["status"] {
  return status === "archived" ? "archived" : status === "active" ? "active" : "parked";
}

function createIdeaId(ideas: Idea[]) {
  const usedIds = new Set(ideas.map((idea) => idea.ideaId));
  let nextNumber = ideas.length + 1;
  let candidate = `IDEA-${String(nextNumber).padStart(3, "0")}`;

  while (usedIds.has(candidate)) {
    nextNumber += 1;
    candidate = `IDEA-${String(nextNumber).padStart(3, "0")}`;
  }

  return candidate;
}

function createIdea(slotIndex: number, input: IdeaDraftInput, carColor: string, ideas: Idea[]): Idea {
  const normalized = normalizeIdeaInput(input);
  const timestamp = now();

  return {
    id: crypto.randomUUID(),
    ideaId: normalized.ideaId || createIdeaId(ideas),
    slotIndex,
    title: normalized.title,
    description: normalized.description,
    links: normalized.links,
    status: "parked",
    carVariant: "low-poly-sedan",
    carColor,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export const useIdeaStore = create<IdeaState>((set, get) => ({
  ideas: [],
  pendingIdea: null,
  selectedIdeaId: null,
  loaded: false,
  error: null,

  loadIdeas: async () => {
    try {
      const ideas = await getAllIdeas();
      const hydratedIdeas = ideas.map((idea, index) => ({
        ...idea,
        ideaId: idea.ideaId || `IDEA-${String(index + 1).padStart(3, "0")}`,
        status: normalizeStatus(idea.status)
      }));
      set({ ideas: sortIdeas(hydratedIdeas), loaded: true, error: null });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Could not load saved ideas.";
      set({ loaded: true, error: message });
    }
  },

  startPendingIdea: (slotIndex) => {
    const occupied = get().ideas.some((idea) => idea.slotIndex === slotIndex && idea.status !== "archived");

    if (occupied || !isParkableSlot(slotIndex)) {
      return;
    }

    set({
      pendingIdea: { slotIndex, carColor: nextCarColor() },
      selectedIdeaId: null,
      error: null
    });
  },

  cancelPendingIdea: () => set({ pendingIdea: null, error: null }),

  savePendingIdea: async (input) => {
    const pendingIdea = get().pendingIdea;

    if (!pendingIdea) {
      throw new Error("Choose a parking space before saving an idea.");
    }

    const idea = createIdea(pendingIdea.slotIndex, input, pendingIdea.carColor, get().ideas);
    await putIdea(idea);
    set((state) => ({
      ideas: sortIdeas([...state.ideas, idea]),
      pendingIdea: null,
      selectedIdeaId: idea.id,
      error: null
    }));
    return idea;
  },

  selectIdea: (id) => set({ selectedIdeaId: id, pendingIdea: null, error: null }),

  updateIdea: async (id, input) => {
    const normalized = normalizeIdeaInput(input);
    const idea = get().ideas.find((candidate) => candidate.id === id);

    if (!idea) {
      throw new Error("That idea no longer exists.");
    }

    const updatedIdea = {
      ...idea,
      ideaId: normalized.ideaId || idea.ideaId,
      title: normalized.title,
      description: normalized.description,
      links: normalized.links,
      updatedAt: now()
    };

    await putIdea(updatedIdea);
    set((state) => ({
      ideas: state.ideas.map((candidate) => (candidate.id === id ? updatedIdea : candidate)),
      error: null
    }));
  },

  deleteIdea: async (id) => {
    await deleteIdeaById(id);
    set((state) => ({
      ideas: state.ideas.filter((idea) => idea.id !== id),
      selectedIdeaId: state.selectedIdeaId === id ? null : state.selectedIdeaId,
      error: null
    }));
  },

  toggleActive: async (id) => {
    const idea = get().ideas.find((candidate) => candidate.id === id);

    if (!idea) {
      throw new Error("That idea no longer exists.");
    }

    const updatedIdea: Idea = {
      ...idea,
      status: idea.status === "active" ? "parked" : "active",
      updatedAt: now()
    };

    await putIdea(updatedIdea);
    set((state) => ({
      ideas: state.ideas.map((candidate) => (candidate.id === id ? updatedIdea : candidate)),
      error: null
    }));
  },

  archiveIdea: async (id) => {
    const idea = get().ideas.find((candidate) => candidate.id === id);

    if (!idea) {
      throw new Error("That idea no longer exists.");
    }

    const updatedIdea: Idea = {
      ...idea,
      status: idea.status === "archived" ? "parked" : "archived",
      updatedAt: now()
    };

    await putIdea(updatedIdea);
    set((state) => ({
      ideas: state.ideas.map((candidate) => (candidate.id === id ? updatedIdea : candidate)),
      error: null
    }));
  },

  exportIdeas: () => createExportPayload(get().ideas),

  importIdeas: async (raw) => {
    const payload = parseImportPayload(raw);
    await replaceIdeas(payload.ideas);
    set({
      ideas: sortIdeas(payload.ideas),
      pendingIdea: null,
      selectedIdeaId: null,
      error: null
    });
  }
}));
