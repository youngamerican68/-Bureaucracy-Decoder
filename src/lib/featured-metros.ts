import { FeaturedMetro } from '@/types';

/**
 * Featured Metropolitan Zoning Codes
 *
 * This list contains 50 major US metropolitan areas with their zoning code sources.
 * URLs are placeholders and should be replaced with actual official municipal code URLs.
 *
 * Regions:
 * - US – Northeast
 * - US – Southeast
 * - US – Midwest
 * - US – Southwest
 * - US – West Coast
 * - US – Mountain West
 */

export const featuredMetros: FeaturedMetro[] = [
  // === NORTHEAST ===
  {
    slug: 'nyc-zoning-resolution',
    cityName: 'New York City',
    codeName: 'Zoning Resolution',
    region: 'US – Northeast',
    sourceUrl: 'https://zr.planning.nyc.gov/',
  },
  {
    slug: 'boston-zoning-code',
    cityName: 'Boston',
    codeName: 'Zoning Code',
    region: 'US – Northeast',
    sourceUrl: 'https://www.boston.gov/departments/inspectional-services/zoning-code',
  },
  {
    slug: 'philadelphia-zoning-code',
    cityName: 'Philadelphia',
    codeName: 'Zoning Code',
    region: 'US – Northeast',
    sourceUrl: 'https://www.phila.gov/documents/zoning-code/',
  },
  {
    slug: 'pittsburgh-zoning-code',
    cityName: 'Pittsburgh',
    codeName: 'Zoning Code',
    region: 'US – Northeast',
    sourceUrl: 'https://pittsburghpa.gov/dcp/zoning',
  },
  {
    slug: 'newark-zoning-regulations',
    cityName: 'Newark',
    codeName: 'Zoning Regulations',
    region: 'US – Northeast',
    sourceUrl: 'https://www.newarknj.gov/departments/planning-zoning',
  },
  {
    slug: 'jersey-city-zoning-code',
    cityName: 'Jersey City',
    codeName: 'Zoning Code',
    region: 'US – Northeast',
    sourceUrl: 'https://www.jerseycitynj.gov/cityhall/planningdivision/zoning',
  },
  {
    slug: 'providence-zoning-ordinance',
    cityName: 'Providence',
    codeName: 'Zoning Ordinance',
    region: 'US – Northeast',
    sourceUrl: 'https://www.providenceri.gov/planning/zoning/',
  },
  {
    slug: 'baltimore-zoning-code',
    cityName: 'Baltimore',
    codeName: 'Zoning Code',
    region: 'US – Northeast',
    sourceUrl: 'https://planning.baltimorecity.gov/zoning-code',
  },
  {
    slug: 'dc-zoning-regulations',
    cityName: 'Washington D.C.',
    codeName: 'Zoning Regulations',
    region: 'US – Northeast',
    sourceUrl: 'https://dcoz.dc.gov/zoning-regulations',
  },

  // === SOUTHEAST ===
  {
    slug: 'miami-zoning-code',
    cityName: 'Miami',
    codeName: 'Zoning Code',
    region: 'US – Southeast',
    sourceUrl: 'https://www.miamigov.com/Government/Departments-Organizations/Planning/Zoning',
  },
  {
    slug: 'atlanta-zoning-ordinance',
    cityName: 'Atlanta',
    codeName: 'Zoning Ordinance',
    region: 'US – Southeast',
    sourceUrl: 'https://www.atlantaga.gov/government/departments/city-planning/zoning',
  },
  {
    slug: 'charlotte-zoning-ordinance',
    cityName: 'Charlotte',
    codeName: 'Zoning Ordinance',
    region: 'US – Southeast',
    sourceUrl: 'https://charlottenc.gov/planning/zoning',
  },
  {
    slug: 'nashville-zoning-code',
    cityName: 'Nashville',
    codeName: 'Zoning Code',
    region: 'US – Southeast',
    sourceUrl: 'https://www.nashville.gov/departments/codes/zoning-code',
  },
  {
    slug: 'orlando-zoning-code',
    cityName: 'Orlando',
    codeName: 'Land Development Code',
    region: 'US – Southeast',
    sourceUrl: 'https://www.orlando.gov/Our-Government/Records-and-Documents/Land-Development-Code',
  },
  {
    slug: 'tampa-zoning-code',
    cityName: 'Tampa',
    codeName: 'Zoning Code',
    region: 'US – Southeast',
    sourceUrl: 'https://www.tampa.gov/land-development',
  },
  {
    slug: 'jacksonville-zoning-code',
    cityName: 'Jacksonville',
    codeName: 'Zoning Code',
    region: 'US – Southeast',
    sourceUrl: 'https://www.coj.net/departments/planning/zoning-code',
  },
  {
    slug: 'raleigh-unified-development-ordinance',
    cityName: 'Raleigh',
    codeName: 'Unified Development Ordinance',
    region: 'US – Southeast',
    sourceUrl: 'https://raleighnc.gov/planning/unified-development-ordinance',
  },
  {
    slug: 'new-orleans-comprehensive-zoning-ordinance',
    cityName: 'New Orleans',
    codeName: 'Comprehensive Zoning Ordinance',
    region: 'US – Southeast',
    sourceUrl: 'https://nola.gov/city-planning/zoning/',
  },
  {
    slug: 'richmond-zoning-ordinance',
    cityName: 'Richmond',
    codeName: 'Zoning Ordinance',
    region: 'US – Southeast',
    sourceUrl: 'https://www.rva.gov/planning-development-review/zoning',
  },

  // === MIDWEST ===
  {
    slug: 'chicago-zoning-ordinance',
    cityName: 'Chicago',
    codeName: 'Zoning Ordinance',
    region: 'US – Midwest',
    sourceUrl: 'https://www.chicago.gov/city/en/depts/dcd/supp_info/zoning_ordinance.html',
  },
  {
    slug: 'detroit-zoning-ordinance',
    cityName: 'Detroit',
    codeName: 'Zoning Ordinance',
    region: 'US – Midwest',
    sourceUrl: 'https://detroitmi.gov/departments/planning-and-development-department/zoning',
  },
  {
    slug: 'minneapolis-zoning-code',
    cityName: 'Minneapolis',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.minneapolismn.gov/government/government-data/datasource/zoning-code/',
  },
  {
    slug: 'milwaukee-zoning-code',
    cityName: 'Milwaukee',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://city.milwaukee.gov/DCD/Planning/ZoningCode',
  },
  {
    slug: 'columbus-zoning-code',
    cityName: 'Columbus',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.columbus.gov/planning/zoning/',
  },
  {
    slug: 'indianapolis-zoning-ordinance',
    cityName: 'Indianapolis',
    codeName: 'Zoning Ordinance',
    region: 'US – Midwest',
    sourceUrl: 'https://www.indy.gov/activity/zoning-ordinance',
  },
  {
    slug: 'kansas-city-zoning-development-code',
    cityName: 'Kansas City',
    codeName: 'Zoning & Development Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.kcmo.gov/city-hall/departments/city-planning-development/zoning',
  },
  {
    slug: 'st-louis-zoning-code',
    cityName: 'St. Louis',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.stlouis-mo.gov/government/departments/planning/zoning/',
  },
  {
    slug: 'cleveland-zoning-code',
    cityName: 'Cleveland',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.clevelandohio.gov/CityofCleveland/Home/Government/CityAgencies/CityPlanning/Zoning',
  },
  {
    slug: 'cincinnati-zoning-code',
    cityName: 'Cincinnati',
    codeName: 'Zoning Code',
    region: 'US – Midwest',
    sourceUrl: 'https://www.cincinnati-oh.gov/buildings/zoning/',
  },

  // === SOUTHWEST ===
  {
    slug: 'houston-code-of-ordinances',
    cityName: 'Houston',
    codeName: 'Code of Ordinances - Development',
    region: 'US – Southwest',
    sourceUrl: 'https://www.houstontx.gov/planning/DevelopRegs/',
  },
  {
    slug: 'dallas-development-code',
    cityName: 'Dallas',
    codeName: 'Development Code',
    region: 'US – Southwest',
    sourceUrl: 'https://dallascityhall.com/departments/sustainabledevelopment/Pages/development-code.aspx',
  },
  {
    slug: 'san-antonio-unified-development-code',
    cityName: 'San Antonio',
    codeName: 'Unified Development Code',
    region: 'US – Southwest',
    sourceUrl: 'https://www.sanantonio.gov/DSD/Resources/UnifiedDevelopmentCode',
  },
  {
    slug: 'austin-land-development-code',
    cityName: 'Austin',
    codeName: 'Land Development Code',
    region: 'US – Southwest',
    sourceUrl: 'https://www.austintexas.gov/department/land-development-code',
  },
  {
    slug: 'fort-worth-zoning-ordinance',
    cityName: 'Fort Worth',
    codeName: 'Zoning Ordinance',
    region: 'US – Southwest',
    sourceUrl: 'https://www.fortworthtexas.gov/departments/development-services/zoning',
  },
  {
    slug: 'phoenix-zoning-ordinance',
    cityName: 'Phoenix',
    codeName: 'Zoning Ordinance',
    region: 'US – Southwest',
    sourceUrl: 'https://www.phoenix.gov/pdd/pz/zoning-ordinance',
  },
  {
    slug: 'tucson-land-use-code',
    cityName: 'Tucson',
    codeName: 'Land Use Code',
    region: 'US – Southwest',
    sourceUrl: 'https://www.tucsonaz.gov/pdsd/land-use-code',
  },
  {
    slug: 'albuquerque-integrated-development-ordinance',
    cityName: 'Albuquerque',
    codeName: 'Integrated Development Ordinance',
    region: 'US – Southwest',
    sourceUrl: 'https://www.cabq.gov/planning/integrated-development-ordinance',
  },
  {
    slug: 'el-paso-zoning-code',
    cityName: 'El Paso',
    codeName: 'Zoning Code',
    region: 'US – Southwest',
    sourceUrl: 'https://www.elpasotexas.gov/planning/zoning/',
  },
  {
    slug: 'oklahoma-city-zoning-code',
    cityName: 'Oklahoma City',
    codeName: 'Zoning Code',
    region: 'US – Southwest',
    sourceUrl: 'https://www.okc.gov/departments/planning/current-planning/zoning',
  },

  // === WEST COAST ===
  {
    slug: 'los-angeles-municipal-code-zoning',
    cityName: 'Los Angeles',
    codeName: 'LAMC Chapter I – General Provisions and Zoning',
    region: 'US – West Coast',
    sourceUrl: 'https://codelibrary.amlegal.com/codes/los_angeles/latest/lamc/0-0-0-107408',
    codifier: 'amlegal',
  },
  {
    slug: 'san-francisco-planning-code',
    cityName: 'San Francisco',
    codeName: 'Planning Code',
    region: 'US – West Coast',
    sourceUrl: 'https://sfplanning.org/resource/planning-code',
  },
  {
    slug: 'san-diego-municipal-code-land-development',
    cityName: 'San Diego',
    codeName: 'Land Development Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.sandiego.gov/development-services/land-development-code',
  },
  {
    slug: 'san-jose-zoning-ordinance',
    cityName: 'San Jose',
    codeName: 'Zoning Ordinance',
    region: 'US – West Coast',
    sourceUrl: 'https://www.sanjoseca.gov/your-government/departments/planning-building-code-enforcement/planning-division/zoning-code',
  },
  {
    slug: 'seattle-land-use-code',
    cityName: 'Seattle',
    codeName: 'Land Use Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.seattle.gov/sdci/codes/land-use-code',
  },
  {
    slug: 'portland-zoning-code',
    cityName: 'Portland',
    codeName: 'Zoning Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.portland.gov/bps/zoning-code',
  },
  {
    slug: 'oakland-planning-code',
    cityName: 'Oakland',
    codeName: 'Planning Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.oaklandca.gov/topics/planning-code',
  },
  {
    slug: 'sacramento-zoning-code',
    cityName: 'Sacramento',
    codeName: 'Zoning Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.cityofsacramento.org/Community-Development/Planning/Zoning',
  },
  {
    slug: 'long-beach-zoning-code',
    cityName: 'Long Beach',
    codeName: 'Zoning Code',
    region: 'US – West Coast',
    sourceUrl: 'https://www.longbeach.gov/lbds/planning/advance/code/',
  },

  // === MOUNTAIN WEST ===
  {
    slug: 'denver-zoning-code',
    cityName: 'Denver',
    codeName: 'Zoning Code',
    region: 'US – Mountain West',
    sourceUrl: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Community-Planning-and-Development/Denver-Zoning-Code',
  },
  {
    slug: 'las-vegas-unified-development-code',
    cityName: 'Las Vegas',
    codeName: 'Unified Development Code',
    region: 'US – Mountain West',
    sourceUrl: 'https://www.lasvegasnevada.gov/Government/Departments/Planning/Unified-Development-Code',
  },
  {
    slug: 'salt-lake-city-zoning-ordinance',
    cityName: 'Salt Lake City',
    codeName: 'Zoning Ordinance',
    region: 'US – Mountain West',
    sourceUrl: 'https://www.slc.gov/planning/zoning/',
  },
];

/**
 * Get metros grouped by region for UI display
 */
export function getMetrosByRegion(): Record<string, FeaturedMetro[]> {
  return featuredMetros.reduce((acc, metro) => {
    const region = metro.region;
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(metro);
    return acc;
  }, {} as Record<string, FeaturedMetro[]>);
}

/**
 * Find a metro by its slug
 */
export function findMetroBySlug(slug: string): FeaturedMetro | undefined {
  return featuredMetros.find(metro => metro.slug === slug);
}

/**
 * Get all unique regions
 */
export function getRegions(): string[] {
  return [...new Set(featuredMetros.map(m => m.region))];
}
