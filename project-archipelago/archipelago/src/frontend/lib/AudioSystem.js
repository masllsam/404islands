// AudioSystem.js - Procedural Environmental Audio Engine
// Synthesizes natural sounds using Web Audio API with zero performance impact

export class AudioSystem {
  constructor(islandId = 1, options = {}) {
    this.islandId = islandId;
    this.audioContext = null;
    this.masterGain = null;
    this.isInitialized = false;
    this.isMuted = false;

    // Audio state
    this.currentWeather = 'clear';
    this.currentSounds = new Map();
    this.maxConcurrentSounds = 10;
    this.soundPriority = 0;

    // Performance monitoring
    this.audioPerformance = {
      cpuUsage: 0,
      memoryUsage: 0,
      activeSources: 0,
      droppedSounds: 0
    };

    // Initialize if Web Audio is available
    this.tryInitializeAudio();
  }

  // Try to initialize Web Audio context
  async tryInitializeAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      console.warn('🎵 Web Audio API not supported - audio features disabled');
      return false;
    }

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);

      // Auto-resume context on user interaction
      if (this.audioContext.state === 'suspended') {
        document.addEventListener('click', () => this.resume(), { once: true });
      }

      this.isInitialized = true;
      console.log(`🎵 AudioSystem initialized for Island ${this.islandId}`);

      // Set up default gain structure
      this.initializeGainNodes();

      return true;
    } catch (error) {
      console.warn('🎵 Failed to initialize audio system:', error);
      return false;
    }
  }

  // Initialize audio routing
  initializeGainNodes() {
    if (!this.audioContext) return;

    // Create separate gain nodes for different sound types
    this.gainNodes = {
      ocean: this.audioContext.createGain(),
      wind: this.audioContext.createGain(),
      ambient: this.audioContext.createGain(),
      weather: this.audioContext.createGain(),
      effects: this.audioContext.createGain()
    };

    // Connect all to master gain
    Object.values(this.gainNodes).forEach(gainNode => {
      gainNode.connect(this.masterGain);
    });

    // Set initial volumes
    this.gainNodes.ocean.gain.value = 0.5;
    this.gainNodes.wind.gain.value = 0.3;
    this.gainNodes.ambient.gain.value = 0.2;
    this.gainNodes.weather.gain.value = 0.4;
    this.gainNodes.effects.gain.value = 0.6;
  }

  // Resume audio context (required by browser policies)
  async resume() {
    if (!this.audioContext) return;

    try {
      await this.audioContext.resume();
      console.log('🎵 Audio context resumed');
    } catch (error) {
      console.warn('🎵 Failed to resume audio:', error);
    }
  }

  // Core API: Play environment sounds
  async playEnvironment(params = {}) {
    if (!this.isInitialized || this.isMuted) return;

    const {
      rain = 0.0,
      wind = 0.0,
      ocean = 0.5,
      storm = 0.0
    } = params;

    // Performance check
    if (this.currentSounds.size >= this.maxConcurrentSounds) {
      this.audioPerformance.droppedSounds++;
      this.cleanupOldSounds();
    }

    const soundId = `env_${Date.now()}_${this.soundPriority++}`;

    // Play ocean sounds
    if (ocean > 0.01) {
      this.playOceanWaves(soundId, ocean);
    }

    // Play wind sounds
    if (wind > 0.01) {
      this.playWind(soundId, wind);
    }

    // Play rain/sound effects
    if (rain > 0.01) {
      this.playRain(soundId, rain);
    }

    // Play storm sounds
    if (storm > 0.01) {
      this.playStorm(soundId, storm);
    }

    // Update performance metrics
    this.updateAudioPerformance();
    console.log(`🎵 Environment audio: Ocean:${ocean.toFixed(2)}, Wind:${wind.toFixed(2)}, Rain:${rain.toFixed(2)}, Storm:${storm.toFixed(2)}`);
  }

  // Generate ocean wave sounds using procedural synthesis
  playOceanWaves(soundId, intensity) {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      const filterNode = this.audioContext.createBiquadFilter();

      // Ocean-like low frequency oscillation
      oscillator.type = 'sawtooth'; // Creates organic wave sound
      oscillator.frequency.setValueAtTime(120 + Math.random() * 40, this.audioContext.currentTime);

      // Add subtle frequency modulation for wave motion
      const modFreq = this.audioContext.createOscillator();
      const modGain = this.audioContext.createGain();
      modFreq.frequency.setValueAtTime(0.1 + Math.random() * 0.05, this.audioContext.currentTime);
      modGain.gain.setValueAtTime(20 + Math.random() * 10, this.audioContext.currentTime);
      modFreq.connect(modGain);
      modGain.connect(oscillator.frequency);

      // Filter for ocean depth
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(800 + Math.random() * 400, this.audioContext.currentTime);

      // Volume envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(intensity * 0.1, this.audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(intensity * 0.05, this.audioContext.currentTime + 15);

      // Connect nodes
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.gainNodes.ocean);

      // Start and schedule cleanup
      oscillator.start();
      modFreq.start();

      const cleanup = () => {
        oscillator.stop();
        modFreq.stop();
        this.currentSounds.delete(soundId);
        this.audioPerformance.activeSources = Math.max(0, this.audioPerformance.activeSources - 1);
      };

      // Stop after 15 seconds
      oscillator.addEventListener('ended', cleanup);
      setTimeout(cleanup, 15000);

      this.currentSounds.set(soundId, { type: 'ocean', oscillator, gainNode, cleanup });

    } catch (error) {
      console.warn('🎵 Failed to play ocean sound:', error);
    }
  }

  // Generate wind sounds using noise synthesis
  playWind(soundId, intensity) {
    if (!this.audioContext) return;

    try {
      // Use white noise for wind rustle
      const bufferSize = this.audioContext.sampleRate * 2;
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = noiseBuffer.getChannelData(0);

      // Generate white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1; // Low amplitude
      }

      const noiseSource = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      const filterNode = this.audioContext.createBiquadFilter();

      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // Wind-like filter (high-pass for high wind, low-pass for gentle breeze)
      filterNode.type = intensity > 0.5 ? 'highpass' : 'lowpass';
      filterNode.frequency.setValueAtTime(200 + intensity * 1000, this.audioContext.currentTime);

      // Volume envelope
      gainNode.gain.setValueAtTime(intensity * 0.1, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(intensity * 0.05, this.audioContext.currentTime + 10);

      // Connect and start
      noiseSource.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.gainNodes.wind);

      noiseSource.start();

      const cleanup = () => {
        noiseSource.stop();
        this.currentSounds.delete(soundId + '_wind');
      };

      // Stop after 10 seconds
      setTimeout(cleanup, 10000);

      this.currentSounds.set(soundId + '_wind', { type: 'wind', noiseSource, gainNode, cleanup });

    } catch (error) {
      console.warn('🎵 Failed to play wind sound:', error);
    }
  }

  // Generate rain sounds using granular synthesis
  playRain(soundId, intensity) {
    if (!this.audioContext) return;

    try {
      // Create multiple raindrop sounds
      const numDrops = Math.floor(intensity * 8) + 2;
      const raindrops = [];

      for (let i = 0; i < numDrops; i++) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Raindrop-like sound (short burst of high frequency)
        oscillator.frequency.setValueAtTime(2000 + Math.random() * 4000, this.audioContext.currentTime + i * 0.1);
        oscillator.type = 'sawtooth';

        // Quick attack and decay
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + i * 0.1);
        gainNode.gain.linearRampToValueAtTime(intensity * 0.15, this.audioContext.currentTime + i * 0.1 + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + i * 0.1 + 0.08);

        oscillator.connect(gainNode);
        gainNode.connect(this.gainNodes.weather);

        oscillator.start(this.audioContext.currentTime + i * 0.1);
        oscillator.stop(this.audioContext.currentTime + i * 0.1 + 0.08);

        raindrops.push({ oscillator, gainNode });
      }

      // Store reference for cleanup
      this.currentSounds.set(soundId + '_rain', { type: 'rain', raindrops });

    } catch (error) {
      console.warn('🎵 Failed to play rain sound:', error);
    }
  }

  // Generate thunderstorm sounds
  playStorm(soundId, intensity) {
    if (!this.audioContext) return;

    try {
      // Thunder rumble (low frequency)
      const thunderOsc = this.audioContext.createOscillator();
      const thunderGain = this.audioContext.createGain();
      const thunderFilter = this.audioContext.createBiquadFilter();

      thunderOsc.frequency.setValueAtTime(80 + Math.random() * 40, this.audioContext.currentTime);
      thunderOsc.type = 'sawtooth';

      // Low-pass filter with resonance for rumble
      thunderFilter.type = 'lowpass';
      thunderFilter.frequency.setValueAtTime(200, this.audioContext.currentTime);
      thunderFilter.Q.setValueAtTime(intensity * 10, this.audioContext.currentTime);

      // Loud burst of thunder
      thunderGain.gain.setValueAtTime(intensity * 0.3, this.audioContext.currentTime);
      thunderGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      thunderOsc.connect(thunderFilter);
      thunderFilter.connect(thunderGain);
      thunderGain.connect(this.gainNodes.weather);

      thunderOsc.start();
      thunderOsc.stop(this.audioContext.currentTime + 0.5);

      // Occasional lightning crack if intensity is high
      if (intensity > 0.7 && Math.random() > 0.7) {
        setTimeout(() => this.playLightning(), 100 + Math.random() * 300);
      }

      this.currentSounds.set(soundId + '_thunder', { type: 'thunder', thunderOsc, thunderGain });

    } catch (error) {
      console.warn('🎵 Failed to play thunder sound:', error);
    }
  }

  // Generate lightning sound effect
  playLightning() {
    if (!this.audioContext || Math.random() > 0.3) return; // Not every thunder has lightning

    try {
      const lightningOsc = this.audioContext.createOscillator();
      const lightningGain = this.audioContext.createGain();
      const lightningFilter = this.audioContext.createBiquadFilter();

      // Sharp crack sound
      lightningOsc.frequency.setValueAtTime(3000 + Math.random() * 5000, this.audioContext.currentTime);
      lightningOsc.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);

      lightningFilter.type = 'highpass';
      lightningFilter.frequency.setValueAtTime(2000, this.audioContext.currentTime);

      lightningGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
      lightningGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

      lightningOsc.connect(lightningFilter);
      lightningFilter.connect(lightningGain);
      lightningGain.connect(this.gainNodes.effects);

      lightningOsc.start();
      lightningOsc.stop(this.audioContext.currentTime + 0.15);

    } catch (error) {
      console.warn('🎵 Failed to play lightning sound:', error);
    }
  }

  // Set weather for environmental audio
  setWeatherState(weather) {
    this.currentWeather = weather;
    console.log(`🌦️ Audio weather set to: ${weather} on Island ${this.islandId}`);
  }

  // Mute/unmute audio
  setMuted(muted) {
    this.isMuted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  // Set master volume
  setMasterVolume(volume) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // Set individual sound type volumes
  setSoundVolumes(volumes = {}) {
    if (!this.gainNodes) return;

    const {
      ocean = this.gainNodes.ocean.gain.value,
      wind = this.gainNodes.wind.gain.value,
      ambient = this.gainNodes.ambient.gain.value,
      weather = this.gainNodes.weather.gain.value,
      effects = this.gainNodes.effects.gain.value
    } = volumes;

    this.gainNodes.ocean.gain.value = ocean;
    this.gainNodes.wind.gain.value = wind;
    this.gainNodes.ambient.gain.value = ambient;
    this.gainNodes.weather.gain.value = weather;
    this.gainNodes.effects.gain.value = effects;
  }

  // Cleanup old/stale sounds
  cleanupOldSounds() {
    const now = Date.now();
    const staleIds = [];

    for (const [id, sound] of this.currentSounds.entries()) {
      // Remove sounds older than 30 seconds
      if (sound.created && now - sound.created > 30000) {
        staleIds.push(id);
      }
    }

    staleIds.forEach(id => {
      const sound = this.currentSounds.get(id);
      if (sound?.cleanup) {
        sound.cleanup();
      }
      this.currentSounds.delete(id);
    });

    console.log(`🧹 Cleaned up ${staleIds.length} stale audio sources`);
  }

  // Update audio performance metrics
  updateAudioPerformance() {
    if (!this.audioContext) return;

    this.audioPerformance.activeSources = this.currentSounds.size;
    // In a real implementation, you might monitor CPU usage here
  }

  // Get audio system status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isMuted: this.isMuted,
      activeSources: this.currentSounds.size,
      weather: this.currentWeather,
      performance: this.audioPerformance
    };
  }

  // Memory cleanup
  cleanup() {
    for (const sound of this.currentSounds.values()) {
      if (sound?.cleanup) {
        sound.cleanup();
      }
    }

    this.currentSounds.clear();

    if (this.audioContext) {
      this.audioContext.close().catch(console.warn);
      this.audioContext = null;
    }

    this.isInitialized = false;
    console.log(`🧹 AudioSystem cleaned up for Island ${this.islandId}`);
  }
}

// Factory function for creating audio systems
export function createAudioSystem(islandId, options = {}) {
  return new AudioSystem(islandId, options);
}

console.log('🎵 AudioSystem ready - Procedural environmental audio engine initialized');