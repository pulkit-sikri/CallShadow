export type SpeakerMode = 'caller' | 'user';

export interface LiveCallStats {
  sessionId: string;
  durationSeconds: number;
  currentRisk: number; // 0 - 100
  callerSpeechSeconds: number;
  userSpeechSeconds: number;
  peakRisk: number;
  threatEventsCount: number;
  activeSpeaker: SpeakerMode;
}

export interface ThreatAlert {
  id: string;
  timestamp: string;
  riskScore: number;
  threatLevel: 'MODERATE' | 'HIGH' | 'CRITICAL';
  detectedPatterns: string[];
  recommendation: string;
}

export interface LiveCallSessionConfig {
  callerName?: string;
  callerNumber?: string;
  sensitivityThreshold?: number; // default 70
}
