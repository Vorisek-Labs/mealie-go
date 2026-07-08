import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

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

export type AuthStackParams = {
  Connect: undefined;
};

export type RecipesStackParams = {
  RecipesList: undefined;
  RecipeDetail: { slug: string; name: string };
  AddRecipe: undefined;
  RecipeEdit: { slug: string; name: string };
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

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthNavigator />}
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
