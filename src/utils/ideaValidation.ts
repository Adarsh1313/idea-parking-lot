import type { Idea, IdeaDraftInput, IdeaParkingLotExport } from "../types";

export const EXPORT_SCHEMA_VERSION = 1;

export function parseLinks(linksText = "") {
  return linksText
    .split(/\r?\n|,/)
    .map((link) => link.trim())
    .filter(Boolean);
}

export function normalizeIdeaInput(input: IdeaDraftInput) {
  const title = input.title.trim();

  if (!title) {
    throw new Error("Title is required.");
  }

  return {
    title,
    description: input.description?.trim() || undefined,
    links: parseLinks(input.linksText)
  };
}

export function createExportPayload(ideas: Idea[]): IdeaParkingLotExport {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    ideas
  };
}

export function parseImportPayload(raw: string): IdeaParkingLotExport {
  const parsed = JSON.parse(raw) as Partial<IdeaParkingLotExport>;

  if (parsed.schemaVersion !== EXPORT_SCHEMA_VERSION || !Array.isArray(parsed.ideas)) {
    throw new Error("This backup file is not a valid Idea Parking Lot export.");
  }

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    ideas: parsed.ideas.map((idea) => {
      if (!idea.id || !idea.title || typeof idea.slotIndex !== "number") {
        throw new Error("One or more imported ideas are missing required fields.");
      }

      return {
        ...idea,
        description: idea.description || undefined,
        links: Array.isArray(idea.links) ? idea.links : [],
        status: idea.status === "active" ? "active" : "parked"
      };
    })
  };
}
