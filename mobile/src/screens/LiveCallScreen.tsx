import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PhoneCall,
  PhoneOff,
  Zap,
} from 'lucide-react-native';
import { colors } from '../theme';
import { RootStackParamList } from '../types';
import { useLiveCallStore } from '../store/useLiveCallStore';
import { permissionService } from '../services/permissionService';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { Header } from '../components/common/Header';
import { CircularRiskGauge } from '../components/visualizers/CircularRiskGauge';
import { PushToTalkButton } from '../components/live/PushToTalkButton';
import { LiveStatsBadge } from '../components/live/LiveStatsBadge';
import { ActionRequiredModal } from '../components/live/ActionRequiredModal';
import { SessionSummaryModal } from '../components/live/SessionSummaryModal';
import { MicPermissionModal } from '../components/common/MicPermissionModal';
import { WaveformVisualizer } from '../components/visualizers/WaveformVisualizer';

type LiveCallScreenProps = NativeStackScreenProps<RootStackParamList, 'LiveCall'>;

export const LiveCallScreen: React.FC<LiveCallScreenProps> = ({ navigation }) => {
  const {
    isInSession,
    activeSpeaker,
    stats,
    activeThreat,
    startSession,
    endSession,
    setUserSpeaking,
    acknowledgeThreat,
    triggerManualThreatTest,
  } = useLiveCallStore();

  const [showMicModal, setShowMicModal] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    initSession();
    return () => {
      // Cleanup on unmount handled by store
    };
  }, []);

  const initSession = async () => {
    const perm = await permissionService.getMicrophonePermission();
    setHasMicPermission(perm.granted);
    if (perm.granted) {
      startSession();
    } else {
      setShowMicModal(true);
    }
  };

  const requestPermission = async () => {
    const perm = await permissionService.requestMicrophonePermission();
    setHasMicPermission(perm.granted);
    setShowMicModal(false);
    if (perm.granted) {
      startSession();
    }
  };

  const handleEndSession = async () => {
    await endSession();
    setShowSummaryModal(true);
  };

  const handleFinishSummary = () => {
    setShowSummaryModal(false);
    navigation.navigate('Dashboard');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Live Call Shield"
        subtitle="Real-time caller acoustic screening"
        showBack={true}
        onBack={handleEndSession}
        showLogo={true}
        rightAction={
          <View style={styles.liveCallHeaderBadge}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: stats.currentRisk >= 50 ? colors.riskHigh : colors.riskLow },
              ]}
            />
            <Text style={styles.liveBadgeText}>
              {stats.currentRisk >= 50 ? 'HIGH RISK' : 'SCREENING'}
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Session Banner */}
        <GlassCard elevated style={styles.sessionBanner}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerIconCircle}>
              <PhoneCall size={18} color={colors.primary} />
            </View>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerTitle}>Active Phone Call Screening</Text>
              <Text style={styles.bannerSub}>
                Listening to speakerphone audio • Real-time AI verification
              </Text>
            </View>
          </View>

          {/* Mini Live Waveform */}
          <View style={styles.waveformContainer}>
            <WaveformVisualizer
              barCount={26}
              height={32}
              barWidth={4}
              gap={3}
              active={isInSession}
              variant={
                activeSpeaker === 'user'
                  ? 'primary'
                  : stats.currentRisk >= 50
                  ? 'danger'
                  : 'success'
              }
            />
          </View>
        </GlassCard>

        {/* Real-time Circular Risk Gauge */}
        <View style={styles.gaugeContainer}>
          <CircularRiskGauge
            riskPercentage={stats.currentRisk}
            size={175}
            strokeWidth={13}
            sublabel="LIVE CALLER RISK"
          />
        </View>

        {/* Live Session Stats Badge */}
        <LiveStatsBadge
          durationSeconds={stats.durationSeconds}
          peakRisk={stats.peakRisk}
          threatEventsCount={stats.threatEventsCount}
        />

        {/* Large Push-to-Talk Interactive Button */}
        <PushToTalkButton
          isUserSpeaking={activeSpeaker === 'user'}
          onPressIn={() => setUserSpeaking(true)}
          onPressOut={() => setUserSpeaking(false)}
          disabled={!isInSession}
        />

        {/* Demo Threat Trigger Helper for Evaluation */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={triggerManualThreatTest}
          style={styles.demoThreatTrigger}
        >
          <Zap size={14} color={colors.primaryDark} />
          <Text style={styles.demoThreatTriggerText}>
            Simulate Deepfake Attack Spike (Demo Trigger)
          </Text>
        </TouchableOpacity>

        {/* End Session Button */}
        <View style={styles.endSessionWrapper}>
          <GradientButton
            title="End Screening Session"
            variant="danger"
            size="lg"
            icon={<PhoneOff size={20} color="#FFFFFF" />}
            onPress={handleEndSession}
            style={styles.endSessionBtn}
          />
        </View>
      </ScrollView>

      {/* Action Required High Threat Alert Modal */}
      <ActionRequiredModal
        visible={!!activeThreat}
        threat={activeThreat}
        onAcknowledge={acknowledgeThreat}
        onEndCall={handleEndSession}
      />

      {/* Session Summary Debrief Modal */}
      <SessionSummaryModal
        visible={showSummaryModal}
        stats={stats}
        onDismiss={handleFinishSummary}
      />

      {/* Microphone Permission Modal */}
      <MicPermissionModal
        visible={showMicModal}
        onGrant={requestPermission}
        onCancel={() => {
          setShowMicModal(false);
          navigation.navigate('Dashboard');
        }}
        title="Microphone Access for Live Shield"
        description="CallShadow needs microphone permission to capture incoming speaker audio and isolate caller voice signals."
      />
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
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
  },
  liveCallHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  sessionBanner: {
    width: '100%',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(249, 87, 36, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  bannerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 15,
  },
  waveformContainer: {
    paddingTop: 2,
  },
  gaugeContainer: {
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoThreatTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(249, 87, 36, 0.25)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 9999,
    marginTop: 4,
    marginBottom: 14,
  },
  demoThreatTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.2,
  },
  endSessionWrapper: {
    width: '100%',
  },
  endSessionBtn: {
    width: '100%',
  },
});
