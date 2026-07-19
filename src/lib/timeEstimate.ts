import i18n from '../i18n';
import type { RecipeSummary } from '../types';

type TimedRecipe = Pick<RecipeSummary, 'totalTime' | 'prepTime' | 'cookTime' | 'performTime'>;

// Mealie stores prep/cook/total time as whatever text the user (or a URL
// import) typed in — "30 minutes", "1 hr 15 min", sometimes a bare "45", or
// even an ISO 8601 duration like "PT1H30M" left over from a schema.org
// import. There's no numeric minutes field anywhere in Mealie's schema, so
// filtering by time has to work from a best-effort parse of that text.
export function parseMinutes(text?: string | null): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const iso = /^P(?:\d+D)?T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(trimmed);
  if (iso && (iso[1] || iso[2] || iso[3])) {
    const hours = parseFloat(iso[1] ?? '0');
    const minutes = parseFloat(iso[2] ?? '0');
    const seconds = parseFloat(iso[3] ?? '0');
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  const clock = /^(\d+):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed);
  if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);

  let totalMinutes = 0;
  let matchedAny = false;

  const hourMatch = /(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)\b/i.exec(trimmed);
  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1].replace(',', '.')) * 60;
    matchedAny = true;
  }

  const minMatch = /(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|m)\b/i.exec(trimmed);
  if (minMatch) {
    totalMinutes += parseFloat(minMatch[1].replace(',', '.'));
    matchedAny = true;
  }

  if (matchedAny) return Math.round(totalMinutes);

  // Mealie's own web UI accepts a bare number with no unit and treats it as minutes.
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(parseFloat(trimmed));

  return null;
}

export function estimatePrepMinutes(recipe: TimedRecipe): number | null {
  return parseMinutes(recipe.prepTime);
}

const ISO_DURATION_RE = /^P(?:\d+D)?T(?:\d+(?:\.\d+)?H)?(?:\d+(?:\.\d+)?M)?(?:\d+(?:\.\d+)?S)?$/i;

function formatMinutesAsText(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes - hours * 60);
  if (hours > 0 && mins > 0) return i18n.t('time.hrMin', { hours, minutes: mins });
  if (hours > 0) return i18n.t('time.hrOnly', { hours });
  return i18n.t('time.minOnly', { minutes: mins });
}

// A recipe-URL import is supposed to convert a scraped ISO 8601 duration
// ("PT30M") into human-readable text ("30 minutes") before saving it — but
// that conversion is known to be inconsistent upstream (Mealie issue #5232),
// so the raw ISO string sometimes ends up stored as-is. Reformat only that
// specific case; any other freeform text (which is already human-readable,
// however the user chose to phrase it) is left untouched.
export function formatTimeText(text?: string | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (ISO_DURATION_RE.test(trimmed)) {
    const minutes = parseMinutes(trimmed);
    if (minutes != null) return formatMinutesAsText(minutes);
  }
  return trimmed;
}

// The text to show for "Cook" in the UI — prefers performTime (what
// Mealie's own edit form actually writes to), falling back to the legacy
// cookTime field for recipes that only have that populated (URL imports).
export function displayCookTime(recipe: TimedRecipe): string | undefined {
  return formatTimeText(recipe.performTime) || formatTimeText(recipe.cookTime);
}

// Mealie's own edit UI writes "Cook Time" to `performTime`, not `cookTime` —
// `cookTime` is a legacy field only populated by URL-import/migration
// scrapers. Preferring performTime (with cookTime as a fallback) covers
// recipes from both sources.
export function estimateCookMinutes(recipe: TimedRecipe): number | null {
  const perform = parseMinutes(recipe.performTime);
  if (perform != null) return perform;
  return parseMinutes(recipe.cookTime);
}

// Prefers the recipe's own totalTime; falls back to prep+cook when only
// those were filled in (a common case — totalTime is a separate freeform
// field in Mealie, not auto-computed from the other two).
export function estimateTotalMinutes(recipe: TimedRecipe): number | null {
  const total = parseMinutes(recipe.totalTime);
  if (total != null) return total;

  const prep = estimatePrepMinutes(recipe);
  const cook = estimateCookMinutes(recipe);
  if (prep != null || cook != null) return (prep ?? 0) + (cook ?? 0);

  return null;
}

export interface TimeBucket {
  value: number;
  label: string;
}

// Labels say "or less" (not "under") since matchesBucket below is
// inclusive — a recipe at exactly 15 minutes matches the 15-minute bucket.
// A function, not a static const, so labels re-resolve to the current
// language on every call rather than being frozen at module-load time.
export function getTimeBuckets(): TimeBucket[] {
  return [
    { value: 15, label: i18n.t('time.bucket15') },
    { value: 30, label: i18n.t('time.bucket30') },
    { value: 60, label: i18n.t('time.bucket60') },
    { value: 120, label: i18n.t('time.bucket120') },
  ];
}

export function timeBucketLabel(maxMinutes: number): string {
  return getTimeBuckets().find(b => b.value === maxMinutes)?.label
    ?? i18n.t('time.bucketGeneric', { minutes: maxMinutes });
}

// Recipes with no parseable time are excluded from a bucket rather than
// guessed into it — there's no reliable way to know if "no time listed"
// means quick or slow.
function matchesBucket(estimateMinutes: number | null, maxMinutes?: number): boolean {
  if (!maxMinutes) return true;
  return estimateMinutes != null && estimateMinutes <= maxMinutes;
}

export function matchesPrepTimeBucket(recipe: TimedRecipe, maxMinutes?: number): boolean {
  return matchesBucket(estimatePrepMinutes(recipe), maxMinutes);
}

export function matchesCookTimeBucket(recipe: TimedRecipe, maxMinutes?: number): boolean {
  return matchesBucket(estimateCookMinutes(recipe), maxMinutes);
}
