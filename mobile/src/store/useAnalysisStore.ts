import { create } from 'zustand';
import { analysisService } from '../services/analysisService';
import { AnalysisHistoryItem, AnalysisResult } from '../types';

interface AnalysisState {
  recentAnalyses: AnalysisHistoryItem[];
  currentResult: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  selectedSampleName: string | null;
  fetchRecentAnalyses: () => Promise<void>;
  analyzeFile: (file: { name: string; size?: string; uri?: string; type?: string }) => Promise<AnalysisResult | null>;
  analyzeRecording: (uri: string, durationSeconds: number) => Promise<AnalysisResult | null>;
  setCurrentResult: (result: AnalysisResult | null) => void;
  setSelectedSampleName: (name: string | null) => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  recentAnalyses: [],
  currentResult: null,
  isAnalyzing: false,
  error: null,
  selectedSampleName: null,

  fetchRecentAnalyses: async () => {
    try {
      const items = await analysisService.getRecentAnalyses();
      set({ recentAnalyses: items });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  analyzeFile: async (file) => {
    set({ isAnalyzing: true, error: null });
    try {
      const result = await analysisService.analyzeAudioFile(file);
      set((state) => ({
        currentResult: result,
        isAnalyzing: false,
        recentAnalyses: [
          {
            id: result.id,
            title: result.fileName || file.name,
            sourceType: 'upload',
            date: 'Just now',
            riskPercentage: result.riskPercentage,
            verdict: result.verdict,
            duration: `${result.audioDurationSeconds}s`,
          },
          ...state.recentAnalyses,
        ],
      }));
      // Sync fresh list from backend in background
      get().fetchRecentAnalyses();
      return result;
    } catch (err: any) {
      set({ isAnalyzing: false, error: err.message || 'Audio analysis failed' });
      return null;
    }
  },

  analyzeRecording: async (uri, durationSeconds) => {
    set({ isAnalyzing: true, error: null });
    try {
      const result = await analysisService.analyzeRecordedAudio(uri, durationSeconds);
      set((state) => ({
        currentResult: result,
        isAnalyzing: false,
        recentAnalyses: [
          {
            id: result.id,
            title: result.fileName || 'Live Recording',
            sourceType: 'recording',
            date: 'Just now',
            riskPercentage: result.riskPercentage,
            verdict: result.verdict,
            duration: `${durationSeconds}s`,
          },
          ...state.recentAnalyses,
        ],
      }));
      // Sync fresh list from backend in background
      get().fetchRecentAnalyses();
      return result;
    } catch (err: any) {
      set({ isAnalyzing: false, error: err.message || 'Recording analysis failed' });
      return null;
    }
  },

  setCurrentResult: (result) => set({ currentResult: result }),
  setSelectedSampleName: (name) => set({ selectedSampleName: name }),
}));
