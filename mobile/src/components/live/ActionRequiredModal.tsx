import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { AlertOctagon, CheckCircle2, PhoneOff, ShieldAlert } from 'lucide-react-native';
import { colors } from '../../theme';
import { ThreatAlert } from '../../types';
import { GradientButton } from '../common/GradientButton';

interface ActionRequiredModalProps {
  threat: ThreatAlert | null;
  visible: boolean;
  onAcknowledge: () => void;
  onEndCall: () => void;
}

export const ActionRequiredModal: React.FC<ActionRequiredModalProps> = ({
  threat,
  visible,
  onAcknowledge,
  onEndCall,
}) => {
  if (!threat) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onAcknowledge}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header Warning Badge */}
          <View style={styles.warningHeader}>
            <View style={styles.iconCircle}>
              <AlertOctagon size={34} color={colors.riskHigh} />
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>ACTION REQUIRED</Text>
            </View>
          </View>

          <Text style={styles.title}>Synthetic Voice Threat Detected</Text>
          <Text style={styles.subtitle}>
            Live acoustic analysis has identified deepfake voice synthesis patterns in the caller's audio stream.
          </Text>

          {/* Risk Level Callout */}
          <View style={styles.riskCallout}>
            <Text style={styles.riskScoreText}>
              {threat.riskScore}% <Text style={styles.riskLabel}>Synthetic Probability</Text>
            </Text>
            <Text style={styles.threatLevelText}>Severity: {threat.threatLevel}</Text>
          </View>

          {/* Anomaly Indicators */}
          <View style={styles.patternsContainer}>
            <Text style={styles.patternsTitle}>Detected Anomaly Vectors:</Text>
            {threat.detectedPatterns.map((pattern, idx) => (
              <View key={idx} style={styles.patternRow}>
                <ShieldAlert size={14} color={colors.riskHigh} />
                <Text style={styles.patternText}>{pattern}</Text>
              </View>
            ))}
          </View>

          {/* Security Advisory */}
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationTitle}>Security Advisory:</Text>
            <Text style={styles.recommendationText}>{threat.recommendation}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            <GradientButton
              title="Terminate Call Immediately"
              variant="danger"
              icon={<PhoneOff size={18} color="#FFFFFF" />}
              onPress={onEndCall}
              style={styles.terminateBtn}
            />
            <GradientButton
              title="Acknowledge & Continue Screening"
              variant="secondary"
              icon={<CheckCircle2 size={18} color={colors.textPrimary} />}
              onPress={onAcknowledge}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.riskHighLight,
    borderWidth: 1.5,
    borderColor: colors.riskHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgePill: {
    backgroundColor: colors.riskHigh,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 9999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 14,
  },
  riskCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.riskHighLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  riskScoreText: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.riskHigh,
  },
  riskLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  threatLevelText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.riskHigh,
  },
  patternsContainer: {
    marginBottom: 12,
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patternsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  patternText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  recommendationBox: {
    backgroundColor: colors.riskMediumLight,
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    marginBottom: 16,
  },
  recommendationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warning,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  recommendationText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
  },
  buttonStack: {
    gap: 8,
  },
  terminateBtn: {
    width: '100%',
  },
});
