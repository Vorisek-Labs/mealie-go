import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { getHasSeenWelcome } from '../lib/onboarding';
import { colors } from '../theme';
import type { GuideSection } from './navigateToGuide';

import ConnectScreen from '../screens/auth/ConnectScreen';
import RecipesScreen from '../screens/RecipesScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import AddRecipeScreen from '../screens/AddRecipeScreen';
import RecipeEditScreen from '../screens/RecipeEditScreen';
import MealPlanScreen from '../screens/MealPlanScreen';
import ShoppingListsScreen from '../screens/ShoppingListsScreen';
import ShoppingListDetailScreen from '../screens/ShoppingListDetailScreen';
import CookbooksScreen from '../screens/CookbooksScreen';
import CookbookDetailScreen from '../screens/CookbookDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import GuideScreen from '../screens/GuideScreen';
import RecipeSuggestionsScreen from '../screens/RecipeSuggestionsScreen';

export type AuthStackParams = {
  Connect: undefined;
};

export type RootStackParams = {
  Welcome: undefined;
  MainTabs: undefined;
  Guide: { section?: GuideSection } | undefined;
};

export type RecipesStackParams = {
  RecipesList: undefined;
  RecipeDetail: { slug: string; name: string };
  AddRecipe: undefined;
  RecipeEdit: { slug: string; name: string; autoParse?: boolean };
  RecipeSuggestions: undefined;
};

export type ShoppingStackParams = {
  ShoppingLists: undefined;
  ShoppingListDetail: { listId: string; listName: string };
};

export type CookbooksStackParams = {
  CookbooksList: undefined;
  CookbookDetail: { slug: string; name: string };
};

export type MainTabParams = {
  Recipes: undefined;
  MealPlan: undefined;
  Shopping: undefined;
  Cookbooks: undefined;
  Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const RootStack = createNativeStackNavigator<RootStackParams>();
const RecipesStack = createNativeStackNavigator<RecipesStackParams>();
const ShoppingStack = createNativeStackNavigator<ShoppingStackParams>();
const CookbooksStack = createNativeStackNavigator<CookbooksStackParams>();
const Tab = createBottomTabNavigator<MainTabParams>();

const TAB_ICONS: Record<string, string> = {
  Recipes: '🍽️',
  MealPlan: '📅',
  Shopping: '🛒',
  Cookbooks: '📖',
  Settings: '⚙️',
};

const TAB_LABELS: Record<string, string> = {
  Recipes: 'Recipes',
  MealPlan: 'Meal Plan',
  Shopping: 'Shopping',
  Cookbooks: 'Cookbooks',
  Settings: 'Settings',
};

function RecipesNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={{ headerShown: false }}>
      <RecipesStack.Screen name="RecipesList" component={RecipesScreen} />
      <RecipesStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <RecipesStack.Screen
        name="AddRecipe"
        component={AddRecipeScreen}
        options={{ presentation: 'modal' }}
      />
      <RecipesStack.Screen name="RecipeEdit" component={RecipeEditScreen} />
      <RecipesStack.Screen name="RecipeSuggestions" component={RecipeSuggestionsScreen} />
    </RecipesStack.Navigator>
  );
}

function ShoppingNavigator() {
  return (
    <ShoppingStack.Navigator screenOptions={{ headerShown: false }}>
      <ShoppingStack.Screen name="ShoppingLists" component={ShoppingListsScreen} />
      <ShoppingStack.Screen name="ShoppingListDetail" component={ShoppingListDetailScreen} />
    </ShoppingStack.Navigator>
  );
}

function CookbooksNavigator() {
  return (
    <CookbooksStack.Navigator screenOptions={{ headerShown: false }}>
      <CookbooksStack.Screen name="CookbooksList" component={CookbooksScreen} />
      <CookbooksStack.Screen name="CookbookDetail" component={CookbookDetailScreen} />
    </CookbooksStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
            {TAB_ICONS[route.name] ?? '●'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Recipes" component={RecipesNavigator} />
      <Tab.Screen name="MealPlan" component={MealPlanScreen} />
      <Tab.Screen name="Shopping" component={ShoppingNavigator} />
      <Tab.Screen name="Cookbooks" component={CookbooksNavigator} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Connect" component={ConnectScreen} />
    </AuthStack.Navigator>
  );
}

function AuthedNavigator({ initialRouteName }: { initialRouteName: 'Welcome' | 'MainTabs' }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <RootStack.Screen name="Welcome" component={WelcomeScreen} />
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen name="Guide" component={GuideScreen} options={{ presentation: 'modal' }} />
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading, justSignedIn } = useAuth();
  const [hasSeenWelcome, setHasSeenWelcomeState] = useState<boolean | null>(null);

  useEffect(() => { getHasSeenWelcome().then(setHasSeenWelcomeState); }, []);

  if (loading || (user && hasSeenWelcome === null)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Welcome only ever shows immediately after an explicit sign-in (never for
  // a session auto-restored from a saved token), and only until it's been
  // seen once, ever, on this device.
  const showWelcome = justSignedIn && !hasSeenWelcome;

  return (
    <NavigationContainer>
      {user
        ? <AuthedNavigator initialRouteName={showWelcome ? 'Welcome' : 'MainTabs'} />
        : <AuthNavigator />
      }
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
