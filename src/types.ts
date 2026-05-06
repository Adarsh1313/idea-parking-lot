export type IdeaStatus = "parked" | "active" | "archived";

export type Idea = {
  id: string;
  ideaId: string;
  slotIndex: number;
  title: string;
  description?: string;
  links: string[];
  status: IdeaStatus;
  carVariant: string;
  carColor: string;
  createdAt: string;
  updatedAt: string;
};

export type IdeaParkingLotExport = {
  schemaVersion: 1;
  ideas: Idea[];
};

export type IdeaDraftInput = {
  ideaId?: string;
  title: string;
  description?: string;
  linksText?: string;
};
