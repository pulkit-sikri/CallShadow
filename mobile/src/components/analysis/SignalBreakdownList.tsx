import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Activity, Wind, PauseCircle, Radio } from 'lucide-react-native';
import { colors } from '../../theme';
import { SignalMetric } from '../../types';
import { GlassCard } from '../common/GlassCard';
import { SignalChip } from './SignalChip';

interface SignalBreakdownListProps {
  signals: SignalMetric[];
}

export const SignalBreakdownList: React.FC<SignalBreakdownListProps> = ({ signals }) => {
  const getSignalIcon = (name: string) => {
    switch (name) {
      case 'Pitch Consistency':
        return <Activity size={18} color={colors.primary} />;
      case 'Breathing Patterns':
        return <Wind size={18} color={colors.info} />;
      case 'Micro-Pause Analysis':
        return <PauseCircle size={18} color={colors.accent} />;
      case 'Frequency Response':
        return <Radio size={18} color={colors.primaryEnd} />;
      default:
        return <Activity size={18} color={colors.primary} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Acoustic Signal Breakdown</Text>
        <Text style={styles.sectionSubtitle}>4 Vector Neural Forensics</Text>
      </View>

      <View style={styles.list}>
        {signals.map((signal) => (
          <GlassCard key={signal.id} style={styles.signalCard}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <View style={styles.iconContainer}>{getSignalIcon(signal.name)}</View>
                <Text style={styles.signalName}>{signal.name}</Text>
              </View>
              <SignalChip status={signal.status} score={signal.score} />
            </View>

            <Text style={styles.description}>{signal.description}</Text>

            {/* Progress bar visualizer */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${signal.score}%`,
                    backgroundColor:
                      signal.status === 'authentic'
                        ? colors.riskLow
                        : signal.status === 'suspicious'
                        ? colors.riskMedium
                        : colors.riskHigh,
                  },
                ]}
              />
            </View>
          </GlassCard>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    gap: 10,
  },
  signalCard: {
    padding: 14,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  signalName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
});
