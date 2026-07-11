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

const UNIT_KEYS = Object.keys(UNIT_TABLE).sort((a, b) => b.length - a.length);

function formatNumber(qty: number): string {
  if (qty === Math.floor(qty)) return String(Math.floor(qty));
  return parseFloat(qty.toFixed(2)).toString();
}

// Looks for one of UNIT_TABLE's keys (longest first, so "fl oz" matches
// before a bare "oz" would) right at the start of `text`, allowing for a
// plural "s" and a trailing period. Returns the matched substring's length
// so the caller can splice it out, plus the unit definition itself.
function matchUnitAtStart(text: string): { length: number; def: UnitDef } | null {
  const leadingWs = text.length - text.replace(/^\s+/, '').length;
  const trimmed = text.slice(leadingWs);
  for (const key of UNIT_KEYS) {
    // A trailing period isn't itself a word boundary when followed by a
    // space ("tbsp. butter" -- the "." to " " transition is non-word-to-
    // non-word, so \b fails right after it) -- so the period is matched as
    // an explicit alternative to requiring \b, not in addition to it.
    const re = new RegExp(`^${key.replace(/\s+/g, '\\s+')}s?(?:\\.|\\b)`, 'i');
    const m = re.exec(trimmed);
    if (m) return { length: leadingWs + m[0].length, def: UNIT_TABLE[key] };
  }
  return null;
}

// Best-effort scaling (and, when requested, metric conversion) for
// ingredients with no structured quantity/unit to work with — common on
// imported recipes where the amount ended up embedded in freeform text
// instead of being parsed out into separate fields. Scales a leading number
// in the text itself ("4 lobster tails" -> "8 lobster tails"), and when
// `convertUnits` is true and a recognized unit word immediately follows that
// number ("2 tsp salt"), converts both together ("2 tsp salt" -> "10 ml
// salt"). Recognizes a mixed number ("1 1/2"), a simple fraction ("1/2"), or
// a plain integer/decimal at the very start of the string; anything else (no
// leading number, or a range like "4-6") is left as-is.
export function scaleFreeformIngredientText(text: string, scale: number, convertUnits: boolean): string {
  if (!text) return text;

  let match = /^(\d+)\s+(\d+)\/(\d+)\b/.exec(text);
  let value: number;
  let rest: string;
  if (match) {
    value = parseInt(match[1], 10) + parseInt(match[2], 10) / parseInt(match[3], 10);
    rest = text.slice(match[0].length);
  } else if ((match = /^(\d+)\/(\d+)\b/.exec(text))) {
    value = parseInt(match[1], 10) / parseInt(match[2], 10);
    rest = text.slice(match[0].length);
  } else if ((match = /^(\d+(?:\.\d+)?)\b/.exec(text))) {
    value = parseFloat(match[1]);
    rest = text.slice(match[0].length);
  } else {
    return text;
  }

  const scaledValue = value * scale;

  if (convertUnits) {
    const unitHit = matchUnitAtStart(rest);
    if (unitHit) {
      const base = scaledValue * unitHit.def.toBase;
      const converted = unitHit.def.dimension === 'volume'
        ? (base >= 1000 ? { quantity: roundNice(base / 1000), unitLabel: 'l' } : { quantity: roundNice(base), unitLabel: 'ml' })
        : (base >= 1000 ? { quantity: roundNice(base / 1000), unitLabel: 'kg' } : { quantity: roundNice(base), unitLabel: 'g' });
      return `${formatNumber(converted.quantity)} ${converted.unitLabel}${rest.slice(unitHit.length)}`;
    }
  }

  return formatNumber(scaledValue) + rest;
}

// Strips a leading quantity (mixed number, fraction, or integer/decimal)
// and, if one immediately follows, a recognized unit word — leaving just
// the food description behind ("2 tbsp. butter, melted" -> "butter,
// melted"). Used for a conservative "might be the same food" check on
// shopping list items with no structured food link (see
// src/lib/shoppingMatch.ts) — deliberately not exported for scaling
// purposes since it discards the number entirely.
export function stripLeadingQuantityAndUnit(text: string): string {
  if (!text) return text;

  let rest: string | null = null;
  let match = /^(\d+)\s+(\d+)\/(\d+)\b/.exec(text);
  if (match) {
    rest = text.slice(match[0].length);
  } else if ((match = /^(\d+)\/(\d+)\b/.exec(text))) {
    rest = text.slice(match[0].length);
  } else if ((match = /^(\d+(?:\.\d+)?)\b/.exec(text))) {
    rest = text.slice(match[0].length);
  }
  if (rest == null) return text;

  const unitHit = matchUnitAtStart(rest);
  return unitHit ? rest.slice(unitHit.length) : rest;
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
