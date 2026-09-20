export type SignalLabel =
  | 'Pitch Consistency'
  | 'Breathing Patterns'
  | 'Micro-Pause Analysis'
  | 'Frequency Response';

export type SignalStatus = 'authentic' | 'suspicious' | 'deepfake' | 'normal';

export interface SignalMetric {
  id: string;
  name: SignalLabel;
  score: number; // 0 - 100 (higher means more authentic / lower risk)
  status: SignalStatus;
  description: string;
  anomalyDetected: boolean;
}

export type VerdictType = 'Verified Authentic' | 'Synthetic Risk' | 'Suspicious Voice' | 'Inconclusive';

export interface AnalysisResult {
  id: string;
  fileName?: string;
  fileSize?: string;
  audioDurationSeconds: number;
  analyzedAt: string;
  riskPercentage: number; // 0 - 100
  verdict: VerdictType;
  confidenceScore: number;
  signals: SignalMetric[];
  waveformSample: number[];
  speakerProfileMatch?: number;
  reportSummary: string;
}

export interface AnalysisHistoryItem {
  id: string;
  title: string;
  sourceType: 'upload' | 'recording' | 'live_call';
  date: string;
  riskPercentage: number;
  verdict: VerdictType;
  duration: string;
}
