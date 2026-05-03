export type IdeaStatus = "parked" | "active";

export type Idea = {
  id: string;
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
  title: string;
  description?: string;
  linksText?: string;
};
