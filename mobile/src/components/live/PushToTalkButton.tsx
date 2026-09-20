import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Mic, Radio, Volume2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, gradients } from '../../theme';

interface PushToTalkButtonProps {
  isUserSpeaking: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled?: boolean;
}

export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  isUserSpeaking,
  onPressIn,
  onPressOut,
  disabled = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();

    onPressIn();
  };

  const handlePressOut = () => {
    if (disabled) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();

    onPressOut();
  };

  return (
    <View style={styles.wrapper}>
      {/* Dynamic Status Indicator Header */}
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: isUserSpeaking ? colors.primaryLight : colors.riskMediumLight,
            borderColor: isUserSpeaking ? 'rgba(249, 87, 36, 0.3)' : 'rgba(217, 119, 6, 0.3)',
          },
        ]}
      >
        {isUserSpeaking ? (
          <>
            <Mic size={14} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              YOU ARE SPEAKING (ISOLATED)
            </Text>
          </>
        ) : (
          <>
            <Volume2 size={14} color={colors.warning} />
            <Text style={[styles.statusText, { color: colors.warning }]}>
              CALLER SPEAKING (SCREENING ACTIVE)
            </Text>
          </>
        )}
      </View>

      {/* Button Container */}
      <Animated.View
        style={[
          styles.buttonContainer,
          { transform: [{ scale: scaleAnim }] },
          isUserSpeaking && styles.buttonActiveShadow,
        ]}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={styles.pressable}
        >
          <LinearGradient
            colors={
              isUserSpeaking
                ? (['#FF6B2C', '#F95724'] as const)
                : (['#FFFFFF', '#F8F6F2'] as const)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.innerCircle,
              !isUserSpeaking && styles.idleBorder,
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isUserSpeaking
                    ? 'rgba(255, 255, 255, 0.2)'
                    : colors.primaryLight,
                },
              ]}
            >
              {isUserSpeaking ? (
                <Mic size={38} color="#FFFFFF" />
              ) : (
                <Radio size={36} color={colors.primary} />
              )}
            </View>

            <Text
              style={[
                styles.mainLabel,
                { color: isUserSpeaking ? '#FFFFFF' : colors.textPrimary },
              ]}
            >
              {isUserSpeaking ? 'RELEASE WHEN DONE' : 'HOLD TO TALK'}
            </Text>
            <Text
              style={[
                styles.subHint,
                { color: isUserSpeaking ? 'rgba(255, 255, 255, 0.85)' : colors.textSecondary },
              ]}
            >
              {isUserSpeaking
                ? 'Your voice is excluded from risk scan'
                : 'Hold while you speak to caller'}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  buttonActiveShadow: {
    borderColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  pressable: {
    width: '100%',
    height: '100%',
    borderRadius: 94,
    overflow: 'hidden',
  },
  innerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 94,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  idleBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mainLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  subHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
});
