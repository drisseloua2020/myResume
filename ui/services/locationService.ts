const LOCATION_API_URL = (
  (import.meta as any).env?.VITE_LOCATION_API_URL ?? 'https://countriesnow.space/api/v0.1'
).replace(/\/$/, '');

type CountriesResponse = {
  data?: Array<{ name?: string }>;
};

type StatesResponse = {
  data?: {
    states?: Array<{ name?: string }>;
  };
};

type CitiesResponse = {
  data?: string[];
};

const uniqueSorted = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

async function request<T>(path: string, body?: Record<string, string>): Promise<T> {
  const res = await fetch(`${LOCATION_API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Location API request failed (${res.status})`);
  }

  const payload = await res.json();
  if (payload?.error === true) {
    throw new Error(payload?.msg || 'Location API request failed');
  }

  return payload as T;
}

export const locationService = {
  async getCountries(): Promise<string[]> {
    const payload = await request<CountriesResponse>('/countries/iso');
    return uniqueSorted(
      (payload.data ?? [])
        .map(country => country.name ?? '')
    );
  },

  async getStates(country: string): Promise<string[]> {
    if (!country.trim()) return [];

    const payload = await request<StatesResponse>('/countries/states', {
      country,
    });

    return uniqueSorted(
      (payload.data?.states ?? [])
        .map(state => state.name ?? '')
    );
  },

  async getCities(country: string, state: string): Promise<string[]> {
    if (!country.trim() || !state.trim()) return [];

    const payload = await request<CitiesResponse>('/countries/state/cities', {
      country,
      state,
    });

    return uniqueSorted(payload.data ?? []);
  },
};
