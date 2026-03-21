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

export const countries: LocationCountry[] = Country.getAllCountries().map((country) => ({
  name: country.name,
  code: country.isoCode,
  dialCode: `+${country.phonecode}`,
  flag: toFlagEmoji(country.isoCode),
})).sort((a, b) => a.name.localeCompare(b.name));

export const getStatesForCountry = (countryName: string) => {
  const selectedCountry = countries.find((country) => country.name === countryName);
  if (!selectedCountry) return [];

  return State.getStatesOfCountry(selectedCountry.code)
    .map((state) => state.name)
    .sort((a, b) => a.localeCompare(b));
};
