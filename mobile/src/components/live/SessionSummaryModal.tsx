import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme';
import { LiveCallStats } from '../../types';
import { GradientButton } from '../common/GradientButton';

interface SessionSummaryModalProps {
  visible: boolean;
  stats: LiveCallStats;
  onDismiss: () => void;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  visible,
  stats,
  onDismiss,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isHighRisk = stats.peakRisk >= 50;
  const isModerateRisk = stats.peakRisk >= 30 && stats.peakRisk < 50;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isHighRisk
                  ? colors.riskHighLight
                  : isModerateRisk
                  ? colors.riskMediumLight
                  : colors.riskLowLight,
                borderColor: isHighRisk
                  ? 'rgba(220, 38, 38, 0.3)'
                  : isModerateRisk
                  ? 'rgba(217, 119, 6, 0.3)'
                  : 'rgba(13, 148, 136, 0.3)',
              },
            ]}
          >
            {isHighRisk ? (
              <ShieldAlert size={34} color={colors.riskHigh} />
            ) : (
              <ShieldCheck size={34} color={colors.riskLow} />
            )}
          </View>

          <Text style={styles.title}>Call Screening Debrief</Text>
          <Text style={styles.subtitle}>
            Forensic acoustic summary for live screening session
          </Text>

          {/* Verdict Badge */}
          <View
            style={[
              styles.verdictPill,
              {
                backgroundColor: isHighRisk
                  ? colors.riskHighLight
                  : isModerateRisk
                  ? colors.riskMediumLight
                  : colors.riskLowLight,
                borderColor: isHighRisk
                  ? colors.riskHigh
                  : isModerateRisk
                  ? colors.riskMedium
                  : colors.riskLow,
              },
            ]}
          >
            <Text
              style={[
                styles.verdictText,
                {
                  color: isHighRisk
                    ? colors.riskHigh
                    : isModerateRisk
                    ? colors.riskMedium
                    : colors.riskLow,
                },
              ]}
            >
              {isHighRisk
                ? 'CRITICAL SYNTHETIC RISK DETECTED'
                : isModerateRisk
                ? 'MODERATE ACOUSTIC ANOMALIES'
                : 'VERIFIED AUTHENTIC CALLER'}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Session Duration</Text>
              <Text style={styles.gridValue}>{formatTime(stats.durationSeconds)}</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Peak Risk Score</Text>
              <Text
                style={[
                  styles.gridValue,
                  {
                    color: isHighRisk
                      ? colors.riskHigh
                      : isModerateRisk
                      ? colors.riskMedium
                      : colors.riskLow,
                  },
                ]}
              >
                {stats.peakRisk}%
              </Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Caller Speech</Text>
              <Text style={styles.gridValue}>{formatTime(stats.callerSpeechSeconds)}</Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Threat Alerts</Text>
              <Text
                style={[
                  styles.gridValue,
                  { color: isHighRisk ? colors.riskHigh : colors.textPrimary },
                ]}
              >
                {stats.threatEventsCount}
              </Text>
            </View>
          </View>

          {/* Return Action */}
          <GradientButton
            title="Complete & Return to Dashboard"
            size="lg"
            variant="primary"
            icon={<CheckCircle2 size={18} color="#FFFFFF" />}
            onPress={onDismiss}
            style={styles.doneBtn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  verdictPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: 16,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  gridItem: {
    width: '48%',
    padding: 6,
  },
  gridLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  doneBtn: {
    width: '100%',
  },
});
