import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme';

interface WaveformVisualizerProps {
  barCount?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  active?: boolean;
  color?: string;
  style?: ViewStyle;
  variant?: 'primary' | 'danger' | 'success' | 'multi';
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  barCount = 18,
  height = 40,
  barWidth = 4,
  gap = 3,
  active = true,
  color,
  style,
  variant = 'primary',
}) => {
  const animatedValues = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!active) {
      animatedValues.forEach((val) => {
        Animated.timing(val, {
          toValue: 0.15,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    const animations = animatedValues.map((anim, index) => {
      const randomDuration = 350 + (index % 5) * 120;
      const randomTarget = 0.35 + Math.sin(index * 0.8) * 0.45 + Math.random() * 0.2;

      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.min(1, Math.max(0.15, randomTarget)),
            duration: randomDuration,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.15 + (index % 3) * 0.1,
            duration: randomDuration * 0.9,
            useNativeDriver: false,
          }),
        ])
      );
    });

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [active, barCount]);

  const getBarColor = (index: number) => {
    if (color) return color;
    if (variant === 'danger') return colors.riskHigh;
    if (variant === 'success') return colors.riskLow;
    if (variant === 'multi') {
      const ratio = index / barCount;
      if (ratio < 0.4) return colors.primary;
      if (ratio < 0.7) return colors.primaryEnd;
      return colors.accent;
    }
    return colors.primary;
  };

  return (
    <View style={[styles.container, { height }, style]}>
      {animatedValues.map((anim, index) => {
        const barHeight = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [4, height],
        });

        return (
          <Animated.View
            key={`bar_${index}`}
            style={[
              styles.bar,
              {
                width: barWidth,
                marginHorizontal: gap / 2,
                height: barHeight,
                backgroundColor: getBarColor(index),
                opacity: active ? 0.95 : 0.3,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bar: {
    borderRadius: 999,
  },
});
