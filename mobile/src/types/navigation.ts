import { AnalysisResult } from './analysis';

export type RootStackParamList = {
  Landing: undefined;
  Auth: { initialTab?: 'signIn' | 'signUp' } | undefined;
  Dashboard: undefined;
  VoiceAnalysis: { initialMode?: 'upload' | 'record' } | undefined;
  RiskResults: { result: AnalysisResult };
  LiveCall: undefined;
};
