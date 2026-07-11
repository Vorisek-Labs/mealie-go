import type { ShoppingListItem } from '../types';
import { stripLeadingQuantityAndUnit } from './unitConversion';

// Mealie's server already auto-merges shopping list items that share a
// structured food reference (summing quantities, converting compatible
// units) whenever recipes are added — see the shopping list API. This only
// covers what that can't reach: items with no structured food link at all
// (freeform-only ingredient text), where two entries might describe the
// same thing worded differently ("2 tablespoons butter" vs "2 tbsp. butter,
// melted") and would otherwise sit far apart on the list, easy to miss.
//
// Deliberately conservative: strips the leading quantity/unit, then compares
// only the first remaining word (a rough stand-in for the food name) rather
// than full-text fuzzy matching, to avoid flagging unrelated items that
// merely share a common descriptor. This never auto-merges anything — it
// only flags items for the user to notice and combine themselves, since a
// wrong automatic merge (e.g. "butter" swallowing "peanut butter") would be
// worse than a missed one.
function guessFoodKey(item: ShoppingListItem): string | null {
  const text = (item.note ?? item.display ?? '').trim();
  if (!text) return null;

  const stripped = stripLeadingQuantityAndUnit(text).trim();
  const match = /^[a-zA-Z]+/.exec(stripped);
  if (!match) return null;

  const word = match[0].toLowerCase();
  if (word.length < 3) return null;
  return word.endsWith('s') ? word.slice(0, -1) : word;
}

/** IDs of unchecked items that share a guessed food name with at least one other unchecked item. */
export function findPossibleMatchIds(items: ShoppingListItem[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const item of items) {
    if (item.food?.id) continue; // already reliably handled server-side
    const key = guessFoodKey(item);
    if (!key) continue;
    const ids = byKey.get(key) ?? [];
    ids.push(item.id);
    byKey.set(key, ids);
  }

  const flagged = new Set<string>();
  for (const ids of byKey.values()) {
    if (ids.length > 1) ids.forEach(id => flagged.add(id));
  }
  return flagged;
}
