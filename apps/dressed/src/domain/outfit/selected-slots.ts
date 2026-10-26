import { accessorySlots } from "../garment/visual-style.js";
import { withCompanions } from "./garment-dependencies.js";
import type { SlotRequirement } from "./ensemble-engine.js";

export const outfitSlotIds = ["base_layer", "socks", "top", "bottom", "belt", "footwear", "jacket", "waistcoat", "neckwear", "pocket_square", "outerwear", "accessory", ...accessorySlots] as const;

export function selectedRequirements(selected: readonly string[], anchorSlot: string): readonly SlotRequirement[] {
  return withCompanions([...selected, anchorSlot]).map(slotId => ({slotId, requirement: "required", minimumItems: 1, maximumItems: 1}));
}
