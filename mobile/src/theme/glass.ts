import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const glass = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardElevated: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.borderLight,
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  pill: {
    borderRadius: 9999,
    borderWidth: 1,
  },
  input: {
    backgroundColor: colors.backgroundInput,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    color: colors.textPrimary,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
});
