export const colors = {
  // Backgrounds - Warm Off-White / Cream
  background: '#F8F6F2',           // Warm off-white / light cream base
  backgroundSecondary: '#F1ECE4',  // Soft warm light beige
  backgroundElevated: '#FFFFFF',   // Pure crisp white card surface
  backgroundCard: '#FFFFFF',       // Card surface
  backgroundCardHover: '#FAF7F3',  // Hover / active card surface
  backgroundInput: '#F5F2EC',      // Input fields
  backgroundMuted: '#EAE4D9',      // Badges / inactive tracks

  // Borders - Soft Warm Grays
  border: '#E8E1D7',
  borderLight: '#F0EAE1',
  borderActive: '#F95724',
  borderFocus: '#FF6B2C',

  // Brand Accents - Vibrant Enterprise Orange (from website)
  primary: '#F95724',              // Primary vibrant orange
  primaryEnd: '#FF6B2C',           // Secondary warm orange
  primaryDark: '#D84315',          // Burnt orange / pressed
  primaryLight: '#FFF2EB',         // Orange tint / highlight bg
  accent: '#F97316',               // Bright orange
  accentGlow: 'rgba(249, 87, 36, 0.12)',

  // Risk Spectrum (Enterprise Security Palette)
  riskLow: '#0D9488',              // Verified Authentic (Teal/Emerald)
  riskLowLight: '#E6FFFA',
  riskLowGlow: 'rgba(13, 148, 136, 0.15)',

  riskMedium: '#D97706',           // Suspicious / Moderate (Amber)
  riskMediumLight: '#FEF3C7',
  riskMediumGlow: 'rgba(217, 119, 6, 0.15)',

  riskHigh: '#DC2626',             // High / Synthetic Deepfake (Crimson)
  riskHighLight: '#FEE2E2',
  riskHighGlow: 'rgba(220, 38, 38, 0.15)',

  // Text Hierarchy - Dark Navy / Charcoal
  textPrimary: '#0F172A',          // Dark navy / near black
  textSecondary: '#475569',        // Muted slate gray
  textMuted: '#94A3B8',            // Subtle hint / caption
  textDark: '#020617',             // Pure dark contrast
  textOnPrimary: '#FFFFFF',        // White text on orange buttons

  // Status & Utility
  success: '#0D9488',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0284C7',

  // Shadows
  shadow: '#1E1208',
};

export const gradients = {
  primary: ['#FF6B2C', '#F95724'] as const,
  primaryWarm: ['#F95724', '#D84315'] as const,
  card: ['#FFFFFF', '#FFFFFF'] as const,
  cardElevated: ['#FFFFFF', '#FAF8F5'] as const,
  cardWarmTint: ['#FFFDF9', '#FAF5EC'] as const,
  danger: ['#EF4444', '#DC2626'] as const,
  safe: ['#10B981', '#0D9488'] as const,
  amber: ['#F59E0B', '#D97706'] as const,
};
