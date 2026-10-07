// Music cues: HIT1 / DROP / STOP / LOGO are picture-locked (BRIEF §6), BEAT = the measured tempo (100.0 BPM, key D maj, grid anchored on the DROP: beats at DROP + k * BEAT).
// Written by tools/mix_audio.py from the measured music (source beat S 23.992 -> T 24.60, sub-bass enters the root). FROZEN once the lead says so (run the mixer with --no-cues).
window.CUES = Object.freeze({ HIT1: 1.0, DROP: 24.6, STOP: 39.6, LOGO: 40.2, BEAT: 0.6, BPM: 100.0 });
