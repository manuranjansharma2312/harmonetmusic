import WorldMap from 'react-svg-worldmap';
import { formatStreams } from '@/lib/formatNumbers';

// Map common country names to ISO alpha-2 codes
const COUNTRY_CODE_MAP: Record<string, string> = {
  'United States': 'US', 'USA': 'US', 'US': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'GB': 'GB',
  'India': 'IN', 'IN': 'IN',
  'Germany': 'DE', 'DE': 'DE',
  'France': 'FR', 'FR': 'FR',
  'Brazil': 'BR', 'BR': 'BR',
  'Canada': 'CA', 'CA': 'CA',
  'Australia': 'AU', 'AU': 'AU',
  'Japan': 'JP', 'JP': 'JP',
  'Mexico': 'MX', 'MX': 'MX',
  'Spain': 'ES', 'ES': 'ES',
  'Italy': 'IT', 'IT': 'IT',
  'South Korea': 'KR', 'Korea': 'KR', 'KR': 'KR',
  'Netherlands': 'NL', 'NL': 'NL',
  'Russia': 'RU', 'RU': 'RU',
  'Indonesia': 'ID', 'ID': 'ID',
  'Turkey': 'TR', 'TR': 'TR',
  'Saudi Arabia': 'SA', 'SA': 'SA',
  'Sweden': 'SE', 'SE': 'SE',
  'Poland': 'PL', 'PL': 'PL',
  'Argentina': 'AR', 'AR': 'AR',
  'Nigeria': 'NG', 'NG': 'NG',
  'Thailand': 'TH', 'TH': 'TH',
  'Philippines': 'PH', 'PH': 'PH',
  'Colombia': 'CO', 'CO': 'CO',
  'Egypt': 'EG', 'EG': 'EG',
  'Pakistan': 'PK', 'PK': 'PK',
  'Bangladesh': 'BD', 'BD': 'BD',
  'Vietnam': 'VN', 'VN': 'VN',
  'Malaysia': 'MY', 'MY': 'MY',
  'South Africa': 'ZA', 'ZA': 'ZA',
  'Chile': 'CL', 'CL': 'CL',
  'Peru': 'PE', 'PE': 'PE',
  'China': 'CN', 'CN': 'CN',
  'Taiwan': 'TW', 'TW': 'TW',
  'Singapore': 'SG', 'SG': 'SG',
  'UAE': 'AE', 'United Arab Emirates': 'AE', 'AE': 'AE',
  'Norway': 'NO', 'NO': 'NO',
  'Denmark': 'DK', 'DK': 'DK',
  'Finland': 'FI', 'FI': 'FI',
  'Switzerland': 'CH', 'CH': 'CH',
  'Austria': 'AT', 'AT': 'AT',
  'Belgium': 'BE', 'BE': 'BE',
  'Portugal': 'PT', 'PT': 'PT',
  'Ireland': 'IE', 'IE': 'IE',
  'New Zealand': 'NZ', 'NZ': 'NZ',
  'Israel': 'IL', 'IL': 'IL',
  'Greece': 'GR', 'GR': 'GR',
  'Kenya': 'KE', 'KE': 'KE',
  'Ghana': 'GH', 'GH': 'GH',
  'Sri Lanka': 'LK', 'LK': 'LK',
  'Nepal': 'NP', 'NP': 'NP',
  'Ukraine': 'UA', 'UA': 'UA',
  'Morocco': 'MA', 'MA': 'MA',
  'Iraq': 'IQ', 'IQ': 'IQ',
  'Iran': 'IR', 'IR': 'IR',
  'Uganda': 'UG', 'UG': 'UG',
  'Jamaica': 'JM', 'JM': 'JM',
  'Algeria': 'DZ', 'DZ': 'DZ',
  'Albania': 'AL', 'AL': 'AL',
  'Afghanistan': 'AF', 'AF': 'AF',
};

function getCountryCode(name: string): string | null {
  return COUNTRY_CODE_MAP[name] || (name.length === 2 ? name.toUpperCase() : null);
}

interface WorldMapChartProps {
  data: { name: string; streams: number }[];
  className?: string;
}

export function WorldMapChart({ data, className }: WorldMapChartProps) {
  const mapData = data
    .map((d) => {
      const code = getCountryCode(d.name);
      return code ? { country: code.toLowerCase() as any, value: d.streams } : null;
    })
    .filter(Boolean) as any[];

  const maxStreams = Math.max(...data.map(d => d.streams), 1);

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
      {/* Legend list */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
        {data.map((d, i) => {
          const pct = (d.streams / maxStreams) * 100;
          return (
            <div key={d.name} className="flex items-center gap-2 text-[10px] sm:text-xs">
              <div className="h-2 flex-1 max-w-[60px] rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%`, opacity: 0.5 + (pct / 200) }}
                />
              </div>
              <span className="text-muted-foreground truncate">{d.name}</span>
              <span className="text-foreground font-medium ml-auto">{formatStreams(d.streams)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
