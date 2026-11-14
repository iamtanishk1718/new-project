import {
  DetectedHazard,
  EnvironmentalTelemetry,
  RiskClassification,
} from '../types/habitat';

export interface HazardAudioProfile {
  tier: RiskClassification;
  label: string;
  volume: number; // 0.0 - 0.85
  volumePercent: number; // 0 - 100
  primaryFreqHz: number;
  secondaryFreqHz: number;
  beepDurationMs: number;
  pulseCount: number;
  intervalMs: number;
  voiceIntervalMs: number;
  flashRateHz: number;
}

export function getAudioProfileForRisk(
  classification: RiskClassification,
  riskScore: number = 0
): HazardAudioProfile {
  switch (classification) {
    case 'extreme_emergency':
      return {
        tier: 'extreme_emergency',
        label: 'EXTREME MASTER ALARM',
        volume: 0.85,
        volumePercent: 100,
        primaryFreqHz: 1220,
        secondaryFreqHz: 860,
        beepDurationMs: 85,
        pulseCount: 3,
        intervalMs: 360,
        voiceIntervalMs: 9500,
        flashRateHz: 6.0,
      };
    case 'critical':
      return {
        tier: 'critical',
        label: 'CRITICAL KLX ALARM',
        volume: 0.56,
        volumePercent: 70,
        primaryFreqHz: 980,
        secondaryFreqHz: 740,
        beepDurationMs: 95,
        pulseCount: 2,
        intervalMs: 680,
        voiceIntervalMs: 12000,
        flashRateHz: 3.5,
      };
    case 'high_risk':
      return {
        tier: 'high_risk',
        label: 'HIGH RISK WARNING',
        volume: 0.28,
        volumePercent: 40,
        primaryFreqHz: 780,
        secondaryFreqHz: 640,
        beepDurationMs: 105,
        pulseCount: 2,
        intervalMs: 1250,
        voiceIntervalMs: 16000,
        flashRateHz: 2.0,
      };
    case 'caution':
      return {
        tier: 'caution',
        label: 'CAUTION ADVISORY',
        volume: 0.1,
        volumePercent: 18,
        primaryFreqHz: 580,
        secondaryFreqHz: 580,
        beepDurationMs: 110,
        pulseCount: 1,
        intervalMs: 2300,
        voiceIntervalMs: 22000,
        flashRateHz: 1.0,
      };
    default:
      return {
        tier: 'normal',
        label: riskScore >= 15 ? 'ADVISORY MONITOR' : 'NOMINAL SILENT',
        volume: 0,
        volumePercent: 0,
        primaryFreqHz: 440,
        secondaryFreqHz: 440,
        beepDurationMs: 0,
        pulseCount: 0,
        intervalMs: 0,
        voiceIntervalMs: 0,
        flashRateHz: 0,
      };
  }
}

export function buildVoiceWarningMessage(
  classification: RiskClassification,
  hazards: DetectedHazard[],
  telemetry: EnvironmentalTelemetry
): string {
  if (classification === 'normal') {
    return 'All cabin environmental parameters are nominal.';
  }

  const topHazard = hazards[0]?.name;

  if (telemetry.fireDetected) {
    return `Emergency alert! Cabin fire detected! Temperature ${telemetry.internalTemperatureC.toFixed(
      0
    )} degrees Celsius. Isolate avionics power and execute fire suppression immediately!`;
  }

  if (classification === 'extreme_emergency') {
    return `Extreme emergency! ${
      topHazard || 'Multiple life-support limits breached'
    }. Cabin pressure ${telemetry.pressureKPa.toFixed(
      1
    )} kilopascals, oxygen ${telemetry.oxygenPercent.toFixed(
      1
    )} percent. Execute emergency protocol immediately!`;
  }

  if (classification === 'critical') {
    return `Critical warning! ${
      topHazard || 'Environmental threshold critical breach'
    }. Immediate corrective action required.`;
  }

  if (classification === 'high_risk') {
    return `Warning, high environmental risk. ${
      topHazard || 'Life-support parameters out of nominal bounds'
    }. Inspect ECLSS console.`;
  }

  return `Caution advisory. ${
    topHazard || 'Environmental parameter drifting outside normal range'
  }.`;
}

export class HazardAlarmController {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private beepTimer: number | null = null;
  private voiceTimer: number | null = null;
  private isMuted = false;
  private isUnlocked = false;
  private isDisposed = false;
  private hasUserGesture = false;
  private currentProfile: HazardAudioProfile = getAudioProfileForRisk('normal');
  private currentMessage = '';
  private lastSpokenTier: RiskClassification = 'normal';
  private lastSpokenAt = 0;

  private ensureContext(): AudioContext | null {
    if (this.isDisposed || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (this.ctx && this.ctx.state === 'closed') {
      this.ctx = null;
      this.compressor = null;
    }

    if (!this.ctx) {
      if (!this.hasUserGesture) return null;
      this.ctx = new AudioCtx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(16, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isUnlocked = this.ctx.state === 'running';
    return this.ctx;
  }

  public unlock(): boolean {
    if (this.isDisposed) return false;
    if (typeof navigator !== 'undefined' && 'userActivation' in navigator) {
      const ua = (
        navigator as Navigator & {
          userActivation?: { isActive?: boolean; hasBeenActive?: boolean };
        }
      ).userActivation;
      if (ua && !ua.isActive && !ua.hasBeenActive) {
        return false;
      }
    }
    this.hasUserGesture = true;
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (!this.isDisposed && this.ctx && this.ctx.state === 'running') {
            this.isUnlocked = true;
          }
        })
        .catch(() => {});
    } else {
      this.isUnlocked = ctx.state === 'running';
    }
    return this.isUnlocked;
  }

