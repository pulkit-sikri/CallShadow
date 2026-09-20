import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, ShieldAlert, Zap } from 'lucide-react-native';
import { colors } from '../../theme';
import { GlassCard } from '../common/GlassCard';

interface LiveStatsBadgeProps {
  durationSeconds: number;
  peakRisk: number;
  threatEventsCount: number;
}

export const LiveStatsBadge: React.FC<LiveStatsBadgeProps> = ({
  durationSeconds,
  peakRisk,
  threatEventsCount,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <GlassCard style={styles.statCard}>
        <View style={styles.iconRow}>
          <Clock size={14} color={colors.primary} />
          <Text style={styles.label}>Duration</Text>
        </View>
        <Text style={styles.value}>{formatTime(durationSeconds)}</Text>
      </GlassCard>

      <GlassCard style={styles.statCard}>
        <View style={styles.iconRow}>
          <Zap
            size={14}
            color={peakRisk >= 50 ? colors.riskHigh : peakRisk >= 30 ? colors.riskMedium : colors.riskLow}
          />
          <Text style={styles.label}>Peak Risk</Text>
        </View>
        <Text
          style={[
            styles.value,
            {
              color:
                peakRisk >= 50
                  ? colors.riskHigh
                  : peakRisk >= 30
                  ? colors.riskMedium
                  : colors.riskLow,
            },
          ]}
        >
          {peakRisk}%
        </Text>
      </GlassCard>

      <GlassCard style={styles.statCard}>
        <View style={styles.iconRow}>
          <ShieldAlert
            size={14}
            color={threatEventsCount > 0 ? colors.riskHigh : colors.riskLow}
          />
          <Text style={styles.label}>Threats</Text>
        </View>
        <Text
          style={[
            styles.value,
            { color: threatEventsCount > 0 ? colors.riskHigh : colors.textPrimary },
          ]}
        >
          {threatEventsCount}
        </Text>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginVertical: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
});
