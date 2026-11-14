import React, { useEffect, useRef, useState } from 'react';
import {
  OtpChannel,
  OtpChallengeResponse,
  OtpSessionUser,
  requestOtpCode,
  verifyOtpCode,
} from '../lib/otpAuth';
import { TEAM_INFO } from '../lib/teamInfo';
import { TeamInfoView } from './TeamInfoView';
import { TeamLogo } from './TeamLogo';
import { StarfieldBackground } from './StarfieldBackground';
import astronautSpacecraftBg from '../assets/images/astronaut_spacecraft_bg_1794644383412.jpg';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface Props {
  onOtpSuccess: (user: OtpSessionUser) => void;
  onGoogleLogin: () => Promise<unknown>;
}

export const OtpAuthView: React.FC<Props> = ({ onOtpSuccess, onGoogleLogin }) => {
  const [showingTeamInfo, setShowingTeamInfo] = useState(false);
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [operatorName, setOperatorName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [expiresRemaining, setExpiresRemaining] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [bgImageFailed, setBgImageFailed] = useState(false);

  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== 'verify') return;
    const timer = setInterval(() => {
      setExpiresRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setStatusNotice(null);
    setIsLoading(true);
    try {
      const res = await requestOtpCode(identifier, channel, operatorName);
      setChallenge(res);
      setStep('verify');
      setDigits(['', '', '', '', '', '']);
      setExpiresRemaining(res.expiresInSeconds);
      setResendCooldown(res.cooldownSeconds);
      setStatusNotice(`6-digit OTP dispatched to ${res.maskedTarget}.`);
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitVerification = async (codeValue: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await verifyOtpCode(
        identifier,
        channel,
        codeValue,
        challenge?.challengeToken
      );
      onOtpSuccess(session.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits of your verification code.');
      return;
    }
    await submitVerification(code);
  };

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6; i++) {
        next[i] = cleaned[i] || '';
      }
      setDigits(next);
      const focusIdx = Math.min(cleaned.length, 5);
      digitRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleFillPreviewCode = () => {
    if (!challenge?.dispatchPreviewCode) return;
    const chars = challenge.dispatchPreviewCode.split('').slice(0, 6);
    setDigits(chars);
    digitRefs.current[5]?.focus();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setStatusNotice(null);
    setIsGoogleLoading(true);
    try {
      const signedIn = await onGoogleLogin();
      if (!signedIn) {
        setStatusNotice(
          'Google sign-in window was closed. Retry Google Sign-In or verify with a 6-digit OTP above.'
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (showingTeamInfo) {
    return (
      <div className="relative min-h-screen bg-[#040508] text-slate-100">
        <StarfieldBackground />
        <header className="relative z-10 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between gap-4 bg-[#05060b]/92 backdrop-blur-md">
          <div className="flex items-center gap-2.5 whitespace-nowrap">
            <TeamLogo className="w-8 h-8" />
            <span className="font-display text-lg font-bold tracking-[0.08em] uppercase text-white">
              Team {TEAM_INFO.teamName}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowingTeamInfo(false)}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Operator OTP Sign In
          </button>
        </header>
        <main className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <TeamInfoView
            isAuthenticated={false}
            onBackToAuth={() => setShowingTeamInfo(false)}
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-black text-white flex flex-col justify-between"
      data-testid="otp-auth-view"
    >
      {/* Full-Bleed Orbital Astronaut & Spacecraft Background (Sign-In Page Only) */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none" aria-hidden="true">
        {!bgImageFailed ? (
          <img
            src={astronautSpacecraftBg}
            alt="Astronaut tethered beside orbital spacecraft and habitat module above Earth"
            referrerPolicy="no-referrer"
            onError={() => setBgImageFailed(true)}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-950 via-black to-amber-950/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/40 to-black/85" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.72)_100%)]" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 border-b border-white/15 bg-black/50 backdrop-blur-md px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <TeamLogo className="w-8 h-8" />
          <span className="font-display text-lg font-bold tracking-[0.08em] uppercase text-white">
            Team {TEAM_INFO.teamName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowingTeamInfo(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-white/20 bg-black/60 hover:border-amber-300/70 text-xs font-medium text-neutral-100 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-amber-300" />
          <span>Team Tejasvi Info</span>
        </button>
      </header>

      {/* Main Split Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Mission Context Panel */}
          <section className="lg:col-span-6 p-6 sm:p-8 bg-black/60 backdrop-blur-md border border-white/15 rounded-xl flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="text-xs font-mono text-amber-300">
                {TEAM_INFO.challenge} · Team {TEAM_INFO.teamName}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Space Habitat Environmental Monitoring & Risk Prediction
              </h1>

              <p className="text-sm text-neutral-200 leading-relaxed">
                Authenticate via 6-digit One-Time Password (Email or Mobile) or Google Sign-In to access live telemetry, 5-tier habitat risk thresholds, AI safety recommendations, and 3D digital twins.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/15">
                <div>
                  <div className="text-xs font-mono text-neutral-300">Habitat Twins</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white mt-0.5">
                    7 Animated Models
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-neutral-300">Security Gate</div>
                  <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                    6-Digit HMAC OTP
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-300">
                Built by <strong className="text-white">Team {TEAM_INFO.teamName}</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowingTeamInfo(true)}
                className="text-xs font-medium text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline"
              >
                Meet all 5 Team Members
              </button>
            </div>
          </section>

          {/* Right OTP Authentication Form */}
          <section className="lg:col-span-6 p-6 sm:p-8 bg-black/72 backdrop-blur-md border border-white/15 rounded-xl flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-300/35 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Operator OTP Sign In</h2>
                    <p className="text-xs text-neutral-300">
                      {step === 'request'
                        ? 'Request a 6-digit verification code'
                        : 'Enter the 6-digit code to unlock Mission Control'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-400">
                  Step {step === 'request' ? '1 / 2' : '2 / 2'}
                </span>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-950/85 border border-rose-500/60 text-xs text-rose-100 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {statusNotice && !error && (
                <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-xs text-emerald-100 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                  <span>{statusNotice}</span>
                </div>
              )}

              {step === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  {/* Channel Switcher */}
                  <div>
                    <span className="text-xs font-mono text-neutral-300 block mb-1.5">
                      Verification Channel
                    </span>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-black/70 border border-white/15 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setChannel('email');
                          setError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                          channel === 'email'
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email OTP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChannel('phone');
                          setError(null);
                        }}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                          channel === 'phone'
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Mobile OTP</span>
                      </button>
                    </div>
                  </div>

                  {/* Operator Name (Optional) */}
                  <div>
                    <label
                      htmlFor="otp-operator-name"
                      className="text-xs font-mono text-neutral-300 block mb-1.5"
                    >
                      Operator Name (Optional)
                    </label>
                    <input
                      id="otp-operator-name"
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="e.g. Tanishk Sharma"
                      className="w-full bg-black/70 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-300"
                    />
                  </div>

                  {/* Email or Mobile Number */}
                  <div>
                    <label
                      htmlFor="otp-identifier"
                      className="text-xs font-mono text-neutral-300 block mb-1.5"
                    >
                      {channel === 'email' ? 'Operator Email Address' : 'Mobile Number'}
                    </label>
                    <input
                      id="otp-identifier"
                      type={channel === 'email' ? 'email' : 'tel'}
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={
                        channel === 'email'
                          ? 'operator@tejasvi.space'
                          : '+91 98765 43210'
                      }
                      className="w-full bg-black/70 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-amber-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-neutral-950 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>{isLoading ? 'Dispatching OTP...' : 'Send 6-Digit OTP'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyForm} className="space-y-4">
                  <div className="p-3 rounded-lg bg-black/70 border border-white/15 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-neutral-400">Target: </span>
                      <span className="font-mono text-white">{challenge?.maskedTarget}</span>
                    </div>
                    <span className="font-mono tabular-nums text-amber-300">
                      Expires {formatSeconds(expiresRemaining)}
                    </span>
                  </div>

                  {/* Sandbox Dispatch Preview when external SMS/SMTP webhook is not set */}
                  {challenge?.dispatchPreviewCode && (
                    <div
                      className="p-3.5 rounded-lg bg-amber-950/45 border border-amber-400/45 flex flex-wrap items-center justify-between gap-3"
                      data-testid="otp-preview-banner"
                    >
                      <div>
                        <div className="text-[11px] font-mono text-amber-200">
                          Secure Telemetry OTP Dispatch
                        </div>
                        <div className="text-xs text-neutral-200 mt-0.5">
                          Verification code:{' '}
                          <strong
                            className="font-mono text-base text-white tracking-widest ml-1"
                            data-testid="otp-preview-code"
                          >
                            {challenge.dispatchPreviewCode}
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleFillPreviewCode}
                        className="px-3 py-1.5 rounded-md bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/50 text-xs font-mono text-amber-100 transition-colors"
                      >
                        Auto-Fill Code
                      </button>
                    </div>
                  )}

                  {/* 6-Digit OTP Input Boxes */}
                  <div>
                    <label className="text-xs font-mono text-neutral-300 block mb-2">
                      Enter 6-Digit Verification Code
                    </label>
                    <div className="grid grid-cols-6 gap-2 sm:gap-3">
                      {digits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            digitRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          aria-label={`OTP digit ${idx + 1}`}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                          className="h-12 text-center text-lg font-mono font-bold tabular-nums bg-black/75 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-300"
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || digits.join('').length !== 6}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {isLoading ? 'Verifying OTP...' : 'Verify & Enter Mission Control'}
                    </span>
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('request');
                        setError(null);
                        setStatusNotice(null);
                      }}
                      className="text-neutral-300 hover:text-white transition-colors"
                    >
                      Change Email / Mobile
                    </button>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isLoading}
                      onClick={() => handleRequestOtp()}
                      className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 disabled:text-neutral-500 transition-colors font-mono"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend OTP'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Secondary Google Auth Option */}
            <div className="pt-4 border-t border-white/15 space-y-3">
              <div className="text-[11px] font-mono text-neutral-400 text-center">
                Or continue with cloud mission credentials
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2 px-4 rounded-lg bg-black/65 hover:bg-white/10 border border-white/20 text-xs font-medium text-neutral-100 transition-colors disabled:opacity-50"
              >
                {isGoogleLoading ? 'Connecting Google Account...' : 'Sign In with Google'}
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/15 bg-black/55 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-neutral-300">
        <span>Team {TEAM_INFO.teamName} · {TEAM_INFO.projectTitle}</span>
        <span>{TEAM_INFO.challenge}</span>
      </footer>
    </div>
  );
};
