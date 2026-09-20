/**
 * LiveRecognitionService — WebSocket lifecycle manager for Live Recognition.
 * Owns the connection, handshake, binary streaming, and event dispatching.
 * Deliberately separated from app.js to keep concerns isolated.
 */
class LiveRecognitionService {
    constructor() {
        this.ws = null;
        this.isConnected = false;

        // Callbacks — set by app.js before calling connect()
        this.onHandshakeAck  = null; // (ackData) => void
        this.onChunkResult   = null; // (chunkResult) => void
        this.onSessionSummary = null; // (summary) => void
        this.onError         = null; // (errorMsg) => void
        this.onClose         = null; // () => void
    }

    /**
     * Opens WebSocket to /api/audio/live and sends handshake JSON.
     * @param {string} token         - Auth token
     * @param {number} sampleRate    - AudioContext.sampleRate of the client
     * @param {string|null} speakerId - Optional enrolled speaker ID
     * @param {object} contextData   - Optional context (transaction_value, etc.)
     */
    connect(token, sampleRate, speakerId = null, contextData = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.warn('[LiveRecognitionService] Already connected.');
            return;
        }

        const baseUrl = (window.API_BASE_URL || 'http://localhost:8000').replace(/^http/, 'ws');
        const wsUrl   = `${baseUrl}/api/audio/live`;

        console.log(`[LiveRecognitionService] Connecting to ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
            console.log('[LiveRecognitionService] WebSocket open — sending handshake');
            this.isConnected = true;

            const handshake = {
                type:         'handshake',
                token:        token || '',
                sample_rate:  sampleRate,
                speaker_id:   speakerId || '',
                context_data: contextData || {}
            };
            this.ws.send(JSON.stringify(handshake));
        };

        this.ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    switch (msg.type) {
                        case 'handshake_ack':
                            console.log('[LiveRecognitionService] Handshake ACK received:', msg);
                            if (this.onHandshakeAck) this.onHandshakeAck(msg);
                            break;
                        case 'chunk_result':
                            if (this.onChunkResult) this.onChunkResult(msg);
                            break;
                        case 'session_summary':
                            console.log('[LiveRecognitionService] Session summary received:', msg);
                            if (this.onSessionSummary) this.onSessionSummary(msg);
                            break;
                        default:
                            console.log('[LiveRecognitionService] Unknown message type:', msg.type, msg);
                    }
                } catch (e) {
                    console.warn('[LiveRecognitionService] Failed to parse message:', event.data, e);
                }
            }
        };

        this.ws.onerror = (err) => {
            console.error('[LiveRecognitionService] WebSocket error:', err);
            if (this.onError) this.onError('WebSocket connection error. Ensure the backend is running.');
        };

        this.ws.onclose = (event) => {
            console.log(`[LiveRecognitionService] WebSocket closed (code=${event.code})`);
            this.isConnected = false;
            this.ws = null;
            if (this.onClose) this.onClose();
        };
    }

    /**
     * Sends a raw PCM16 ArrayBuffer chunk to the backend.
     * @param {ArrayBuffer} pcm16Buffer - Int16Array buffer
     */
    sendPCMChunk(pcm16Buffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(pcm16Buffer);
        }
    }

    /**
     * Signals the backend to finalize the session and send session_summary.
     */
    sendStop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[LiveRecognitionService] Sending stop signal');
            this.ws.send(JSON.stringify({ type: 'stop' }));
        }
    }

    /**
     * Force-closes the WebSocket. Only use on cleanup/unmount, not for normal session end.
     */
    disconnect() {
        if (this.ws) {
            this.ws.onclose = null; // Prevent onClose callback from firing on forced close
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }
}

window.liveRecognitionService = new LiveRecognitionService();
