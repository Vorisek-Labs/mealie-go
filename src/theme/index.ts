export const colors = {
  background: '#0F0D0A',
  surface: '#1A1510',
  surfaceElevated: '#251C14',

  primary: '#E87830',
  primaryLight: '#F09850',
  primaryDark: '#C45C18',

  accent: '#4E9E8C',

  success: '#5BA07A',
  warning: '#F0B429',
  error: '#E05D5D',

  textPrimary: '#F4F0EC',
  textSecondary: '#9A8070',
  textDisabled: '#52403A',
  textInverse: '#0F0D0A',

  border: '#2A1E14',
  borderLight: '#382818',

  tabBar: '#130E0A',
  tabBarActive: '#E87830',
  tabBarInactive: '#4A3428',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    display: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
