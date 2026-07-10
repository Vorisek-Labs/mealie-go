import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecipeUnit } from '../types';

// Mealie's own server-side unit-system feature is an unreleased/unmerged PR as of
// this writing, so we do a lightweight client-side "original <-> metric" conversion
// instead of depending on an API that most self-hosted servers won't have yet.

export type UnitSystemPreference = 'original' | 'metric';

const PREF_KEY = 'mealie_go.unit_system';

export async function getUnitSystemPreference(): Promise<UnitSystemPreference> {
  const v = await AsyncStorage.getItem(PREF_KEY);
  return v === 'metric' ? 'metric' : 'original';
}

export async function setUnitSystemPreference(pref: UnitSystemPreference): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, pref);
}

type Dimension = 'volume' | 'mass';

interface UnitDef {
  dimension: Dimension;
  toBase: number; // multiplier to base unit (ml for volume, g for mass)
}

// Matched against unit.abbreviation/unit.name, lowercased, with trailing
// "s" stripped so both singular and plural forms hit the same entry.
const UNIT_TABLE: Record<string, UnitDef> = {
  tsp: { dimension: 'volume', toBase: 4.92892 },
  teaspoon: { dimension: 'volume', toBase: 4.92892 },
  tbsp: { dimension: 'volume', toBase: 14.7868 },
  tablespoon: { dimension: 'volume', toBase: 14.7868 },
  'fl oz': { dimension: 'volume', toBase: 29.5735 },
  'fluid ounce': { dimension: 'volume', toBase: 29.5735 },
  cup: { dimension: 'volume', toBase: 236.588 },
  pint: { dimension: 'volume', toBase: 473.176 },
  pt: { dimension: 'volume', toBase: 473.176 },
  quart: { dimension: 'volume', toBase: 946.353 },
  qt: { dimension: 'volume', toBase: 946.353 },
  gallon: { dimension: 'volume', toBase: 3785.41 },
  gal: { dimension: 'volume', toBase: 3785.41 },
  oz: { dimension: 'mass', toBase: 28.3495 },
  ounce: { dimension: 'mass', toBase: 28.3495 },
  lb: { dimension: 'mass', toBase: 453.592 },
  lbs: { dimension: 'mass', toBase: 453.592 },
  pound: { dimension: 'mass', toBase: 453.592 },
};

function normalizeKey(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return lower.endsWith('s') && !(lower in UNIT_TABLE) ? lower.slice(0, -1) : lower;
}

function lookupUnit(unit?: RecipeUnit): UnitDef | null {
  if (!unit) return null;
  const candidates = [unit.abbreviation, unit.name].filter(Boolean) as string[];
  for (const c of candidates) {
    const key = normalizeKey(c);
    if (UNIT_TABLE[key]) return UNIT_TABLE[key];
  }
  return null;
}

function roundNice(n: number): number {
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

export interface ConvertedQuantity {
  quantity: number;
  unitLabel: string;
}

/** Converts a quantity + unit to metric for display. Returns null if the unit isn't recognized. */
export function convertToMetric(quantity: number, unit?: RecipeUnit): ConvertedQuantity | null {
  const def = lookupUnit(unit);
  if (!def) return null;

  const base = quantity * def.toBase;
  if (def.dimension === 'volume') {
    return base >= 1000
      ? { quantity: roundNice(base / 1000), unitLabel: 'l' }
      : { quantity: roundNice(base), unitLabel: 'ml' };
  }
  return base >= 1000
    ? { quantity: roundNice(base / 1000), unitLabel: 'kg' }
    : { quantity: roundNice(base), unitLabel: 'g' };
}

const FAHRENHEIT_PATTERN = /(-?\d+(?:\.\d+)?)\s*°?\s*F\b/g;

/** Rewrites °F temperatures in instruction text to °C, for metric display. */
export function convertInstructionTemperatures(text: string): string {
  return text.replace(FAHRENHEIT_PATTERN, (_match, degrees: string) => {
    const f = parseFloat(degrees);
    const c = ((f - 32) * 5) / 9;
    const rounded = Number.isInteger(f) ? Math.round(c) : Math.round(c * 10) / 10;
    return `${rounded}°C`;
  });
}
