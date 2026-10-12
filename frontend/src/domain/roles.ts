export const EVENT_ROLES = ['OWNER', 'ADMIN', 'VIEWER'] as const

export type EventRole = (typeof EVENT_ROLES)[number]
