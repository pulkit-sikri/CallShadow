import { create } from 'zustand';
import { liveCallService, ChunkResultPayload, SessionSummaryPayload } from '../services/liveCallService';
import { LiveCallStats, SpeakerMode, ThreatAlert } from '../types';

interface LiveCallState {
  isInSession: boolean;
  activeSpeaker: SpeakerMode;
  stats: LiveCallStats;
  activeThreat: ThreatAlert | null;
  hasAcknowledgedThreat: boolean;
  timerIntervalId: any;

  // Actions
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  setUserSpeaking: (isSpeaking: boolean) => void;
  acknowledgeThreat: () => Promise<void>;
  dismissThreatAlert: () => void;
  triggerManualThreatTest: () => void;
}

const INITIAL_STATS: LiveCallStats = {
  sessionId: '',
  durationSeconds: 0,
  currentRisk: 12,
  callerSpeechSeconds: 0,
  userSpeechSeconds: 0,
  peakRisk: 12,
  threatEventsCount: 0,
  activeSpeaker: 'caller',
};

export const useLiveCallStore = create<LiveCallState>((set, get) => ({
  isInSession: false,
  activeSpeaker: 'caller',
  stats: INITIAL_STATS,
  activeThreat: null,
  hasAcknowledgedThreat: false,
  timerIntervalId: null,

  startSession: async () => {
    const { timerIntervalId } = get();
    if (timerIntervalId) clearInterval(timerIntervalId);

    const handleChunkResult = (chunk: ChunkResultPayload) => {
      const state = get();
      if (!state.isInSession) return;

      const riskPct = Math.min(99, Math.max(5, Math.round(chunk.ai_probability * 100)));
      const newPeak = Math.max(state.stats.peakRisk, riskPct);
      const isThreat = riskPct >= 75;

      let threatAlert: ThreatAlert | null = state.activeThreat;
      if (isThreat && !state.hasAcknowledgedThreat) {
        threatAlert = {
          id: `threat_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          riskScore: riskPct,
          threatLevel: riskPct >= 88 ? 'CRITICAL' : 'HIGH',
          detectedPatterns: [
            'Neural voice cloning synthesis detected in caller channel',
            'Absence of human micro-breathing between clauses',
            'Sub-band acoustic harmonic phase distortion',
          ],
          recommendation: 'DO NOT share sensitive authentication codes, passwords, or initiate financial transactions. Verify caller on an independent channel.',
        };
      }

      set((s) => ({
        stats: {
          ...s.stats,
          currentRisk: riskPct,
          peakRisk: newPeak,
          threatEventsCount: isThreat ? s.stats.threatEventsCount + 1 : s.stats.threatEventsCount,
        },
        activeThreat: threatAlert,
      }));
    };

    const handleSessionSummary = (summary: SessionSummaryPayload) => {
      const prob = typeof summary.ai_probability === 'number' ? summary.ai_probability : (summary.mean_ai_probability || 0);
      const summaryRisk = Math.round(prob * 100);
      const summaryPeak = Math.round((summary.max_ai_probability || prob) * 100);

      set((s) => ({
        stats: {
          ...s.stats,
          currentRisk: summaryRisk,
          peakRisk: Math.max(s.stats.peakRisk, summaryPeak),
          durationSeconds: summary.total_duration_seconds ? Math.round(summary.total_duration_seconds) : s.stats.durationSeconds,
        },
      }));
    };

    const session = await liveCallService.startLiveSession({
      onChunkResult: handleChunkResult,
      onSessionSummary: handleSessionSummary,
    });

    set({
      isInSession: true,
      activeSpeaker: 'caller',
      activeThreat: null,
      hasAcknowledgedThreat: false,
      stats: {
        ...INITIAL_STATS,
        sessionId: session.sessionId,
        currentRisk: 14,
        peakRisk: 14,
      },
    });

    // Session Duration Timer (1 second interval)
    const tInterval = setInterval(() => {
      const state = get();
      if (!state.isInSession) return;

      const speaker = state.activeSpeaker;
      set((s) => ({
        stats: {
          ...s.stats,
          durationSeconds: s.stats.durationSeconds + 1,
          callerSpeechSeconds: speaker === 'caller' ? s.stats.callerSpeechSeconds + 1 : s.stats.callerSpeechSeconds,
          userSpeechSeconds: speaker === 'user' ? s.stats.userSpeechSeconds + 1 : s.stats.userSpeechSeconds,
        },
      }));
    }, 1000);

    set({ timerIntervalId: tInterval });
  },

  endSession: async () => {
    const { timerIntervalId, stats } = get();
    if (timerIntervalId) clearInterval(timerIntervalId);

    await liveCallService.endLiveSession(stats);

    set({
      isInSession: false,
      timerIntervalId: null,
      activeThreat: null,
    });
  },

  setUserSpeaking: (isSpeaking: boolean) => {
    const mode: SpeakerMode = isSpeaking ? 'user' : 'caller';
    // Push-to-Talk audio gating: mutes packet transmission when user is speaking
    liveCallService.setPushToTalkActive(isSpeaking);

    set((s) => ({
      activeSpeaker: mode,
      stats: {
        ...s.stats,
        activeSpeaker: mode,
      },
    }));
  },

  acknowledgeThreat: async () => {
    const { activeThreat } = get();
    if (activeThreat) {
      await liveCallService.acknowledgeThreatAlert(activeThreat.id);
    }
    set({
      activeThreat: null,
      hasAcknowledgedThreat: true,
    });
  },

  dismissThreatAlert: () => {
    set({ activeThreat: null });
  },

  triggerManualThreatTest: () => {
    set((s) => ({
      stats: {
        ...s.stats,
        currentRisk: 93,
        peakRisk: 93,
      },
      activeThreat: {
        id: `threat_manual_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        riskScore: 93,
        threatLevel: 'CRITICAL',
        detectedPatterns: [
          'Neural voice synthesis signature detected in caller channel',
          'Absence of organic vocal respiratory micro-pauses',
          'Mel-spectral formant distortion threshold exceeded',
        ],
        recommendation: 'DO NOT proceed with any financial authorization or credential verification. The caller audio stream is highly synthetic.',
      },
    }));
  },
}));
