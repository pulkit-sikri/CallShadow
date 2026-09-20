import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FileCheck,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../theme';
import { RootStackParamList } from '../types';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { Header } from '../components/common/Header';
import { CircularRiskGauge } from '../components/visualizers/CircularRiskGauge';
import { SignalBreakdownList } from '../components/analysis/SignalBreakdownList';

type RiskResultsScreenProps = NativeStackScreenProps<RootStackParamList, 'RiskResults'>;

export const RiskResultsScreen: React.FC<RiskResultsScreenProps> = ({ navigation, route }) => {
  const { result } = route.params;
  const isDeepfake = result.verdict === 'Synthetic Risk' || result.riskPercentage >= 50;
  const isSuspicious = !isDeepfake && (result.verdict === 'Suspicious Voice' || result.riskPercentage >= 30);

  const verdictTitle = isDeepfake
    ? 'Synthetic Risk Detected'
    : isSuspicious
    ? 'Suspicious Voice Anomaly'
    : 'Verified Authentic';

  const verdictGaugeText = isDeepfake
    ? 'SYNTHETIC RISK DETECTED'
    : isSuspicious
    ? 'SUSPICIOUS ANOMALY'
    : 'VERIFIED AUTHENTIC';

  const cardVariant = isDeepfake ? 'danger' : isSuspicious ? 'warm' : 'success';
  const cardBorderColor = isDeepfake ? '#FECACA' : isSuspicious ? '#FEF08A' : '#99F6E4';
  const cardBgColor = isDeepfake ? colors.riskHighLight : isSuspicious ? colors.riskMediumLight : colors.riskLowLight;
  const statusColor = isDeepfake ? colors.riskHigh : isSuspicious ? colors.riskMedium : colors.riskLow;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Forensic Evaluation"
        subtitle="Biometric voice authenticity verdict"
        showBack={true}
        onBack={() => navigation.navigate('Dashboard')}
        showLogo={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Verdict Card with Circular Risk Gauge */}
        <GlassCard
          elevated
          variant={cardVariant}
          style={styles.gaugeCard}
        >
          {/* Sample Metadata Info */}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <FileCheck size={16} color={colors.textSecondary} />
              <Text style={styles.metaFileName} numberOfLines={1}>
                {result.fileName || 'Audio_Forensic_Sample.wav'}
              </Text>
            </View>
            <Text style={styles.metaTime}>{result.analyzedAt}</Text>
          </View>

          {/* Central Circular Gauge */}
          <View style={styles.gaugeWrapper}>
            <CircularRiskGauge
              riskPercentage={result.riskPercentage}
              size={210}
              strokeWidth={15}
              verdictText={verdictGaugeText}
            />
          </View>

          {/* Verdict Description Summary */}
          <View
            style={[
              styles.verdictSummaryBox,
              {
                borderColor: cardBorderColor,
                backgroundColor: cardBgColor,
              },
            ]}
          >
            <View style={styles.verdictIconRow}>
              {isDeepfake ? (
                <ShieldAlert size={20} color={colors.riskHigh} />
              ) : isSuspicious ? (
                <AlertTriangle size={20} color={colors.riskMedium} />
              ) : (
                <ShieldCheck size={20} color={colors.riskLow} />
              )}
              <Text
                style={[
                  styles.verdictTitle,
                  { color: statusColor },
                ]}
              >
                {verdictTitle} ({result.confidenceScore}% Confidence)
              </Text>
            </View>
            <Text style={styles.verdictDesc}>{result.reportSummary}</Text>
          </View>
        </GlassCard>

        {/* Acoustic Forensic Signal Breakdown */}
        {result.signals && result.signals.length > 0 && (
          <View style={styles.signalsContainer}>
            <SignalBreakdownList signals={result.signals} />
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionButtonsContainer}>
          <GradientButton
            title="Scan Another Audio Sample"
            size="lg"
            variant="primary"
            icon={<RotateCcw size={18} color="#FFFFFF" />}
            onPress={() => navigation.navigate('VoiceAnalysis')}
            style={styles.newAnalysisBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  gaugeCard: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 10,
  },
  metaFileName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
  },
  metaTime: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  gaugeWrapper: {
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictSummaryBox: {
    width: '100%',
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 14,
  },
  verdictIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  verdictTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  verdictDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  signalsContainer: {
    marginBottom: 20,
    width: '100%',
  },
  actionButtonsContainer: {
    marginTop: 10,
  },
  newAnalysisBtn: {
    width: '100%',
  },
});
