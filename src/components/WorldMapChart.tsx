import { memo, useMemo } from 'react';
import { Country } from 'country-state-city';
import WorldMap from 'react-svg-worldmap';
import { formatStreams } from '@/lib/formatNumbers';

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'US',
  us: 'US',
  uk: 'GB',
  uae: 'AE',
  korea: 'KR',
  'south korea': 'KR',
  'north korea': 'KP',
  russia: 'RU',
  vietnam: 'VN',
  czechia: 'CZ',
  'czech republic': 'CZ',
  tanzania: 'TZ',
  venezuela: 'VE',
  bolivia: 'BO',
  moldova: 'MD',
  syria: 'SY',
  laos: 'LA',
  brunei: 'BN',
  macedonia: 'MK',
  'north macedonia': 'MK',
};

const COUNTRY_LOOKUP = (() => {
  const lookup = new Map<string, string>();

  Country.getAllCountries().forEach((country) => {
    const normalizedName = normalizeCountryName(country.name);
    lookup.set(normalizedName, country.isoCode);
    lookup.set(normalizeCountryName(country.isoCode), country.isoCode);
  });

  Object.entries(COUNTRY_ALIASES).forEach(([alias, code]) => {
    lookup.set(normalizeCountryName(alias), code);
  });

  return lookup;
})();

function normalizeCountryName(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function getCountryCode(name: string): string | null {
  if (!name?.trim()) return null;

  const trimmed = name.trim();
  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return COUNTRY_LOOKUP.get(normalizeCountryName(trimmed)) || null;
}

interface WorldMapChartProps {
  data: { name: string; streams: number }[];
  className?: string;
}

export const WorldMapChart = memo(function WorldMapChart({ data, className }: WorldMapChartProps) {
  const normalizedData = useMemo(() => {
    const countryTotals = new Map<string, { label: string; streams: number }>();

    data.forEach((entry) => {
      const code = getCountryCode(entry.name);
      if (!code) return;

      const existing = countryTotals.get(code);
      if (existing) {
        existing.streams += entry.streams;
        return;
      }

      countryTotals.set(code, { label: entry.name, streams: entry.streams });
    });

    return Array.from(countryTotals.entries())
      .map(([code, entry]) => ({ code, name: entry.label, streams: entry.streams }))
      .sort((a, b) => b.streams - a.streams);
  }, [data]);

  const mapData = useMemo(
    () => normalizedData.map((entry) => ({ country: entry.code.toLowerCase(), value: entry.streams })),
    [normalizedData],
  );

  const maxStreams = useMemo(() => Math.max(...normalizedData.map((d) => d.streams), 1), [normalizedData]);

  return (
    <div className={className}>
      <div className="flex justify-center [&_svg]:max-w-full">
        <WorldMap
          color="hsl(0, 67%, 40%)"
          valueSuffix=" streams"
          size="responsive"
          data={mapData}
          backgroundColor="transparent"
          borderColor="hsl(0, 0%, 25%)"
          tooltipBgColor="hsl(0, 0%, 10%)"
          tooltipTextColor="hsl(0, 0%, 90%)"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {normalizedData.map((entry) => {
          const pct = (entry.streams / maxStreams) * 100;
          return (
            <div key={entry.code} className="flex items-center gap-2 text-[10px] sm:text-xs">
              <div className="h-2 flex-1 max-w-[60px] rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%`, opacity: 0.5 + pct / 200 }}
                />
              </div>
              <span className="text-muted-foreground truncate">{entry.name}</span>
              <span className="ml-auto text-foreground font-medium">{formatStreams(entry.streams)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
