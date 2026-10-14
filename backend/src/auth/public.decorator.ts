import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC = 'isPublic'

/** Marks a route that needs no signed-in user. Every other route does. */
export const Public = () => SetMetadata(IS_PUBLIC, true)
