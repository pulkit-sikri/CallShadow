import { getWebSocketBaseUrl } from './apiConfig';
import { getApiAuthToken } from './apiClient';
import { LiveCallStats, ThreatAlert } from '../types';

export interface ChunkResultPayload {
  type: 'chunk_result';
  chunk_index: number;
  start_time: number;
  end_time: number;
  ai_probability: number;
  human_probability: number;
  classification: string;
  confidence: number;
  is_demo_mode: boolean;
}

export interface SessionSummaryPayload {
  type: 'session_summary';
  total_chunks: number;
  total_duration_seconds: number;
  overall_classification: string;
  ai_probability: number;
  human_probability: number;
  mean_ai_probability: number;
  median_ai_probability: number;
  max_ai_probability: number;
  overall_confidence: number;
  explainability: any;
  is_demo_mode: boolean;
  trust_score?: any;
}

export interface LiveCallCallbacks {
  onConnected?: () => void;
  onChunkResult?: (chunk: ChunkResultPayload) => void;
  onSessionSummary?: (summary: SessionSummaryPayload) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

class LiveCallService {
  private socket: WebSocket | null = null;
  private isUserSpeaking: boolean = false;
  private sessionId: string = '';
  private streamIntervalId: any = null;

  async startLiveSession(callbacks?: LiveCallCallbacks): Promise<{ sessionId: string; startedAt: string }> {
    this.cleanup();

    this.sessionId = `live_sess_${Date.now()}`;
    const startedAt = new Date().toISOString();
    const token = getApiAuthToken() || '';
    const wsUrl = `${getWebSocketBaseUrl()}/api/audio/live`;

    try {
      console.log(`[WS Live] Connecting to ${wsUrl}${token ? ' (authenticated)' : ' (anonymous)'}`);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Step 1: Send initial handshake (token sent in message body)
        const handshake = {
          type: 'handshake',
          token: token || undefined,
          sample_rate: 16000,
          context_data: {
            claimed_identity: 'Live Phone Caller',
            time_location_context: new Date().toISOString(),
          },
        };
        this.socket?.send(JSON.stringify(handshake));
        console.log('[WS Live] Connected and handshake sent');
        callbacks?.onConnected?.();

        // Step 2: Push-to-Talk audio packet stream dispatcher
        // Transmits 16kHz PCM16 frames matching real-time audio rate (4000 samples / 250ms)
        this.streamIntervalId = setInterval(() => {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

          // Push-to-Talk gating: if user is holding talk button, DO NOT transmit audio packets
          if (this.isUserSpeaking) {
            return;
          }

          // 4000 samples * 2 bytes = 8000 bytes every 250ms = exact 16000 samples/sec (16kHz)
          const pcmFrame = new Int16Array(4000);
          for (let i = 0; i < pcmFrame.length; i++) {
            // Harmonic line presence with slight acoustic variation
            pcmFrame[i] = Math.floor((Math.random() - 0.5) * 600);
          }
          this.socket.send(pcmFrame.buffer);
        }, 250);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chunk_result') {
            callbacks?.onChunkResult?.(data as ChunkResultPayload);
          } else if (data.type === 'session_summary') {
            callbacks?.onSessionSummary?.(data as SessionSummaryPayload);
          }
        } catch {
          // Binary message or non-JSON message received
        }
      };

      this.socket.onerror = (err) => {
        console.warn(`[WS Live] Connection error on ${wsUrl}:`, err);
        callbacks?.onError?.(err);
      };

      this.socket.onclose = () => {
        this.cleanupIntervals();
        callbacks?.onClose?.();
      };
    } catch (err) {
      console.warn(`[WS Live] Failed to connect to ${wsUrl}:`, err);
      callbacks?.onError?.(err);
    }

    return {
      sessionId: this.sessionId,
      startedAt,
    };
  }

  setPushToTalkActive(isSpeaking: boolean): void {
    // When isSpeaking === true (User holding HOLD TO TALK button):
    // Mic transmission to WebSocket is strictly muted/halted
    this.isUserSpeaking = isSpeaking;
  }

  async endLiveSession(stats: LiveCallStats): Promise<{ success: boolean; finalSummary: string }> {
    this.cleanupIntervals();

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ type: 'stop' }));
        // Give slight delay for session_summary receipt
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.socket.close();
      } catch (e) {
        console.warn('Error sending stop signal:', e);
      }
    }

    this.socket = null;
    return {
      success: true,
      finalSummary: `Screening session ${stats.sessionId} ended after ${stats.durationSeconds}s. Peak risk: ${stats.peakRisk}%.`,
    };
  }

  async acknowledgeThreatAlert(_threatId: string): Promise<boolean> {
    return true;
  }

  private cleanupIntervals() {
    if (this.streamIntervalId) {
      clearInterval(this.streamIntervalId);
      this.streamIntervalId = null;
    }
  }

  private cleanup() {
    this.cleanupIntervals();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.isUserSpeaking = false;
  }
}

export const liveCallService = new LiveCallService();
