import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock, Mail, User as UserIcon, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { APP_ASSETS, colors } from '../theme';
import { RootStackParamList } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { TabToggle } from '../components/common/TabToggle';

type AuthScreenProps = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export const AuthScreen: React.FC<AuthScreenProps> = ({ navigation, route }) => {
  const initialTab = route.params?.initialTab || 'signIn';
  const [activeTab, setActiveTab] = useState<'signIn' | 'signUp'>(initialTab);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const { login, register, loginWithSSO, isLoading, error, clearError } = useAuthStore();

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'signIn' | 'signUp');
    clearError();
  };

  const handleSubmit = async () => {
    clearError();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (activeTab === 'signIn') {
      if (!cleanEmail || !cleanPassword) {
        useAuthStore.setState({ error: 'Please enter both your email address and password.' });
        return;
      }
      const success = await login({ email: cleanEmail, password: cleanPassword, rememberMe });
      if (success) {
        navigation.replace('Dashboard');
      }
    } else {
      const cleanName = fullName.trim();
      if (!cleanName || !cleanEmail || !cleanPassword) {
        useAuthStore.setState({ error: 'Please complete all required fields.' });
        return;
      }
      const success = await register({ fullName: cleanName, email: cleanEmail, password: cleanPassword });
      if (success) {
        navigation.replace('Dashboard');
      }
    }
  };

  const handleSSO = async (provider: 'google' | 'microsoft') => {
    clearError();
    const success = await loginWithSSO(provider);
    if (success) {
      navigation.replace('Dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Brand Header */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image
                source={APP_ASSETS.logo}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>Call</Text>
              <Text style={styles.brandTitleAccent}>Shadow</Text>
            </View>
            <Text style={styles.brandSubtitle}>Forensic AI Voice Shield</Text>
          </View>

          {/* Sign In / Sign Up Tab Switch */}
          <TabToggle
            options={[
              { key: 'signIn', label: 'Sign In' },
              { key: 'signUp', label: 'Create Account' },
            ]}
            activeKey={activeTab}
            onSelect={handleTabChange}
            style={styles.tabToggle}
          />

          {/* Form Card */}
          <GlassCard elevated style={styles.formCard}>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {activeTab === 'signUp' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <UserIcon size={18} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Alex Vance"
                    placeholderTextColor={colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="name@company.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Remember Me & Forgot Password */}
            {activeTab === 'signIn' && (
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  activeOpacity={0.8}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Submit Button */}
            <GradientButton
              title={activeTab === 'signIn' ? 'Sign In to Dashboard' : 'Create Investigator Account'}
              size="lg"
              loading={isLoading}
              onPress={handleSubmit}
              style={styles.submitBtn}
            />

            {/* SSO Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with enterprise SSO</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSO Buttons */}
            <View style={styles.ssoRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.ssoButton}
                onPress={() => handleSSO('google')}
              >
                <Text style={styles.ssoText}>Google Workspace</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.ssoButton}
                onPress={() => handleSSO('microsoft')}
              >
                <Text style={styles.ssoText}>Microsoft Azure</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {/* Quick Demo Access Bypass */}
          <TouchableOpacity
            style={styles.demoBypass}
            onPress={() => navigation.replace('Dashboard')}
          >
            <ShieldCheck size={15} color={colors.primary} />
            <Text style={styles.demoBypassText}>Instant Demo Access (Skip Login)</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoWrapper: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandTitleAccent: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  tabToggle: {
    marginBottom: 16,
  },
  formCard: {
    width: '100%',
    padding: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: colors.riskHighLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: colors.riskHigh,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  submitBtn: {
    width: '100%',
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  ssoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ssoButton: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ssoText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  demoBypass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  demoBypassText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
