import React, { useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowRight,
  FileAudio,
  LogOut,
  Mic,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Zap,
  History,
  Clock,
} from 'lucide-react-native';
import { colors } from '../theme';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { Header } from '../components/common/Header';

type DashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const { recentAnalyses, fetchRecentAnalyses } = useAnalysisStore();

  useEffect(() => {
    fetchRecentAnalyses();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to end your current forensic session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Auth');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        showLogo={true}
        showBack={false}
        logoSize={38}
        rightAction={
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.8}
            onPress={handleLogout}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LogOut size={15} color={colors.textPrimary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome & Overview Card */}
        <GlassCard elevated style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeTextGroup}>
              <Text style={styles.welcomeGreeting}>Security Overview Dashboard</Text>
              <View style={styles.welcomeUserRow}>
                <Text style={styles.welcomePrefix}>Welcome back, </Text>
                <Text style={styles.userName}>{user?.fullName || 'John Doe'}</Text>
              </View>
              <Text style={styles.userRole}>
                {user?.organization || 'Cyber Security Taskforce'}
              </Text>
            </View>
            <View style={styles.systemStatusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.systemStatusText}>Neural Pipeline Online</Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.quickMetricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Analyses</Text>
              <Text style={styles.metricNum}>148</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>AI Voices</Text>
              <Text style={[styles.metricNum, { color: colors.primary }]}>38</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Verified</Text>
              <Text style={[styles.metricNum, { color: colors.riskLow }]}>110</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Trust Score</Text>
              <Text style={[styles.metricNum, { color: colors.primaryDark }]}>82%</Text>
            </View>
          </View>
        </GlassCard>

        {/* Primary Action Section */}
        <Text style={styles.sectionHeaderTitle}>Core Forensics Operations</Text>

        <View style={styles.actionCardsContainer}>
          {/* Action 1: Upload Audio */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VoiceAnalysis', { initialMode: 'upload' })}
          >
            <GlassCard style={styles.actionCard}>
              <View style={styles.actionIconCircle}>
                <FileAudio size={22} color={colors.primary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Upload Audio File</Text>
                <Text style={styles.actionDesc}>
                  Analyze recorded WAV, MP3, or M4A for synthetic cloning artifacts
                </Text>
              </View>
              <ArrowRight size={18} color={colors.textSecondary} />
            </GlassCard>
          </TouchableOpacity>

          {/* Action 2: Record Live Audio */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VoiceAnalysis', { initialMode: 'record' })}
          >
            <GlassCard style={styles.actionCard}>
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Mic size={22} color={colors.primary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Record Audio Sample</Text>
                <Text style={styles.actionDesc}>
                  Capture live speaker speech directly with real-time acoustic analysis
                </Text>
              </View>
              <ArrowRight size={18} color={colors.textSecondary} />
            </GlassCard>
          </TouchableOpacity>

          {/* Action 3: Live Call Screening */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('LiveCall')}
          >
            <GlassCard elevated style={styles.liveCallHighlightCard}>
              <View style={styles.liveBadgeRow}>
                <View style={styles.pulsingBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveBadgeText}>REAL-TIME SCREENING</Text>
                </View>
                <Text style={styles.tagNew}>LIVE SHIELD</Text>
              </View>

              <View style={styles.liveCallContentRow}>
                <View style={styles.liveCallIconCircle}>
                  <PhoneCall size={22} color="#FFFFFF" />
                </View>
                <View style={styles.liveCallInfo}>
                  <Text style={styles.liveCallTitle}>Live Call Screening</Text>
                  <Text style={styles.liveCallDesc}>
                    Continuous speaker verification during active phone calls with push-to-talk isolation
                  </Text>
                </View>
              </View>

              <GradientButton
                title="Launch Live Call Shield"
                size="md"
                variant="primary"
                icon={<Zap size={16} color="#FFFFFF" />}
                onPress={() => navigation.navigate('LiveCall')}
                style={styles.liveLaunchBtn}
              />
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Recent Detections List */}
        <View style={styles.recentSectionHeader}>
          <View style={styles.recentTitleGroup}>
            <History size={17} color={colors.textSecondary} />
            <Text style={styles.recentSectionTitle}>Recent Detections</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('VoiceAnalysis', { initialMode: 'upload' })}
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {recentAnalyses.slice(0, 3).map((item) => {
            const isHighRisk = item.riskPercentage >= 50 || item.verdict === 'Synthetic Risk';
            return (
              <GlassCard key={item.id} style={styles.recentItemCard}>
                <View style={styles.recentItemLeft}>
                  <View
                    style={[
                      styles.recentTypeIcon,
                      {
                        backgroundColor: isHighRisk
                          ? colors.riskHighLight
                          : colors.riskLowLight,
                      },
                    ]}
                  >
                    {isHighRisk ? (
                      <ShieldAlert size={17} color={colors.riskHigh} />
                    ) : (
                      <ShieldCheck size={17} color={colors.riskLow} />
                    )}
                  </View>
                  <View style={styles.recentItemInfo}>
                    <Text style={styles.recentItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.recentItemMeta}>
                      <Clock size={11} color={colors.textMuted} />
                      <Text style={styles.recentItemDate}>{item.date}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.recentItemDuration}>{item.duration}</Text>
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.riskPill,
                    {
                      backgroundColor: isHighRisk
                        ? colors.riskHighLight
                        : colors.riskLowLight,
                      borderColor: isHighRisk
                        ? '#FECACA'
                        : '#99F6E4',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.riskPillText,
                      { color: isHighRisk ? colors.riskHigh : colors.riskLow },
                    ]}
                  >
                    {item.riskPercentage}%
                  </Text>
                </View>
              </GlassCard>
            );
          })}
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
    paddingTop: 14,
    paddingBottom: 40,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  welcomeCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  welcomeTextGroup: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  welcomeUserRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  welcomePrefix: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
  },
  userRole: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  systemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.riskLowLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.riskLow,
  },
  systemStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.riskLow,
    letterSpacing: 0.4,
  },
  quickMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metricNum: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  actionCardsContainer: {
    gap: 10,
    marginBottom: 22,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(249, 87, 36, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
    paddingRight: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  liveCallHighlightCard: {
    padding: 16,
    borderRadius: 8,
    borderColor: 'rgba(249, 87, 36, 0.35)',
    borderWidth: 1.5,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pulsingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9999,
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  tagNew: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  liveCallContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveCallIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  liveCallInfo: {
    flex: 1,
  },
  liveCallTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  liveCallDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  liveLaunchBtn: {
    width: '100%',
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recentTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  viewAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  recentList: {
    gap: 8,
  },
  recentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  recentTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recentItemInfo: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  recentItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentItemDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaDot: {
    fontSize: 10,
    color: colors.textMuted,
  },
  recentItemDuration: {
    fontSize: 10,
    color: colors.textMuted,
  },
  riskPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
