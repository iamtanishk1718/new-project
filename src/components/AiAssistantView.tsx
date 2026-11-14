import React, { useState, useRef, useEffect } from 'react';
import {
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
} from '../types/habitat';
import {
  MessageSquare,
  Send,
  Upload,
  Sparkles,
  Bot,
  User,
  Search,
  MapPin,
  Cpu,
  Brain,
  Shield,
  Loader2,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
  groundingCitations?: any[];
  imagePreview?: string;
}

export const AiAssistantView: React.FC<Props> = ({ telemetry, habitat, assessment }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Greetings Flight Control. I am FLAME IN FIREFALL AI Space Safety Assistant. I have live telemetry access to ${habitat.name} (Active Risk: ${assessment.overallRiskScore}/100, ${assessment.classification.toUpperCase()}). You can ask me to diagnose sensor anomalies, calculate crew hypoxia risks, recommend ECLSS inspections, or analyze uploaded photos of habitat equipment.`,
      timestamp: new Date().toLocaleTimeString(),
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [modelChoice, setModelChoice] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' | 'free-space-ai'>('gemini-4-hydrogen');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [useMapsGrounding, setUseMapsGrounding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Vision / Photo Upload State
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickPrompts = [
    'Why is the current habitat risk score at this level?',
    'Which environmental parameter is most dangerous right now?',
    'What happens to the crew if CO2 continues to accumulate?',
    'Compare current conditions with normal operating baseline',
    'Explain the physiological relationship between cabin pressure and oxygen availability',
    'Which ECLSS valves and life support systems should be inspected first?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text && !selectedImage) return;

    const userMsgId = `msg-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString();

    // If an image is attached, run Vision / Hardware Inspection (Free-tier 4 Hydrogen -> Free Space AI)
    if (selectedImage) {
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        text: text || 'Inspect this habitat component for anomalies or structural damage.',
        timestamp: userTimestamp,
        imagePreview: selectedImage.preview,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      const imgToAnalyze = selectedImage;
      setSelectedImage(null);
      setIsLoading(true);

      try {
        const res = await fetch('/api/ai/vision-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data: imgToAnalyze.base64,
            mimeType: imgToAnalyze.mimeType,
            prompt: text || 'Analyze this habitat photo for damage, scorch marks, leaks, or anomalies.',
            telemetryContext: {
              habitatName: habitat.name,
              pressureKPa: telemetry.pressureKPa,
              internalTemperatureC: telemetry.internalTemperatureC,
              smokeDetected: telemetry.smokeDetected,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            text: data.notice ? `${data.analysis}\n\n[${data.notice}]` : data.analysis || 'Vision inspection complete.',
            timestamp: new Date().toLocaleTimeString(),
            modelUsed: data.modelUsed || 'free-space-ai-v1',
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            text: `Image analysis error: ${err.message || 'Check connection.'}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Standard multi-turn text chat
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          habitatContext: {
            habitat,
            telemetry,
            assessment,
          },
          modelChoice,
          useSearchGrounding,
          useMapsGrounding,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.notice ? `${data.text}\n\n[${data.notice}]` : data.text || 'Telemetry analyzed. All readings reviewed.',
          timestamp: new Date().toLocaleTimeString(),
          modelUsed: data.modelUsed || modelChoice,
          groundingCitations: data.searchGroundingCitations,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: `Telemetry analysis response: Based on current readings (O2: ${telemetry.oxygenPercent}%, CO2: ${telemetry.carbonDioxidePpm} ppm, Pressure: ${telemetry.pressureKPa} kPa), habitat status is ${assessment.classification.toUpperCase()} with overall risk of ${assessment.overallRiskScore}/100. Primary attention should be given to: ${assessment.hazards.map((h) => h.name).join('; ') || 'All parameters nominal.'}`,
          timestamp: new Date().toLocaleTimeString(),
          modelUsed: 'nasa-std-3001-engine',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setSelectedImage({
        base64,
        mimeType: file.type || 'image/jpeg',
        preview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[760px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Brain className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              AI Space Safety Assistant (Free Tier / Open AI)
            </h1>
            <span className="text-[11px] font-mono text-slate-400">
              Context: {habitat.name} · Score: {assessment.overallRiskScore}/100
            </span>
          </div>
        </div>

        {/* Model Picker & Grounding Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* Model Choice */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setModelChoice('gemini-4-hydrogen')}
              className={`px-2 py-0.5 rounded transition-colors ${
                modelChoice === 'gemini-4-hydrogen'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              4 Hydrogen (Free)
            </button>
            <button
              onClick={() => setModelChoice('gemini-3.1-flash-lite')}
              className={`px-2 py-0.5 rounded transition-colors ${
                modelChoice === 'gemini-3.1-flash-lite'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lite (Free)
            </button>
            <button
              onClick={() => setModelChoice('free-space-ai')}
              className={`px-2 py-0.5 rounded transition-colors ${
                modelChoice === 'free-space-ai'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Free Space AI
            </button>
          </div>

          {/* Search Grounding Toggle */}
          <button
            onClick={() => setUseSearchGrounding(!useSearchGrounding)}
            disabled={modelChoice !== 'gemini-4-hydrogen'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
              useSearchGrounding
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40'
            }`}
            title="Google Search Grounding (gemini-4-hydrogen)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          {/* Maps Grounding Toggle */}
          <button
            onClick={() => setUseMapsGrounding(!useMapsGrounding)}
            disabled={modelChoice !== 'gemini-4-hydrogen'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
              useMapsGrounding
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40'
            }`}
            title="Google Maps Grounding (gemini-4-hydrogen)"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Maps</span>
          </button>
        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-cyan-400 border border-slate-700'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[80%] rounded-xl p-3.5 text-xs font-sans leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-600/25 border border-cyan-500/40 text-slate-100'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200'
              }`}
            >
              {/* Optional Attached Image Preview */}
              {msg.imagePreview && (
                <div className="mb-2 rounded-lg overflow-hidden border border-slate-700 max-w-xs">
                  <img src={msg.imagePreview} alt="Habitat upload" className="w-full h-auto" />
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Citations if Grounded */}
              {msg.groundingCitations && msg.groundingCitations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                  <span className="text-cyan-400">Sources: </span>
                  {msg.groundingCitations.map((c: any, i: number) => (
                    <span key={i} className="mr-2">
                      [{i + 1}] {c.web?.title || 'NASA Resource'}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>{msg.timestamp}</span>
                {msg.modelUsed && <span className="uppercase">{msg.modelUsed}</span>}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 p-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Analyzing environmental telemetry with {modelChoice}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs font-mono">
        <span className="text-slate-500 text-[10px] uppercase shrink-0">Quick Prompts:</span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="whitespace-nowrap px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white rounded-md transition-colors text-[11px]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Selected Image Thumbnail Preview */}
      {selectedImage && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={selectedImage.preview} alt="Upload" className="w-8 h-8 rounded object-cover border border-cyan-500" />
            <span className="text-xs font-mono text-cyan-300">
              Attached photo ready for Free Space AI / Gemini 4 Hydrogen inspection
            </span>
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="text-xs font-mono text-slate-400 hover:text-rose-400"
          >
            Remove
          </button>
        </div>
      )}

      {/* Input Box */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-900 transition-colors"
          title="Upload Photo for Hardware Inspection (Free AI)"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI safety assistant (e.g. Inspect O2 levels, analyze sensor drift, evaluate hypoxia)..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-sans text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={isLoading || (!inputText.trim() && !selectedImage)}
          className="p-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 rounded-lg transition-colors font-semibold"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
