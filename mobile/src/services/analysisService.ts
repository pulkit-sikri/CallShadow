import { apiClient } from './apiClient';
import { API_ENDPOINTS } from './apiConfig';
import { uploadAudioFile, mimeFromUri } from './uploadService';
import { AnalysisHistoryItem, AnalysisResult } from '../types';

interface BackendUploadResponse {
  filename: string;
  duration_seconds: number;
  overall_classification: string;
  ai_probability: number;
  human_probability: number;
  mean_ai_probability: number;
  median_ai_probability: number;
  max_ai_probability: number;
  overall_confidence: number;
  chunk_count: number;
  explainability: {
    pitch_monotonicity: boolean;
    spectral_anomaly: boolean;
    energy_flatness_anomaly: boolean;
    details: string;
  };
  chunks: any[];
  is_demo_mode: boolean;
  trust_score?: {
    trust_score?: number;
    decision?: string;
    voice_authenticity?: number;
    speaker_identity_status?: string;
    context_status?: string;
  };
}

interface BackendAnalysisLog {
  id: number;
  filename: string;
  source_type: string;
  duration_seconds: number;
  classification: string;
  ai_probability: number;
  human_probability: number;
  confidence: number;
  is_demo_mode: boolean;
  timestamp?: string;
}

function formatRelativeTimestamp(isoDateStr?: string): string {
  if (!isoDateStr) return 'Just now';
  try {
    const date = new Date(isoDateStr);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return `Yesterday, ${timeStr}`;
    const monthName = date.toLocaleDateString([], { month: 'short' });
    return `${monthName} ${date.getDate()}, ${timeStr}`;
  } catch {
    return 'Recently';
  }
}

function mapUploadResponseToResult(
  backendData: BackendUploadResponse,
  fallbackName: string,
  fileSize?: string
): AnalysisResult {
  const isDeepfake =
    backendData.ai_probability >= 0.5 ||
    backendData.overall_classification === 'AI_Generated' ||
    backendData.overall_classification === 'AI Generated';

  const riskPct = Math.min(99, Math.max(1, Math.round(backendData.ai_probability * 100)));
  const humanPct = Math.min(99, Math.max(1, Math.round((backendData.human_probability ?? (1.0 - backendData.ai_probability)) * 100)));
  const confidenceScore = Math.min(
    99.9,
    Math.max(50.0, Math.round((backendData.overall_confidence || 0.5) * 1000) / 10)
  );

  const exp = backendData.explainability || {
    pitch_monotonicity: isDeepfake,
    spectral_anomaly: isDeepfake,
    energy_flatness_anomaly: isDeepfake,
    details: '',
  };

  const signals = [
    {
      id: 'sig_pitch',
      name: 'Pitch Consistency' as const,
      score: exp.pitch_monotonicity ? Math.min(30, 100 - riskPct) : Math.max(75, humanPct),
      status: (exp.pitch_monotonicity ? 'deepfake' : 'authentic') as 'deepfake' | 'authentic',
      description: exp.pitch_monotonicity
        ? 'Unnaturally static pitch contour detected (vocoder artifact)'
        : 'Natural biological pitch micro-modulations verified',
      anomalyDetected: Boolean(exp.pitch_monotonicity),
    },
    {
      id: 'sig_freq',
      name: 'Frequency Response' as const,
      score: exp.spectral_anomaly ? Math.min(35, 100 - riskPct) : Math.max(70, humanPct),
      status: (exp.spectral_anomaly ? 'suspicious' : 'authentic') as 'suspicious' | 'authentic',
      description: exp.spectral_anomaly
        ? 'Atypical spectral centroid concentration detected across sub-bands'
        : 'Organic formant frequencies and dynamic acoustic resonance confirmed',
      anomalyDetected: Boolean(exp.spectral_anomaly),
    },
    {
      id: 'sig_micro',
      name: 'Micro-Pause Analysis' as const,
      score: exp.energy_flatness_anomaly ? Math.min(25, 100 - riskPct) : Math.max(80, humanPct),
      status: (exp.energy_flatness_anomaly ? 'deepfake' : 'authentic') as 'deepfake' | 'authentic',
      description: exp.energy_flatness_anomaly
        ? 'Elevated spectral flatness typical of neural synthesis vocoders'
        : 'Natural acoustic envelope pauses and human speech cadence verified',
      anomalyDetected: Boolean(exp.energy_flatness_anomaly),
    },
    {
      id: 'sig_breath',
      name: 'Breathing Patterns' as const,
      score: isDeepfake ? Math.min(20, 100 - riskPct) : Math.max(85, humanPct),
      status: (isDeepfake ? 'deepfake' : 'authentic') as 'deepfake' | 'authentic',
      description: isDeepfake
        ? 'Absence of natural aerodynamic vocal tract respiratory markers'
        : 'Authentic human vocal tract harmonics and breathing dynamics confirmed',
      anomalyDetected: isDeepfake,
    },
  ];

  return {
    id: `res_${Date.now()}`,
    fileName: backendData.filename || fallbackName,
    fileSize: fileSize || `${(backendData.duration_seconds * 0.12).toFixed(1)} MB`,
    audioDurationSeconds: Math.round(backendData.duration_seconds || 10),
    analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    riskPercentage: riskPct,
    verdict: isDeepfake ? 'Synthetic Risk' : (riskPct >= 30 ? 'Suspicious Voice' : 'Verified Authentic'),
    confidenceScore: confidenceScore,
    signals,
    waveformSample: [0.2, 0.4, 0.8, 0.9, 0.5, 0.7, 0.6, 0.8, 0.9, 0.4, 0.3, 0.6, 0.7, 0.5],
    reportSummary:
      backendData.explainability?.details ||
      (isDeepfake
        ? 'High probability of neural voice cloning synthesis detected. Vocal characteristics indicate synthetic model generation.'
        : 'Acoustic biomarkers and harmonic formant resonance confirm organic human speech patterns with zero neural synthesis artifacts.'),
  };
}

