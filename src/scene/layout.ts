export type SlotLayout = {
  index: number;
  label: string;
  kind: "standard" | "accessible" | "reserved" | "loading";
  x: number;
  z: number;
  rotation: number;
};

const ROW_Z = [-5.4, -3.1, 3.1, 5.4];
const COL_X = [-8.4, -5.05, -1.7, 1.7, 5.05, 8.4];
export const LOT_WIDTH = 36;
export const LOT_DEPTH = 27;

export const PARKING_SLOTS: SlotLayout[] = ROW_Z.flatMap((z, row) =>
  COL_X.map((x, col) => {
    const index = row * COL_X.length + col;
    const reservedSlots: Record<number, SlotLayout["kind"]> = {
      0: "accessible",
      1: "accessible",
      10: "reserved",
      11: "loading",
      12: "reserved",
      13: "loading",
      22: "accessible",
      23: "accessible"
    };

    return {
      index,
      label: `P-${String(index + 1).padStart(2, "0")}`,
      kind: reservedSlots[index] ?? "standard",
      x,
      z,
      rotation: z < 0 ? Math.PI : 0
    };
  })
);

export function isParkableSlot(slotIndex: number) {
  return PARKING_SLOTS.find((slot) => slot.index === slotIndex)?.kind === "standard";
}

export const ENTRANCE_POSITION = [-10.8, 0.34, 0] as const;
export const BARRIER_POSITION = [-8.75, 0.22, 0] as const;

export const ACTIVE_ROUTE = [
  [-15.9, 0.32, -10.8],
  [-8.5, 0.32, -12.0],
  [8.5, 0.32, -12.0],
  [15.9, 0.32, -10.8],
  [16.8, 0.32, -2.2],
  [15.9, 0.32, 10.8],
  [8.5, 0.32, 12.0],
  [-8.5, 0.32, 12.0],
  [-15.9, 0.32, 10.8],
  [-16.8, 0.32, 2.2]
] as const;

export const ENTRY_ROUTE = [
  [-19.0, 0.34, 0],
  [-15.8, 0.34, 0],
  [-12.2, 0.34, 0],
  [-9.1, 0.34, 0],
  [-6.8, 0.34, 0]
] as const;

export const PARKING_DRIVE_X = [-6.9, -3.35, 0, 3.35, 6.9] as const;

export function getSlotPosition(slotIndex: number) {
  const slot = PARKING_SLOTS.find((candidate) => candidate.index === slotIndex);

  if (!slot) {
    throw new Error(`Unknown parking slot: ${slotIndex}`);
  }

  return [slot.x, 0.34, slot.z] as const;
}

export function getEntryPathToSlot(slotIndex: number) {
  const slot = PARKING_SLOTS.find((candidate) => candidate.index === slotIndex);

  if (!slot) {
    throw new Error(`Unknown parking slot: ${slotIndex}`);
  }

  const aisleZ = slot.z < 0 ? -1.55 : 1.55;
  const stagingX = Math.max(-6.7, Math.min(6.7, slot.x));
  const pullInZ = slot.z < 0 ? slot.z + 1.05 : slot.z - 1.05;

  return [
    ...ENTRY_ROUTE,
    [stagingX, 0.34, 0] as const,
    [slot.x, 0.34, aisleZ] as const,
    [slot.x, 0.34, pullInZ] as const,
    [slot.x, 0.34, slot.z] as const
  ] as const;
}
