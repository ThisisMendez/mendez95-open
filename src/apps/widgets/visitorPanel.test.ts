import { expect, it } from 'vitest';
import { selectTopCities } from './visitorPanel';

it('ranks valid supplied cities by count, limits to eight, and preserves its input', () => {
  const cities = Array.from({ length: 10 }, (_, index) => ({ city: `City ${index}`, country: 'US', count: index + 1 }));
  const original = structuredClone(cities);
  expect(selectTopCities(cities).map(place => place.count)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
  expect(cities).toEqual(original);
});

it('omits unavailable geography and invalid counts without padding a short ranking', () => {
  const valid = { city: 'London', country: 'US', count: 3 };
  const invalid = [
    { ...valid, city: '' }, { ...valid, city: 'Unspecified city' }, { ...valid, city: 'Unknown' },
    { ...valid, country: 'ZZ' }, { ...valid, country: 'AA' }, { ...valid, country: 'usa' },
    { ...valid, count: 0 }, { ...valid, count: -1 }, { ...valid, count: NaN }, { ...valid, count: 1.5 },
  ];
  expect(selectTopCities([...invalid, valid])).toEqual([valid]);
  expect(selectTopCities([])).toEqual([]);
});
