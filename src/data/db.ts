import Dexie, { type Table } from "dexie";
import type { Idea } from "../types";

class IdeaParkingLotDatabase extends Dexie {
  ideas!: Table<Idea, string>;

  constructor() {
    super("idea-parking-lot");
    this.version(1).stores({
      ideas: "id, slotIndex, status, updatedAt"
    });
    this.version(2).stores({
      ideas: "id, slotIndex, status, createdAt, updatedAt"
    });
  }
}

export const db = new IdeaParkingLotDatabase();

export async function getAllIdeas() {
  return db.ideas.orderBy("createdAt").toArray();
}

export async function putIdea(idea: Idea) {
  await db.ideas.put(idea);
}

export async function deleteIdeaById(id: string) {
  await db.ideas.delete(id);
}

export async function replaceIdeas(ideas: Idea[]) {
  await db.transaction("rw", db.ideas, async () => {
    await db.ideas.clear();
    await db.ideas.bulkPut(ideas);
  });
}
