/**
 * PCM Processor — AudioWorklet (runs on dedicated audio thread)
 * Captures raw Float32 mic samples and posts them to main thread.
 * The main thread converts Float32 → Int16 and sends over WebSocket.
 */
class PCMProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input.length > 0 && input[0].length > 0) {
            // Clone the Float32Array so it can be transferred (zero-copy)
            const channelData = input[0];
            const copy = new Float32Array(channelData.length);
            copy.set(channelData);
            this.port.postMessage(copy.buffer, [copy.buffer]);
        }
        return true; // Keep processor alive
    }
}

registerProcessor('pcm-processor', PCMProcessor);
