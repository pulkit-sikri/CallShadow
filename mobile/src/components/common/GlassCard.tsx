import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  variant?: 'default' | 'elevated' | 'glow' | 'danger' | 'success' | 'warm';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  elevated = false,
  variant = 'default',
  ...props
}) => {
  const getGradientColors = () => {
    switch (variant) {
      case 'danger':
        return ['#FFF5F5', '#FEE2E2'];
      case 'success':
        return ['#F0FDFA', '#CCFBF1'];
      case 'glow':
      case 'warm':
        return ['#FFFDF9', '#FAF5EC'];
      case 'elevated':
        return ['#FFFFFF', '#FAF8F5'];
      default:
        return ['#FFFFFF', '#FFFFFF'];
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'danger':
        return '#FECACA';
      case 'success':
        return '#99F6E4';
      case 'glow':
      case 'warm':
        return '#F0E5D8';
      case 'elevated':
        return colors.borderLight;
      default:
        return colors.border;
    }
  };

  return (
    <LinearGradient
      colors={getGradientColors() as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.card,
        { borderColor: getBorderColor() },
        elevated ? styles.elevated : styles.standardShadow,
        style,
      ]}
      {...props}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  standardShadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
});
