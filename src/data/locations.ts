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

// Lazy-initialize on first access to avoid blocking initial render
let _cache: LocationCountry[] | null = null;

function getCountryList(): LocationCountry[] {
  if (!_cache) {
    _cache = Country.getAllCountries().map((country) => ({
      name: country.name,
      code: country.isoCode,
      dialCode: `+${country.phonecode}`,
      flag: toFlagEmoji(country.isoCode),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return _cache;
}

// Proxy that lazily initializes
export const countries: LocationCountry[] = new Proxy([] as LocationCountry[], {
  get(_, prop) {
    const list = getCountryList();
    const val = (list as any)[prop];
    return typeof val === 'function' ? val.bind(list) : val;
  },
});

export const getStatesForCountry = (countryName: string): string[] => {
  const list = getCountryList();
  const selectedCountry = list.find((country) => country.name === countryName);
  if (!selectedCountry) return [];

  return State.getStatesOfCountry(selectedCountry.code)
    .map((state) => state.name)
    .sort((a, b) => a.localeCompare(b));
};
