import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Mic, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme';
import { GradientButton } from './GradientButton';

interface MicPermissionModalProps {
  visible: boolean;
  onGrant: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({
  visible,
  onGrant,
  onCancel,
  title = 'Microphone Access for Live Shield',
  description = 'CallShadow requires real-time microphone access to capture incoming speaker audio and isolate vocal harmonics for AI voice clone detection.',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconCircle}>
            <Mic size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          <View style={styles.securityPill}>
            <ShieldCheck size={16} color={colors.success} />
            <Text style={styles.securityText}>
              Zero audio storage • Local biometric analysis
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <GradientButton
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.cancelBtn}
            />
            <GradientButton
              title="Grant Access"
              variant="primary"
              onPress={onGrant}
              style={styles.grantBtn}
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 28,
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
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(249, 87, 36, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.riskLowLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    gap: 6,
    marginBottom: 22,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
  },
  grantBtn: {
    flex: 1.3,
  },
});
