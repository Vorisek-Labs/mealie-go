export type GuideSection = 'recipes' | 'mealPlan' | 'shopping' | 'cookbooks' | 'settings';

interface NavLike {
  getState?: () => { routeNames: string[] } | undefined;
  getParent?: () => NavLike | undefined;
  navigate: (name: string, params?: unknown) => void;
}

/**
 * Guide lives at the root stack, above the tab navigator, so screens nested
 * inside a tab's own stack (Recipes/Shopping/Cookbooks) need to walk up
 * through parent navigators to reach it. Walking dynamically (rather than a
 * fixed number of `getParent()` calls) keeps this working regardless of how
 * deeply a given screen is nested.
 */
export function navigateToGuide(navigation: NavLike, section?: GuideSection) {
  let nav: NavLike | undefined = navigation;
  while (nav) {
    if (nav.getState?.()?.routeNames.includes('Guide')) {
      nav.navigate('Guide', { section });
      return;
    }
    nav = nav.getParent?.();
  }
}
