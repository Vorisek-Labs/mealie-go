import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/mealieApi';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favoriteIds: Set<string>;
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string, slug: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteIds: new Set(),
  isFavorite: () => false,
  toggleFavorite: async () => {},
  refresh: async () => {},
});

export function useFavorites() {
  return useContext(FavoritesContext);
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) { setFavoriteIds(new Set()); return; }
    try {
      setFavoriteIds(await api.getFavoriteRecipeIds(user.id));
    } catch {
      // Leave the previous set in place — this is a non-critical enhancement.
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleFavorite = useCallback(async (recipeId: string, slug: string) => {
    if (!user) return;
    const wasFavorite = favoriteIds.has(recipeId);

    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(recipeId); else next.add(recipeId);
      return next;
    });

    try {
      if (wasFavorite) {
        await api.removeFavorite(user.id, slug);
      } else {
        await api.addFavorite(user.id, slug);
      }
    } catch {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (wasFavorite) next.add(recipeId); else next.delete(recipeId);
        return next;
      });
    }
  }, [user, favoriteIds]);

  const isFavorite = useCallback((recipeId: string) => favoriteIds.has(recipeId), [favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite, refresh }}>
      {children}
    </FavoritesContext.Provider>
  );
}
