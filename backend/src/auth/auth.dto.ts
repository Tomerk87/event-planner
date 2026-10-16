import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import type { EmailLanguage } from '../email/templates.ts'

const LANGUAGES = ['en', 'he', 'pt'] as const

/** The language of the interface, for any email the request sends (D88). */
export class LanguageDto {
  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: EmailLanguage
}

/** Shapes only; the rules (email form, password length) are in src/domain. */
export class SignUpDto extends LanguageDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(254)
  email!: string

  @IsString()
  @MaxLength(200)
  password!: string
}

export class SignInDto {
  @IsString()
  @MaxLength(254)
  email!: string

  @IsString()
  @MaxLength(200)
  password!: string
}

export class UserDto {
  id!: string
  name!: string
  email!: string
  isSuperUser!: boolean
}

export class CurrentUserDto extends UserDto {
  /** Always true while email is off (D88). */
  emailVerified!: boolean
}

export class ForgotPasswordDto extends LanguageDto {
  @IsString()
  @MaxLength(254)
  email!: string
}

export class EmailLinkDto {
  @IsString()
  @MaxLength(200)
  token!: string
}

export class ResetPasswordDto extends EmailLinkDto {
  @IsString()
  @MaxLength(200)
  password!: string
}
