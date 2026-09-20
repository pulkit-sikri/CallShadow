import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react-native';
import { colors } from '../../theme';
import { SignalStatus } from '../../types';

interface SignalChipProps {
  status: SignalStatus;
  score?: number;
}

export const SignalChip: React.FC<SignalChipProps> = ({ status, score }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'authentic':
        return {
          label: 'Authentic',
          textColor: colors.riskLow,
          bgColor: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.35)',
          Icon: CheckCircle2,
        };
      case 'suspicious':
        return {
          label: 'Anomaly',
          textColor: colors.riskMedium,
          bgColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.35)',
          Icon: AlertTriangle,
        };
      case 'deepfake':
        return {
          label: 'Synthetic',
          textColor: colors.riskHigh,
          bgColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.35)',
          Icon: XCircle,
        };
      default:
        return {
          label: 'Normal',
          textColor: colors.info,
          bgColor: 'rgba(56, 189, 248, 0.12)',
          borderColor: 'rgba(56, 189, 248, 0.35)',
          Icon: ShieldCheck,
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.Icon;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      <IconComponent size={13} color={config.textColor} style={styles.icon} />
      <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
      {score !== undefined && (
        <Text style={[styles.score, { color: config.textColor }]}>
          {score}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 9999,
    borderWidth: 1,
  },
  icon: {
    marginRight: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  score: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    opacity: 0.9,
  },
});
