/**
 * Links that open the event's location in Google Maps and Waze, built from
 * the location as the organizer typed it. No account or key is needed; the
 * maps service searches for the text, so a full address finds the place.
 */
export function mapLinks(location: string): { google: string; waze: string } {
  const query = encodeURIComponent(location.trim())
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  }
}
