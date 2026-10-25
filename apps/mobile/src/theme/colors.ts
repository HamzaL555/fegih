export interface AppColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryContrast: string;
  secondary: string;
  accent: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
  overlay: string;
}

export const lightColors: AppColors = {
  background: '#F5F8F7',
  surface: '#FFFFFF',
  surfaceElevated: '#EAF3F1',
  text: '#102A2A',
  textMuted: '#607574',
  primary: '#0F766E',
  primaryContrast: '#FFFFFF',
  secondary: '#D7A84B',
  accent: '#B85C38',
  border: '#D5E2DF',
  success: '#218754',
  danger: '#B42318',
  warning: '#A15C00',
  overlay: 'rgba(16, 42, 42, 0.45)',
};

export const darkColors: AppColors = {
  background: '#0C1717',
  surface: '#142424',
  surfaceElevated: '#1D3331',
  text: '#F0F7F5',
  textMuted: '#A7BFBA',
  primary: '#4DB6AC',
  primaryContrast: '#06201F',
  secondary: '#E5BC68',
  accent: '#E38A68',
  border: '#294442',
  success: '#6ED19A',
  danger: '#FF8D85',
  warning: '#F1B95D',
  overlay: 'rgba(0, 0, 0, 0.6)',
};
