export interface LocationCity {
  name: string;
}

export interface LocationState {
  code: string;
  name: string;
  cities: string[];
}

export interface LocationCountry {
  code: string;
  name: string;
  states: LocationState[];
}

export const OPEN_LOCATIONS_DATASET: LocationCountry[] = [
  {
    code: 'US',
    name: 'United States',
    states: [
      {
        code: 'CA',
        name: 'California',
        cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland'],
      },
      {
        code: 'NY',
        name: 'New York',
        cities: ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
      },
      {
        code: 'TX',
        name: 'Texas',
        cities: ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth'],
      },
      {
        code: 'FL',
        name: 'Florida',
        cities: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
      },
      {
        code: 'IL',
        name: 'Illinois',
        cities: ['Chicago', 'Naperville', 'Aurora', 'Rockford', 'Joliet'],
      },
      {
        code: 'WA',
        name: 'Washington',
        cities: ['Seattle', 'Bellevue', 'Tacoma', 'Spokane', 'Vancouver'],
      },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    states: [
      {
        code: 'ENG',
        name: 'England',
        cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Liverpool', 'Newcastle'],
      },
      {
        code: 'SCT',
        name: 'Scotland',
        cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
      },
      {
        code: 'WLS',
        name: 'Wales',
        cities: ['Cardiff', 'Swansea', 'Newport'],
      },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    states: [
      {
        code: 'ON',
        name: 'Ontario',
        cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London'],
      },
      {
        code: 'BC',
        name: 'British Columbia',
        cities: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond'],
      },
      {
        code: 'QC',
        name: 'Quebec',
        cities: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
      },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    states: [
      {
        code: 'NSW',
        name: 'New South Wales',
        cities: ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast'],
      },
      {
        code: 'VIC',
        name: 'Victoria',
        cities: ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
      },
      {
        code: 'QLD',
        name: 'Queensland',
        cities: ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Cairns'],
      },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    states: [
      {
        code: 'MH',
        name: 'Maharashtra',
        cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
      },
      {
        code: 'KA',
        name: 'Karnataka',
        cities: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'],
      },
      {
        code: 'DL',
        name: 'Delhi NCR',
        cities: ['New Delhi', 'Noida', 'Gurugram', 'Faridabad', 'Ghaziabad'],
      },
      {
        code: 'TN',
        name: 'Tamil Nadu',
        cities: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
      },
      {
        code: 'TG',
        name: 'Telangana',
        cities: ['Hyderabad', 'Warangal', 'Nizamabad'],
      },
      {
        code: 'GJ',
        name: 'Gujarat',
        cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
      },
    ],
  },
];

export function getCountries(): Array<{ code: string; name: string }> {
  return OPEN_LOCATIONS_DATASET.map((c) => ({ code: c.code, name: c.name }));
}

export function getStatesByCountry(countryCode: string): LocationState[] {
  const country = OPEN_LOCATIONS_DATASET.find((c) => c.code === countryCode);
  return country ? country.states : [];
}

export function getCitiesByState(countryCode: string, stateCode: string): string[] {
  const country = OPEN_LOCATIONS_DATASET.find((c) => c.code === countryCode);
  if (!country) return [];
  const state = country.states.find((s) => s.code === stateCode);
  return state ? state.cities : [];
}

export interface DefaultNicheOffer {
  niche: string;
  name: string;
  offer_text: string;
  osm_tags: string[];
  enabled: boolean;
}

export const DEFAULT_NICHE_OFFERS: DefaultNicheOffer[] = [
  {
    niche: 'school_coaching',
    name: 'School / Coaching Institute',
    offer_text: 'Custom school & coaching management portal: student attendance, automated fee reminders, and parent communication.',
    osm_tags: ['amenity=school', 'amenity=college'],
    enabled: true,
  },
  {
    niche: 'clinic_dentist',
    name: 'Clinic / Dental Practice',
    offer_text: 'Patient appointment scheduling system with automated WhatsApp reminders and digital record tracking.',
    osm_tags: ['amenity=clinic', 'amenity=dentist', 'amenity=doctors'],
    enabled: true,
  },
  {
    niche: 'gym_fitness',
    name: 'Gym / Fitness Studio',
    offer_text: 'Gym membership management & class booking web app with digital sign-ups and automated renewals.',
    osm_tags: ['amenity=gym', 'leisure=fitness_centre'],
    enabled: true,
  },
  {
    niche: 'restaurant_cafe',
    name: 'Restaurant / Cafe',
    offer_text: 'Zero-commission direct online table booking and digital menu ordering website.',
    osm_tags: ['amenity=restaurant', 'amenity=cafe'],
    enabled: true,
  },
  {
    niche: 'salon_spa',
    name: 'Salon / Beauty Spa',
    offer_text: 'Modern appointment booking website for salon clients with portfolio gallery and calendar scheduling.',
    osm_tags: ['shop=hairdresser', 'shop=beauty'],
    enabled: true,
  },
  {
    niche: 'general_business',
    name: 'Local Business / Service',
    offer_text: 'High-converting responsive business website to showcase services, capture local leads, and provide instant WhatsApp contact.',
    osm_tags: ['craft=*', 'shop=*'],
    enabled: true,
  },
];

