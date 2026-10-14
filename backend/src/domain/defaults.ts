import { calendarStartOf } from './rsvpSettings.ts'
import type {
  Event,
  MessageTemplate,
  RsvpLanguage,
  RsvpSettings,
} from './models.ts'

/**
 * Starting guest-facing content for a new event, in the event's RSVP
 * language. This is event data the organizer then edits, not interface text.
 */
const MESSAGE_TEMPLATES: Record<RsvpLanguage, string> = {
  en: [
    'Hello {{first_name}},',
    '',
    'We are excited to invite you to {{event_name}}!',
    '',
    'Date: {{event_date}}',
    'Time: {{event_time}}',
    '',
    'Please let us know if you will be joining us by clicking the link below:',
    '{{rsvp_url}}',
    '',
    'We can’t wait to celebrate with you!',
  ].join('\n'),
  he: [
    'שלום {{first_name}},',
    '',
    'אנחנו שמחים להזמין אותך אל {{event_name}}!',
    '',
    'תאריך: {{event_date}}',
    'שעה: {{event_time}}',
    '',
    'נשמח לדעת אם תגיעו, בלחיצה על הקישור:',
    '{{rsvp_url}}',
    '',
    'מחכים לחגוג איתכם!',
  ].join('\n'),
}

const RSVP_TEXTS: Record<
  RsvpLanguage,
  Pick<
    RsvpSettings,
    'welcomeMessage' | 'approvedMessage' | 'declinedMessage' | 'notSureMessage'
  >
> = {
  en: {
    welcomeMessage:
      'We are so excited to celebrate with you! Please let us know if you will be joining us by confirming your attendance below.',
    approvedMessage:
      'Thank you for confirming! We can’t wait to celebrate with you!',
    declinedMessage: 'Thank you for letting us know. We will miss you!',
    notSureMessage: 'No worries! Please let us know if anything changes.',
  },
  he: {
    welcomeMessage:
      'אנחנו מתרגשים לחגוג איתכם! נשמח לדעת אם תגיעו, באישור ההגעה למטה.',
    approvedMessage: 'תודה שאישרתם! מחכים לחגוג איתכם!',
    declinedMessage: 'תודה שעדכנתם. תחסרו לנו!',
    notSureMessage: 'אין בעיה! נשמח לעדכון אם משהו משתנה.',
  },
}

export function defaultMessageTemplate(event: Event): MessageTemplate {
  return { eventId: event.id, body: MESSAGE_TEMPLATES[event.rsvpLanguage] }
}

export function defaultRsvpSettings(event: Event): RsvpSettings {
  return {
    eventId: event.id,
    ...RSVP_TEXTS[event.rsvpLanguage],
    backgroundImage: null,
    overlayOpacity: 40,
    calendar: {
      enabled: false,
      title: event.name,
      ...calendarStartOf(event),
      location: event.location ?? '',
    },
    youtube: { enabled: false, url: '' },
  }
}
