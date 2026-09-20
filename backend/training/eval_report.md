# ASVspoof2019 Logical Access Benchmark Evaluation Report

This report summarizes the performance of the fine-tuned Wav2Vec2 binary speech deepfake classification model evaluated on the held-out test split of the ASVspoof2019 Logical Access (LA) dataset.

## Executive Performance Summary

| Metric | Score | Standard Target | Status |
| :--- | :--- | :--- | :--- |
| **Equal Error Rate (EER)** | **1.06%** | $< 5.0\%$ | ✅ Passed Benchmark |
| **AUC-ROC** | **0.9988** | $> 0.95$ | ✅ Superior Discriminability |
| **Test Accuracy** | **92.63%** | $> 90.0\%$ | ✅ High Overall Accuracy |
| **Evaluated Clips** | **71237** | Held-Out Test Set | Official Protocol Split |

---

## Confusion Matrix (Held-out Eval Set)

```
                     Predicted Human    Predicted AI
Actual Human (Bonafide)    7337            18             
Actual AI (Spoof)          5234            58648          
```

---

## Technical Training Scope & Limitations

> [!IMPORTANT]
> - **Trained Models & Attack Algorithms**: Model fine-tuned on ASVspoof2019 LA protocols covering TTS (text-to-speech) and VC (voice conversion) attack algorithms (A01–A19: neural vocoders, waveform concatenation, diphone synthesis).
> - **Preprocessing Integrity**: Training uses the exact same `preprocess_audio` routine (16kHz mono resampling & peak amplitude normalization) as the serving API.
> - **In-the-Wild Note**: Performance on unseen zero-shot commercial TTS engines (e.g. ElevenLabs, OpenAI Voice) may vary depending on codec compression and noise profile.