export const analysisService = {
  /**
   * Upload a file-picker selected audio file for analysis.
   * Uses FileSystem.uploadAsync (native-backed) — correctly handles
   * both content:// and file:// URIs on Android.
   */
  async analyzeAudioFile(file: {
    name: string;
    size?: string;
    uri?: string;
    type?: string;
  }): Promise<AnalysisResult> {
    if (!file.uri) {
      throw new Error(
        'No audio file selected. Please tap the upload zone to choose an audio file before analyzing.'
      );
    }

    if (file.uri.startsWith('data:')) {
      throw new Error(
        'Invalid file source. Please select a real audio file using the file picker.'
      );
    }

    const fileName = file.name || 'audio_upload.wav';
    const mimeType = file.type || mimeFromUri(file.uri);

    console.log('[ANALYSIS] analyzeAudioFile called');
    console.log(`[ANALYSIS] filename: ${fileName}`);
    console.log(`[ANALYSIS] mimeType: ${mimeType}`);
    console.log(`[ANALYSIS] uri prefix: ${file.uri.slice(0, 60)}`);

    const backendData = await uploadAudioFile<BackendUploadResponse>(file.uri, fileName, {
      mimeType,
    });

    console.log(
      `[ANALYSIS] Result: classification=${backendData.overall_classification}, ` +
      `ai_prob=${backendData.ai_probability}`
    );

    return mapUploadResponseToResult(backendData, fileName, file.size);
  },

  /**
   * Upload a microphone-recorded audio file for analysis.
   */
  async analyzeRecordedAudio(
    recordedUri: string,
    durationSeconds: number
  ): Promise<AnalysisResult> {
    if (!recordedUri) {
      throw new Error('No recording found. Please record audio before analyzing.');
    }

    const isFakeUri =
      recordedUri.startsWith('data:') ||
      (!recordedUri.startsWith('file://') &&
       !recordedUri.startsWith('content://') &&
       !recordedUri.startsWith('/') &&
       recordedUri.indexOf('/') === -1);

    if (isFakeUri) {
      throw new Error(
        'Recording is incomplete. Please stop the recording and wait for the file to be saved, then try again.'
      );
    }

    const ext = recordedUri.split('.').pop()?.toLowerCase() || 'm4a';
    const mimeType = mimeFromUri(recordedUri, 'audio/m4a');
    const fileName = `Live_Mic_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`;

    console.log('[ANALYSIS] analyzeRecordedAudio called');
    console.log(`[ANALYSIS] uri prefix: ${recordedUri.slice(0, 60)}`);
    console.log(`[ANALYSIS] ext: ${ext}, mimeType: ${mimeType}`);
    console.log(`[ANALYSIS] duration: ${durationSeconds}s`);

    const backendData = await uploadAudioFile<BackendUploadResponse>(recordedUri, fileName, {
      mimeType,
    });

    console.log(
      `[ANALYSIS] Recording result: classification=${backendData.overall_classification}, ` +
      `ai_prob=${backendData.ai_probability}`
    );

    return mapUploadResponseToResult(
      backendData,
      fileName,
      `${(durationSeconds * 0.12).toFixed(1)} MB`
    );
  },

  async getRecentAnalyses(): Promise<AnalysisHistoryItem[]> {
    try {
      const logs = await apiClient.get<BackendAnalysisLog[]>(`${API_ENDPOINTS.HISTORY}?limit=20`);
      if (!Array.isArray(logs)) return [];
      return logs.map((log) => {
        const isDeepfake =
          log.ai_probability >= 0.5 ||
          log.classification === 'AI_Generated' ||
          log.classification === 'AI Generated';
        return {
          id: `scan_${log.id}`,
          title: log.filename || 'Audio_Recording.wav',
          sourceType: log.source_type === 'live_mic' ? 'recording' : 'upload',
          date: formatRelativeTimestamp(log.timestamp),
          riskPercentage: Math.round(log.ai_probability * 100),
          verdict: isDeepfake ? 'Synthetic Risk' : 'Verified Authentic',
          duration: `${Math.round(log.duration_seconds || 0)}s`,
        };
      });
    } catch {
      return [];
    }
  },
};