  public setMuted(muted: boolean) {
    if (this.isDisposed) return;
    this.isMuted = muted;
    if (muted) {
      this.stopTimers();
      this.cancelSpeech();
    } else {
      this.unlock();
      this.scheduleTimers(true);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public update(
    classification: RiskClassification,
    riskScore: number,
    hazards: DetectedHazard[],
    telemetry: EnvironmentalTelemetry
  ) {
    if (this.isDisposed) return;
    const nextProfile = getAudioProfileForRisk(classification, riskScore);
    const nextMessage = buildVoiceWarningMessage(
      classification,
      hazards,
      telemetry
    );

    const tierChanged = nextProfile.tier !== this.currentProfile.tier;
    this.currentProfile = nextProfile;
    this.currentMessage = nextMessage;

    if (this.isMuted || nextProfile.tier === 'normal') {
      this.stopTimers();
      if (nextProfile.tier === 'normal') {
        this.lastSpokenTier = 'normal';
        this.cancelSpeech();
      }
      return;
    }

    if (tierChanged || !this.beepTimer) {
      this.scheduleTimers(tierChanged);
    }
  }

  public triggerTestSequence(
    classification: RiskClassification,
    riskScore: number,
    hazards: DetectedHazard[],
    telemetry: EnvironmentalTelemetry
  ) {
    if (this.isDisposed) return;
    this.unlock();
    const profile =
      classification === 'normal'
        ? getAudioProfileForRisk('critical', 75)
        : getAudioProfileForRisk(classification, riskScore);
    const msg =
      classification === 'normal'
        ? 'Caution and warning audio test. Master alarm speaker and voice synthesizer operational.'
        : buildVoiceWarningMessage(classification, hazards, telemetry);

    this.playBeepPattern(profile);
    this.speakText(msg, true);
  }

  private playBeepPattern(profile: HazardAudioProfile) {
    if (this.isDisposed || this.isMuted || profile.volume <= 0 || profile.pulseCount <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'closed' || !this.compressor) return;

    const now = ctx.currentTime;
    const stepSec = (profile.beepDurationMs + 55) / 1000;

    for (let i = 0; i < profile.pulseCount; i++) {
      const start = now + i * stepSec;
      const dur = profile.beepDurationMs / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type =
        profile.tier === 'extreme_emergency' || profile.tier === 'critical'
          ? 'sawtooth'
          : 'triangle';
      const freq = i % 2 === 0 ? profile.primaryFreqHz : profile.secondaryFreqHz;
      osc.frequency.setValueAtTime(freq, start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(
        profile.tier === 'extreme_emergency' ? 3200 : 2200,
        start
      );

      // Smooth envelope to eliminate clicks
      const targetGain = Math.min(0.42, profile.volume * 0.45);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(targetGain, start + 0.012);
      gain.gain.setValueAtTime(targetGain, start + Math.max(0.02, dur - 0.02));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);

      osc.start(start);
      osc.stop(start + dur + 0.015);
    }
  }

  private speakText(message: string, force = false) {
    if (this.isDisposed || this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!message) return;

    try {
      const synth = window.speechSynthesis;
      const now = Date.now();
      if (!force && now - this.lastSpokenAt < 3500) return;
      if (force) {
        synth.cancel();
      } else if (synth.speaking) {
        return;
      }

      const utter = new SpeechSynthesisUtterance(message);
      utter.rate =
        this.currentProfile.tier === 'extreme_emergency' ? 1.12 : 1.02;
      utter.pitch =
        this.currentProfile.tier === 'extreme_emergency' ? 1.08 : 0.96;
      utter.volume = Math.max(0.35, Math.min(1, this.currentProfile.volume + 0.2));
      synth.speak(utter);
      this.lastSpokenAt = now;
    } catch {
      // SpeechSynthesis unsupported or blocked
    }
  }

  private cancelSpeech() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }

  private scheduleTimers(announceImmediately: boolean) {
    this.stopTimers();
    const profile = this.currentProfile;
    if (this.isDisposed || this.isMuted || profile.tier === 'normal' || profile.intervalMs <= 0) {
      return;
    }

    // Play immediate pulse on tier escalation
    if (announceImmediately) {
      this.playBeepPattern(profile);
      if (profile.tier !== this.lastSpokenTier) {
        this.lastSpokenTier = profile.tier;
        this.speakText(this.currentMessage, true);
      }
    }

    this.beepTimer = window.setInterval(() => {
      if (!this.isDisposed && !this.isMuted && this.currentProfile.tier !== 'normal') {
        this.playBeepPattern(this.currentProfile);
      }
    }, profile.intervalMs);

    if (profile.voiceIntervalMs > 0) {
      this.voiceTimer = window.setInterval(() => {
        if (!this.isDisposed && !this.isMuted && this.currentProfile.tier !== 'normal') {
          this.speakText(this.currentMessage, false);
        }
      }, profile.voiceIntervalMs);
    }
  }

  private stopTimers() {
    if (this.beepTimer !== null) {
      window.clearInterval(this.beepTimer);
      this.beepTimer = null;
    }
    if (this.voiceTimer !== null) {
      window.clearInterval(this.voiceTimer);
      this.voiceTimer = null;
    }
  }

  public dispose() {
    this.isDisposed = true;
    this.stopTimers();
    this.cancelSpeech();
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      this.compressor = null;
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }
  }
}
