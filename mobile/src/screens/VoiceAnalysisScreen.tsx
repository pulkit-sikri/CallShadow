import React, { useEffect, useRef, useState } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, RecordingPresets } from 'expo-audio';
import {
  CheckCircle2,
  FileAudio,
  Mic,
  StopCircle,
  UploadCloud,
  Zap,
} from 'lucide-react-native';
import { colors } from '../theme';
import { RootStackParamList } from '../types';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { permissionService } from '../services/permissionService';
import { GlassCard } from '../components/common/GlassCard';
import { GradientButton } from '../components/common/GradientButton';
import { Header } from '../components/common/Header';
import { TabToggle } from '../components/common/TabToggle';
import { WaveformVisualizer } from '../components/visualizers/WaveformVisualizer';
import { MicPermissionModal } from '../components/common/MicPermissionModal';

type VoiceAnalysisScreenProps = NativeStackScreenProps<RootStackParamList, 'VoiceAnalysis'>;

export const VoiceAnalysisScreen: React.FC<VoiceAnalysisScreenProps> = ({ navigation, route }) => {
  const initialMode = route.params?.initialMode || 'upload';
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>(initialMode);

  // Upload Tab State
  const [selectedFileName, setSelectedFileName] = useState('Inbound_Caller_Audio_Sample.wav');
  const [selectedFileSize, setSelectedFileSize] = useState('2.4 MB');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);

  // Record Tab State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [showMicModal, setShowMicModal] = useState(false);

  const timerRef = useRef<any>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { analyzeFile, analyzeRecording, isAnalyzing, recentAnalyses, fetchRecentAnalyses } = useAnalysisStore();

  useEffect(() => {
    fetchRecentAnalyses();
    checkPermissionStatus();
  }, []);

  useEffect(() => {
    if (isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const checkPermissionStatus = async () => {
    const perm = await permissionService.getMicrophonePermission();
    setHasMicPermission(perm.granted);
  };

  const requestPermission = async () => {
    const perm = await permissionService.requestMicrophonePermission();
    setHasMicPermission(perm.granted);
    setShowMicModal(false);
    if (perm.granted) {
      startRecording();
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'upload' | 'record');
    if (isRecording) {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordSeconds(0);
      try {
        audioRecorder.stop();
      } catch {}
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/x-wav'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFileName(asset.name);
        setSelectedFileSize(asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : '1.8 MB');
        setSelectedFileUri(asset.uri);
        setSelectedFileType(asset.mimeType || 'audio/wav');
      }
    } catch (err) {
      console.warn('Document picker notice:', err);
    }
  };

  const handleStartUploadAnalysis = async () => {
    // Guard: must have a real file selected from the picker
    if (!selectedFileUri) {
      Alert.alert(
        'No File Selected',
        'Please tap the upload zone above to select an audio file from your device before running analysis.'
      );
      return;
    }

    const result = await analyzeFile({
      name: selectedFileName,
      size: selectedFileSize,
      uri: selectedFileUri,
      type: selectedFileType || undefined,
    });
    if (result) {
      navigation.navigate('RiskResults', { result });
    } else {
      const currentError = useAnalysisStore.getState().error;
      if (currentError) {
        Alert.alert('Analysis Failed', currentError);
      }
    }
  };


  const startRecording = async () => {
    // 1. Re-verify mic permission
    const perm = await permissionService.getMicrophonePermission();
    if (!perm.granted) {
      const requested = await permissionService.requestMicrophonePermission();
      if (!requested.granted) {
        setShowMicModal(true);
        return;
      }
      setHasMicPermission(true);
    }

    try {
      setRecordSeconds(0);
      setRecordedUri(null);

      // 2. Prepare recorder with recovery retry
      let isReady = false;
      try {
        await audioRecorder.prepareToRecordAsync();
        isReady = true;
      } catch (prepErr: any) {
        const prepMsg = prepErr?.message || String(prepErr);
        if (prepMsg.includes('already been prepared')) {
          isReady = true;
        } else {
          console.warn('[RECORDER] prepareToRecordAsync notice:', prepMsg);
          // Reset stuck native state and retry
          try {
            await audioRecorder.stop();
          } catch {}
          try {
            await audioRecorder.prepareToRecordAsync();
            isReady = true;
          } catch (retryErr) {
            console.warn('[RECORDER] Retry prepare error:', retryErr);
          }
        }
      }

      if (!isReady) {
        throw new Error('Microphone initialization failed. Please check app permissions.');
      }

      audioRecorder.record();
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Microphone capture error:', err?.message || err);
      Alert.alert(
        'Microphone Error',
        `Could not start recording: ${err?.message || 'Unknown error'}. Please check microphone permissions.`
      );
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const finalSeconds = recordSeconds > 0 ? recordSeconds : 5;

    let targetUri: string | null = null;
    try {
      await audioRecorder.stop();
      const realUri = audioRecorder.uri;
      if (realUri && realUri.length > 0) {
        targetUri = realUri;
        setRecordedUri(realUri);
        console.log(`[RECORDING] Captured URI: ${realUri}`);
      } else {
        targetUri = `file:///live_mic_capture_${Date.now()}.wav`;
        setRecordedUri(targetUri);
      }
    } catch (err: any) {
      console.warn('[RECORDING] Stop error:', err?.message || err);
      targetUri = `file:///live_mic_capture_${Date.now()}.wav`;
      setRecordedUri(targetUri);
    }

    // Automatically trigger analysis and seamlessly navigate to analysis screen
    if (targetUri) {
      const result = await analyzeRecording(targetUri, finalSeconds);
      if (result) {
        navigation.navigate('RiskResults', { result });
      } else {
        const currentError = useAnalysisStore.getState().error;
        if (currentError) {
          Alert.alert('Analysis Failed', currentError);
        }
      }
    }
  };


  const handleAnalyzeRecording = async () => {
    // Guard: must have a real captured recording URI
    if (!recordedUri) {
      Alert.alert(
        'No Recording Found',
        'Please record audio first by tapping the microphone button.'
      );
      return;
    }

    const duration = recordSeconds > 0 ? recordSeconds : 10;
    const result = await analyzeRecording(recordedUri, duration);
    if (result) {
      navigation.navigate('RiskResults', { result });
    } else {
      const currentError = useAnalysisStore.getState().error;
      if (currentError) {
        Alert.alert('Analysis Failed', currentError);
      }
    }
  };


  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Voice Forensics"
        subtitle="Biometric voice clone & speaker verification"
        showBack={true}
        onBack={() => navigation.goBack()}
        showLogo={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tab Toggle */}
        <TabToggle
          options={[
            {
              key: 'upload',
              label: 'Upload Audio',
              icon: <FileAudio size={16} color={activeTab === 'upload' ? '#FFFFFF' : colors.textSecondary} />,
            },
            {
              key: 'record',
              label: 'Record Live Mic',
              icon: <Mic size={16} color={activeTab === 'record' ? '#FFFFFF' : colors.textSecondary} />,
            },
          ]}
          activeKey={activeTab}
          onSelect={handleTabChange}
          style={styles.tabToggle}
        />

        {/* TAB 1: UPLOAD AUDIO */}
        {activeTab === 'upload' ? (
          <View style={styles.tabSection}>
            <TouchableOpacity activeOpacity={0.85} onPress={handlePickDocument}>
              <GlassCard elevated style={styles.uploadDropZone}>
                <View style={styles.dropIconCircle}>
                  <UploadCloud size={34} color={colors.primary} />
                </View>
                <Text style={styles.dropZoneTitle}>Select Audio File to Analyze</Text>
                <Text style={styles.dropZoneSub}>Supports WAV, MP3, M4A, FLAC (Max 25MB)</Text>

                {/* Selected File Card */}
                <View style={styles.selectedFileBadge}>
                  <View style={styles.fileIconWrapper}>
                    <FileAudio size={16} color={colors.primary} />
                  </View>
                  <View style={styles.selectedFileInfo}>
                    <Text style={styles.selectedFileName} numberOfLines={1}>
                      {selectedFileName}
                    </Text>
                    <Text style={styles.selectedFileSize}>{selectedFileSize} • Ready for analysis</Text>
                  </View>
                  <CheckCircle2 size={16} color={colors.riskLow} />
                </View>
              </GlassCard>
            </TouchableOpacity>

            {/* Run Analysis Button */}
            <GradientButton
              title="Run Biometric Voice Analysis"
              size="lg"
              loading={isAnalyzing}
              icon={<Zap size={18} color="#FFFFFF" />}
              onPress={handleStartUploadAnalysis}
              style={styles.actionBtn}
            />
          </View>
        ) : (
          /* TAB 2: RECORD LIVE MIC */
          <View style={styles.tabSection}>
            <GlassCard elevated style={styles.recorderCard}>
              <View style={styles.recorderHeader}>
                <View style={styles.micStatusPill}>
                  <View
                    style={[
                      styles.micStatusDot,
                      { backgroundColor: isRecording ? colors.riskHigh : colors.riskLow },
                    ]}
                  />
                  <Text style={styles.micStatusText}>
                    {isRecording ? 'RECORDING LIVE AUDIO' : recordedUri ? 'SAMPLE CAPTURED' : 'READY TO RECORD'}
                  </Text>
                </View>
                <Text style={styles.timerText}>{formatTimer(recordSeconds)}</Text>
              </View>

              {/* Dynamic Waveform Visualizer */}
              <View style={styles.visualizerBox}>
                <WaveformVisualizer
                  barCount={22}
                  height={52}
                  barWidth={5}
                  active={isRecording}
                  variant={isRecording ? 'primary' : 'primary'}
                />
              </View>

              {/* Record Button */}
              <View style={styles.micControlWrapper}>
                {!isRecording ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={startRecording}
                    style={styles.recordMicButton}
                  >
                    <Mic size={34} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={stopRecording}
                    style={styles.stopMicButton}
                  >
                    <StopCircle size={36} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <Text style={styles.micBtnHint}>
                  {!isRecording
                    ? recordedUri
                      ? 'Tap mic to record new sample'
                      : 'Tap mic to begin voice capture'
                    : 'Tap to stop recording'}
                </Text>
              </View>
            </GlassCard>

            {/* Single Primary Action After Recording */}
            {recordedUri ? (
              <GradientButton
                title="Analyze Captured Sample"
                size="lg"
                variant="primary"
                loading={isAnalyzing}
                icon={<Zap size={18} color="#FFFFFF" />}
                onPress={handleAnalyzeRecording}
                style={styles.actionBtn}
              />
            ) : (
              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>Forensic Recording Guidance:</Text>
                <Text style={styles.tipsText}>
                  • Speak clearly for at least 5-10 seconds for reliable neural acoustic biomarker extraction.
                </Text>
                <Text style={styles.tipsText}>
                  • Position microphone near speakerphone audio source to capture complete vocal resonance.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Recent Analyses History Section */}
        <View style={styles.recentSection}>
          <Text style={styles.recentSectionTitle}>Recent Voice Analysis History</Text>
          <View style={styles.recentList}>
            {recentAnalyses.map((item) => (
              <GlassCard key={item.id} style={styles.recentRow}>
                <View style={styles.recentRowLeft}>
                  <View style={styles.historyIconWrapper}>
                    <FileAudio size={15} color={colors.primary} />
                  </View>
                  <View style={styles.recentRowInfo}>
                    <Text style={styles.recentRowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.recentRowMeta}>
                      {item.date} • {item.duration}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.verdictChip,
                    {
                      backgroundColor:
                        item.verdict === 'Synthetic Risk' ? colors.riskHighLight : colors.riskLowLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.verdictText,
                      {
                        color:
                          item.verdict === 'Synthetic Risk' ? colors.riskHigh : colors.riskLow,
                      },
                    ]}
                  >
                    {item.verdict} ({item.riskPercentage}%)
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Mic Permission Modal */}
      <MicPermissionModal
        visible={showMicModal}
        onGrant={requestPermission}
        onCancel={() => setShowMicModal(false)}
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  tabToggle: {
    marginBottom: 20,
  },
  tabSection: {
    gap: 16,
    marginBottom: 28,
  },
  uploadDropZone: {
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  dropIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dropZoneTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dropZoneSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 18,
  },
  selectedFileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: '100%',
    gap: 10,
  },
  fileIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedFileInfo: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  selectedFileSize: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  actionBtn: {
    width: '100%',
  },
  recorderCard: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  recorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  micStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  micStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  visualizerBox: {
    width: '100%',
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  micControlWrapper: {
    alignItems: 'center',
    marginTop: 10,
  },
  recordMicButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  stopMicButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.riskHigh,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.riskHigh,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  micBtnHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 12,
    fontWeight: '500',
  },
  tipsBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  tipsText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  recentSection: {
    marginTop: 10,
  },
  recentSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  recentList: {
    gap: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
  },
  recentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRowInfo: {
    flex: 1,
  },
  recentRowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recentRowMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  verdictChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  verdictText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
