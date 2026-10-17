import type { Country } from '../domain/phone.ts'
import type { Language } from '../i18n/languages.ts'

/** One place offered while a location is typed (D104). */
export interface PlaceSuggestion {
  /** The whole description, as it goes into the field. */
  text: string
  /** The place's name, such as "Hilton Tel Aviv". */
  main: string
  /** Where it is, such as "HaYarkon Street, Tel Aviv-Yafo, Israel". */
  secondary: string
}

export interface PlaceSuggester {
  /**
   * Places matching what was typed, in the interface language, favouring
   * the event's country. A typing session (from focusing the field to
   * choosing a place) shares one session.
   */
  suggest(
    input: string,
    options: { language: Language; country: Country; session: object },
  ): Promise<PlaceSuggestion[]>
  /** A new typing session. */
  newSession(): Promise<object>
}

// The parts of the Google Maps JavaScript API's Places library used here.
interface GooglePlacesLibrary {
  AutocompleteSessionToken: new () => object
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string
      sessionToken: object
      language: string
      region: string
    }): Promise<{
      suggestions: {
        placePrediction: {
          text: { text: string }
          mainText?: { text: string } | null
          secondaryText?: { text: string } | null
        } | null
      }[]
    }>
  }
}

interface GoogleMaps {
  maps: { importLibrary(name: 'places'): Promise<GooglePlacesLibrary> }
}

const LANGUAGE: Record<Language, string> = { en: 'en', he: 'iw', pt: 'pt-BR' }

let loading: Promise<GooglePlacesLibrary> | null = null

/**
 * Loads the Maps JavaScript API once, the first time a location field is
 * used. A failed load is tried again on the next use.
 */
function loadPlaces(key: string): Promise<GooglePlacesLibrary> {
  loading ??= new Promise<GooglePlacesLibrary>((resolve, reject) => {
    const callback = '__eventPlannerMapsReady'
    const scope = window as unknown as Record<string, unknown>
    scope[callback] = () => {
      const google = (window as unknown as { google: GoogleMaps }).google
      google.maps.importLibrary('places').then(resolve, reject)
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=${callback}`
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Google Maps could not be loaded'))
    }
    document.head.append(script)
  })
  return loading
}

/** Suggestions from Google Places (Autocomplete), with a browser key. */
export function createGooglePlaces(key: string): PlaceSuggester {
  return {
    newSession: async () =>
      new (await loadPlaces(key)).AutocompleteSessionToken(),
    async suggest(input, { language, country, session }) {
      const places = await loadPlaces(key)
      const { suggestions } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: session,
          language: LANGUAGE[language],
          region: country.toLowerCase(),
        })
      return suggestions.flatMap(({ placePrediction: place }) =>
        place
          ? [
              {
                text: place.text.text,
                main: place.mainText?.text ?? place.text.text,
                secondary: place.secondaryText?.text ?? '',
              },
            ]
          : [],
      )
    },
  }
}

const key = import.meta.env.VITE_GOOGLE_MAPS_KEY

/**
 * The deployment's suggester: Google when a key is set
 * (`VITE_GOOGLE_MAPS_KEY`), otherwise none, and location fields are plain.
 */
export const defaultPlaceSuggester: PlaceSuggester | null = key
  ? createGooglePlaces(key)
  : null
