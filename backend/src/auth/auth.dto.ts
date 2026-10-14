import { IsString, MaxLength } from 'class-validator'

/** Shapes only; the rules (email form, password length) are in src/domain. */
export class SignUpDto {
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
