// Shared AudioContext instance to prevent leaking contexts on rapid playback.
// Browsers cap concurrent AudioContexts at ~6; reusing one avoids silent failures.
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AudioContextClass();
    }

    // Resume if suspended (browsers auto-suspend until user interaction)
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume();
    }

    return sharedCtx;
  } catch {
    return null;
  }
}

// Play custom synthesized audio feedback
export const playSound = (type: 'correct' | 'incorrect' | 'level-up') => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (type === 'correct') {
      // Warm, ascending chime (C5 then E5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'incorrect') {
      // Gentle, low reminder tone (G3)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(196.00, now); // G3
      
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'level-up') {
      // Vibrant major chord sweep (C5 -> E5 -> G5 -> C6)
      const now = ctx.currentTime;
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.10, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    }
  } catch (err) {
    console.warn('[Foundations] Web Audio playback failed:', err);
  }
};
