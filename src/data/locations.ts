import { Country, State } from 'country-state-city';

export interface LocationCountry {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

const toFlagEmoji = (countryCode: string) =>
  countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

let _countriesCache: LocationCountry[] | null = null;

async function loadCountryLib() {
  const { Country } = await import('country-state-city');
  return Country;
}

async function loadStateLib() {
  const { State } = await import('country-state-city');
  return State;
}

export async function getCountries(): Promise<LocationCountry[]> {
  if (_countriesCache) return _countriesCache;
  const Country = await loadCountryLib();
  _countriesCache = Country.getAllCountries().map((country) => ({
    name: country.name,
    code: country.isoCode,
    dialCode: `+${country.phonecode}`,
    flag: toFlagEmoji(country.isoCode),
  })).sort((a, b) => a.name.localeCompare(b.name));
  return _countriesCache;
}

// Keep synchronous export for backward compat — populated after first async load
export let countries: LocationCountry[] = [];

// Preload on first import (non-blocking)
getCountries().then((c) => { countries = c; });

export const getStatesForCountry = async (countryName: string): Promise<string[]> => {
  const list = await getCountries();
  const selectedCountry = list.find((country) => country.name === countryName);
  if (!selectedCountry) return [];
  const State = await loadStateLib();
  return State.getStatesOfCountry(selectedCountry.code)
    .map((state) => state.name)
    .sort((a, b) => a.localeCompare(b));
};
