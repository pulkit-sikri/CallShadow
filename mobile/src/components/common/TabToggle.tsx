import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme';

export interface TabOption {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabToggleProps {
  options: TabOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  style?: ViewStyle;
}

export const TabToggle: React.FC<TabToggleProps> = ({
  options,
  activeKey,
  onSelect,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = option.key === activeKey;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.8}
            onPress={() => onSelect(option.key)}
            style={styles.tab}
          >
            {isActive ? (
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeBackground}
              >
                {option.icon && <View style={styles.icon}>{option.icon}</View>}
                <Text style={styles.activeText}>{option.label}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.inactiveBackground}>
                {option.icon && <View style={styles.icon}>{option.icon}</View>}
                <Text style={styles.inactiveText}>{option.label}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  activeBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  inactiveBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  icon: {
    marginRight: 6,
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  inactiveText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
