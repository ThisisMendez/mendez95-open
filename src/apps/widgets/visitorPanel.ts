export type VisitorCity = { city: string; country: string; count: number };

/** Rank supplied display geography without inventing entries to fill the panel. */
export function selectTopCities(cities: readonly VisitorCity[]): VisitorCity[] {
  const regions = new Intl.DisplayNames(['en'], { type: 'region' });
  return cities.filter(place => {
    if (typeof place.city !== 'string' || !place.city.trim()
      || /^(?:unspecified(?: city)?|unknown(?: city)?|other(?: cities)?|unavailable|n\/a)$/i.test(place.city.trim())
      || typeof place.country !== 'string' || !/^[A-Z]{2}$/.test(place.country) || place.country === 'ZZ'
      || !Number.isSafeInteger(place.count) || place.count <= 0) return false;
    return regions.of(place.country) !== place.country;
  }).slice().sort((a, b) => b.count - a.count || a.city.localeCompare(b.city) || a.country.localeCompare(b.country)).slice(0, 8);
}
