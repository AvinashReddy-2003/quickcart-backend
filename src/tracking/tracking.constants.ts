// Simulation tuning — kept short so the whole delivery is demoable in ~40s.
export const PREPARING_MS = 4000; // time at the store before pickup
export const MOVE_STEPS = 20; // interpolation steps store -> customer
export const STEP_MS = 1500; // delay between location updates
export const PERSIST_EVERY = 5; // persist a location snapshot every N steps

// Default Hyderabad coordinates when a store or address has none.
export const DEFAULT_STORE = { lat: 17.44, lng: 78.45 };
export const DEFAULT_DROP = { lat: 17.4483, lng: 78.3915 };

export interface Rider {
  name: string;
  phone: string;
  vehicle: string;
}

export const RIDER_POOL: Rider[] = [
  { name: 'Ravi Kumar', phone: '+919000000001', vehicle: 'TS09 AB 1234' },
  { name: 'Suresh Reddy', phone: '+919000000002', vehicle: 'TS10 CD 5678' },
  { name: 'Imran Khan', phone: '+919000000003', vehicle: 'TS07 EF 9012' },
  { name: 'Anil Yadav', phone: '+919000000004', vehicle: 'TS08 GH 3456' },
];
