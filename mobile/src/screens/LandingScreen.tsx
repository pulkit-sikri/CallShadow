import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, ShieldCheck, Zap } from 'lucide-react-native';
import { APP_ASSETS, colors } from '../theme';
import { RootStackParamList } from '../types';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { WaveformVisualizer } from '../components/visualizers/WaveformVisualizer';

interface LandingScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Landing'>;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Official Logo Display */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image
              source={APP_ASSETS.logo}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Hero Headlines */}
        <View style={styles.heroTextSection}>
          <Text style={styles.heroPreTitle}>AI VOICE FORENSICS & VERIFICATION</Text>
          <Text style={styles.heroTitleMain}>Detect AI Voices.</Text>
          <Text style={styles.heroTitleSub}>Stop Voice Fraud.</Text>
          <Text style={styles.heroSubtitle}>
            Real-time biometric acoustic screening protecting organizations and individuals from synthetic voice clones and executive impersonation.
          </Text>
        </View>

        {/* Live Acoustic Scanner Card */}
        <GlassCard elevated style={styles.waveformCard}>
          <View style={styles.waveformHeader}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ACOUSTIC NEURAL SCANNER</Text>
            </View>
            <Text style={styles.sampleFreq}>48 kHz / 24-bit</Text>
          </View>

          <WaveformVisualizer
            barCount={24}
            height={48}
            barWidth={5}
            gap={4}
            active={true}
            variant="multi"
          />

          <View style={styles.waveformFooter}>
            <Text style={styles.signalStat}>Biometric Telemetry Active</Text>
            <Text style={styles.latencyStat}>&lt; 150ms latency</Text>
          </View>
        </GlassCard>

        {/* Feature Highlights Grid */}
        <View style={styles.featuresRow}>
          <GlassCard style={styles.featureItem}>
            <ShieldCheck size={22} color={colors.primary} />
            <Text style={styles.featureTitle}>Zero-Day Clones</Text>
            <Text style={styles.featureSub}>Identifies TTS & VC neural models</Text>
          </GlassCard>

          <GlassCard style={styles.featureItem}>
            <Zap size={22} color={colors.accent} />
            <Text style={styles.featureTitle}>Live Call Shield</Text>
            <Text style={styles.featureSub}>Push-to-talk caller screening</Text>
          </GlassCard>
        </View>

        {/* Action CTAs */}
        <View style={styles.ctaSection}>
          <GradientButton
            title="Get Started"
            size="lg"
            variant="primary"
            icon={<ArrowRight size={20} color="#FFFFFF" />}
            iconPosition="right"
            onPress={() => navigation.navigate('Auth', { initialTab: 'signIn' })}
            style={styles.primaryBtn}
          />

          <GradientButton
            title="Explore Demo Dashboard"
            size="md"
            variant="secondary"
            onPress={() => navigation.navigate('Dashboard')}
            style={styles.secondaryBtn}
          />
        </View>

        {/* Footer info */}
        <Text style={styles.footerText}>
          Enterprise voice forensics • Zero audio logging
        </Text>
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
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  heroTextSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroPreTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitleMain: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  heroTitleSub: {
    fontSize: 27,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 32,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 6,
  },
  waveformCard: {
    width: '100%',
    padding: 16,
    borderRadius: 8,
    marginBottom: 14,
  },
  waveformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.riskLow,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  sampleFreq: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  waveformFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  signalStat: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
  latencyStat: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  featureItem: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 2,
  },
  featureSub: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  ctaSection: {
    width: '100%',
    gap: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    width: '100%',
  },
  secondaryBtn: {
    width: '100%',
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
