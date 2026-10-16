import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

const KINDS = [
  'WALL',
  'STAGE',
  'BAR',
  'STAIRS',
  'FOOD_STATION',
  'ENTRANCE',
  'PLANT',
] as const

/** Shapes only; the limits are applied by src/domain/layout.ts. */
export class TablePlacementDto {
  @IsString()
  @MaxLength(64)
  tableId!: string

  /** The table's centre, in centimetres from the room's top-left corner. */
  @IsInt()
  x!: number

  @IsInt()
  y!: number

  /** Clockwise, 0–359 degrees. */
  @IsInt()
  rotation!: number
}

export class VenueObjectDto {
  /** Chosen by the page that added the object; unique within the plan. */
  @IsString()
  @MaxLength(64)
  id!: string

  @ApiProperty({ enum: KINDS })
  @IsIn(KINDS)
  kind!: (typeof KINDS)[number]

  @IsInt()
  x!: number

  @IsInt()
  y!: number

  @IsInt()
  width!: number

  @IsInt()
  height!: number

  @IsInt()
  rotation!: number

  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  label!: string | null
}

export class LayoutInputDto {
  /** The room's size in centimetres. */
  @IsInt()
  roomWidth!: number

  @IsInt()
  roomDepth!: number

  /**
   * A new picture as a `data:image/...;base64,` address, the current
   * picture's own address to keep it, or null for none.
   */
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1_500_000)
  floorImage!: string | null

  /** 0–90 percent. */
  @IsInt()
  floorImageTransparency!: number

  /** 25–400 percent. */
  @IsInt()
  floorImageZoom!: number

  /** −180 to 180 degrees. */
  @IsInt()
  floorImageRotation!: number

  @IsArray()
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => TablePlacementDto)
  placements!: TablePlacementDto[]

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => VenueObjectDto)
  objects!: VenueObjectDto[]

  /** The version the changes were made on; a newer one refuses the save. */
  @IsInt()
  version!: number
}

export class LayoutDto extends LayoutInputDto {
  eventId!: string
}
