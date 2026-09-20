// CallShadow - Legacy Entrypoint Bridge
// Loads modular scripts and ensures window.apiService and window.app are available

if (typeof window !== 'undefined') {
    window.CallShadowLoaded = true;
    window.VocalShieldLoaded = true; // legacy compatibility
}

