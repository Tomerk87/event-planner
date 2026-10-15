import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

const SHAPES = ['CIRCLE', 'RECTANGLE', 'SQUARE'] as const

/** Shapes only; the limits and unique numbers are checked by src/domain/seating.ts. */
export class TableInputDto {
  @IsInt()
  number!: number

  @IsInt()
  capacity!: number

  @ApiProperty({ enum: SHAPES })
  @IsIn(SHAPES)
  shape!: (typeof SHAPES)[number]
}

export class TableDto extends TableInputDto {
  id!: string
  eventId!: string
}

export class TableWithOccupancyDto {
  @ApiProperty({ type: TableDto })
  table!: TableDto
  /** Confirmed attendees seated at the table. */
  assigned!: number
  /** Negative when the table is over capacity. */
  available!: number
}

export class SeatingHeadingsDto {
  @IsString()
  @MaxLength(80)
  firstName!: string

  @IsString()
  @MaxLength(80)
  lastName!: string

  @IsString()
  @MaxLength(80)
  invitationName!: string

  @IsString()
  @MaxLength(80)
  phone!: string

  @IsString()
  @MaxLength(80)
  confirmedAttendees!: string

  @IsString()
  @MaxLength(80)
  tableNumber!: string
}

export class ExportSeatingDto {
  @ApiProperty({ enum: ['csv', 'xlsx'] })
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx'

  @ValidateNested()
  @Type(() => SeatingHeadingsDto)
  headings!: SeatingHeadingsDto

  @IsString()
  @MaxLength(31)
  sheetName!: string

  @IsBoolean()
  rightToLeft!: boolean
}
