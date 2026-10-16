import {
  BrickWall,
  ChartNoAxesColumnIncreasing,
  DoorOpen,
  Martini,
  Sprout,
  Theater,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { VenueObjectKind } from '../../domain/models.ts'

export const OBJECT_ICONS: Record<VenueObjectKind, LucideIcon> = {
  WALL: BrickWall,
  STAGE: Theater,
  BAR: Martini,
  STAIRS: ChartNoAxesColumnIncreasing,
  FOOD_STATION: UtensilsCrossed,
  ENTRANCE: DoorOpen,
  PLANT: Sprout,
}

/** What a palette item dragged onto the plan carries. */
export const DRAG_TYPE = 'application/x-event-layout'
