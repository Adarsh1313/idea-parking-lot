import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../data/db";
import { useIdeaStore } from "./ideaStore";

async function resetStore() {
  await db.ideas.clear();
  useIdeaStore.setState({
    ideas: [],
    pendingIdea: null,
    selectedIdeaId: null,
    loaded: true,
    error: null
  });
}

describe("idea store", () => {
  beforeEach(async () => {
    await resetStore();
  });

  it("creates and cancels a pending idea without occupying a slot", () => {
    const store = useIdeaStore.getState();

    store.startPendingIdea(2);
    expect(useIdeaStore.getState().pendingIdea?.slotIndex).toBe(2);

    store.cancelPendingIdea();
    expect(useIdeaStore.getState().pendingIdea).toBeNull();
    expect(useIdeaStore.getState().ideas).toEqual([]);
  });

  it("saves a pending idea and persists it", async () => {
    useIdeaStore.getState().startPendingIdea(2);
    const idea = await useIdeaStore.getState().savePendingIdea({
      title: "Pocket analytics",
      description: "Daily tiny product metrics",
      linksText: "https://example.com"
    });

    expect(idea.slotIndex).toBe(2);
    expect(useIdeaStore.getState().ideas).toHaveLength(1);
    expect(await db.ideas.get(idea.id)).toMatchObject({ title: "Pocket analytics" });
  });

  it("edits, toggles active, and deletes ideas", async () => {
    useIdeaStore.getState().startPendingIdea(3);
    const idea = await useIdeaStore.getState().savePendingIdea({ title: "Original" });

    await useIdeaStore.getState().updateIdea(idea.id, {
      title: "Updated",
      linksText: "https://x.com/thread"
    });
    expect(useIdeaStore.getState().ideas[0]).toMatchObject({
      title: "Updated",
      links: ["https://x.com/thread"]
    });

    await useIdeaStore.getState().toggleActive(idea.id);
    expect(useIdeaStore.getState().ideas[0].status).toBe("active");

    await useIdeaStore.getState().deleteIdea(idea.id);
    expect(useIdeaStore.getState().ideas).toEqual([]);
    expect(await db.ideas.get(idea.id)).toBeUndefined();
  });

  it("imports and exports ideas", async () => {
    useIdeaStore.getState().startPendingIdea(5);
    const idea = await useIdeaStore.getState().savePendingIdea({ title: "Imported later" });
    const exported = JSON.stringify(useIdeaStore.getState().exportIdeas());

    await resetStore();
    await useIdeaStore.getState().importIdeas(exported);

    expect(useIdeaStore.getState().ideas).toEqual([idea]);
  });
});
