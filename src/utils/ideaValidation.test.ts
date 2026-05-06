import { describe, expect, it } from "vitest";
import { createExportPayload, normalizeIdeaInput, parseImportPayload, parseLinks } from "./ideaValidation";
import type { Idea } from "../types";

describe("idea validation", () => {
  it("requires a title", () => {
    expect(() => normalizeIdeaInput({ title: "   " })).toThrow("Title is required.");
  });

  it("keeps description and links optional", () => {
    expect(normalizeIdeaInput({ title: "Tiny CRM" })).toEqual({
      ideaId: undefined,
      title: "Tiny CRM",
      description: undefined,
      links: []
    });
  });

  it("parses newline and comma separated links", () => {
    expect(parseLinks("https://a.com\nhttps://b.com, https://c.com")).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com"
    ]);
  });

  it("round-trips versioned exports", () => {
    const idea: Idea = {
      id: "idea-1",
      ideaId: "IDEA-001",
      slotIndex: 4,
      title: "Looping tasks",
      links: ["https://example.com"],
      status: "active",
      carVariant: "low-poly-sedan",
      carColor: "#f4c84f",
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z"
    };

    const payload = createExportPayload([idea]);

    expect(parseImportPayload(JSON.stringify(payload))).toEqual(payload);
  });
});
