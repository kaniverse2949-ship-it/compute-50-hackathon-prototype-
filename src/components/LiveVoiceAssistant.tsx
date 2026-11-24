import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, PhoneCall, Send, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import { getLanguageLabel } from '../i18n';
import type { Language } from '../types';
import { SpringButton, VoiceSoundWave } from './MotionPrimitives';

interface LiveVoiceAssistantProps {
  token: string;
  language: Language;
  calm: boolean;
}

function float32ToBase64Pcm16(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const length = Math.floor(bytes.byteLength / 2);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export function LiveVoiceAssistant({ token, language, calm }: LiveVoiceAssistantProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [micActive, setMicActive] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [transcripts, setTranscripts] = useState<Array<{ who: 'user' | 'ai'; text: string }>>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const hasErrorRef = useRef<boolean>(false);

  const cleanupResources = () => {
    try {
      processorRef.current?.disconnect();
    } catch {
      // ignore
    }
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    try {
      inputCtxRef.current?.close();
    } catch {
      // ignore
    }
    inputCtxRef.current = null;
    try {
      outputCtxRef.current?.close();
    } catch {
      // ignore
    }
    outputCtxRef.current = null;
    try {
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
    nextStartTimeRef.current = 0;
    setMicActive(false);
  };

  const stopSession = () => {
    hasErrorRef.current = false;
    cleanupResources();
    setMicNote(null);
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const appendTranscript = (who: 'user' | 'ai', chunk: string) => {
    const clean = chunk;
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.who === who) {
        const updated = [...prev];
        updated[updated.length - 1] = { who, text: `${last.text}${clean}` };
        return updated;
      }
      return [...prev.slice(-14), { who, text: clean.trimStart() }];
    });
  };

  const playChunk24k = async (base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    const samples = base64Pcm16ToFloat32(base64Audio);
    if (samples.length === 0) return;
    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.copyToChannel(new Float32Array(samples), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
  };

  const startSession = async () => {
    hasErrorRef.current = false;
    setErrorMsg(null);
    setMicNote(null);
    setStatus('connecting');

    try {
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await outputCtx.resume().catch(() => {});
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      let capturedStream: MediaStream | null = null;
      let inputCtx: AudioContext | null = null;

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          capturedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = capturedStream;
          inputCtx = new AudioContext({ sampleRate: 16000 });
          await inputCtx.resume().catch(() => {});
          inputCtxRef.current = inputCtx;
        } catch {
          setMicNote(
            language === 'ta'
              ? 'மைக்ரோஃபோன் அனுமதி கிடைக்கவில்லை — கீழே தட்டச்சு செய்து Gemini குரல் பதிலைக் கேட்கலாம்.'
              : 'Microphone unavailable — connected to Gemini Voice in text-to-speech mode below.'
          );
        }
      } else {
        setMicNote(
          language === 'ta'
            ? 'மைக்ரோஃபோன் கிடைக்கவில்லை — கீழே தட்டச்சு செய்து Gemini குரல் பதிலைக் கேட்கலாம்.'
            : 'Microphone unavailable — connected to Gemini Voice in text-to-speech mode below.'
        );
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/live?token=${encodeURIComponent(token)}&lang=${language}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            ready?: boolean;
            audio?: string;
            interrupted?: boolean;
            inputTranscript?: string;
            outputTranscript?: string;
            error?: string;
          };
          if (msg.error) {
            hasErrorRef.current = true;
            setErrorMsg(msg.error);
            setStatus('error');
            cleanupResources();
            return;
          }
          if (msg.ready) {
            setStatus('live');
            if (capturedStream && inputCtx) {
              setMicActive(true);
              const source = inputCtx.createMediaStreamSource(capturedStream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;
              source.connect(processor);
              processor.connect(inputCtx.destination);
              processor.onaudioprocess = (e) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                const pcmBase64 = float32ToBase64Pcm16(e.inputBuffer.getChannelData(0));
                ws.send(JSON.stringify({ audio: pcmBase64 }));
              };
            }
          }
          if (msg.audio) {
            void playChunk24k(msg.audio);
          }
          if (msg.interrupted && outputCtxRef.current) {
            nextStartTimeRef.current = outputCtxRef.current.currentTime;
          }
          if (msg.inputTranscript) {
            appendTranscript('user', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendTranscript('ai', msg.outputTranscript);
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onerror = () => {
        hasErrorRef.current = true;
        setErrorMsg(
          language === 'ta'
            ? 'Gemini குரல் இணைப்பில் பிழை ஏற்பட்டது.'
            : 'Gemini voice connection could not be established.'
        );
        setStatus('error');
        cleanupResources();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          cleanupResources();
          if (!hasErrorRef.current) {
            setStatus('idle');
          }
        }
      };
    } catch (err) {
      hasErrorRef.current = true;
      cleanupResources();
      setErrorMsg(
        err instanceof Error
          ? err.message
          : language === 'ta'
          ? 'Gemini குரல் அமர்வைத் தொடங்க முடியவில்லை.'
          : 'Unable to start Gemini voice session.'
      );
      setStatus('error');
    }
  };

  const handleSendTextToVoice = (e: React.FormEvent) => {
    e.preventDefault();
    const text = textPrompt.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (outputCtxRef.current?.state === 'suspended') {
      void outputCtxRef.current.resume();
    }
    wsRef.current.send(JSON.stringify({ text }));
    setTranscripts((prev) => [...prev.slice(-14), { who: 'user', text }]);
    setTextPrompt('');
  };

  const langLabel = getLanguageLabel(language);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-teal-300 font-semibold">
          <Sparkles className="w-4 h-4" />
          <span>
            Gemini Live Voice · {langLabel}
          </span>
        </div>

        <div className="py-2">
          <VoiceSoundWave active={status === 'live'} calm={calm} />
          <p className="text-xs text-slate-300 mt-2">
            {status === 'live'
              ? micActive
                ? language === 'ta'
                  ? 'Gemini Live கேட்கிறது... இயல்பாகப் பேசுங்கள்'
                  : `Gemini Live listening — speak naturally in ${langLabel}`
                : language === 'ta'
                ? 'Gemini குரல் தயாராக உள்ளது — கீழே உங்கள் கேள்வியை அனுப்பவும்'
                : `Gemini Live Voice active — ask below to hear Gemini reply in ${langLabel}`
              : status === 'connecting'
              ? language === 'ta'
                ? 'Gemini Live உடன் இணைக்கிறது...'
                : 'Connecting to Gemini Live Voice...'
              : language === 'ta'
              ? 'Gemini உடன் நேரடி குரல் உரையாடலைத் தொடங்குங்கள்'
              : 'Tap below to talk directly with Gemini Live Voice'}
          </p>
        </div>

        <div className="flex justify-center">
          {status === 'live' || status === 'connecting' ? (
            <SpringButton variant="danger" onClick={stopSession}>
              <MicOff className="w-4 h-4" />
              {language === 'ta' ? 'குரலை நிறுத்து' : 'End Gemini Voice'}
            </SpringButton>
          ) : (
            <SpringButton variant="primary" onClick={startSession}>
              <Mic className="w-4 h-4" />
              {language === 'ta' ? 'Gemini குரல் உரையாடல் தொடங்கு' : 'Start Gemini Voice Chat'}
            </SpringButton>
          )}
        </div>
      </div>

      {status === 'live' && (
        <form onSubmit={handleSendTextToVoice} className="flex gap-2">
          <input
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder={
              language === 'ta'
                ? 'மைக் இல்லாவிட்டாலும் Gemini-க்கு இங்கே தட்டச்சு செய்து குரல் பதில் கேட்கலாம்...'
                : 'Ask Gemini here anytime for a spoken audio reply...'
            }
            className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-teal-600"
          />
          <SpringButton type="submit" size="sm" disabled={!textPrompt.trim()}>
            <Volume2 className="w-3.5 h-3.5" />
            <Send className="w-3.5 h-3.5" />
          </SpringButton>
        </form>
      )}

      {micNote && (
        <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-800">
          {micNote}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-800">
          {errorMsg}
        </div>
      )}

      {transcripts.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200">
          {transcripts.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-xs p-2.5 rounded-xl ${
                item.who === 'user'
                  ? 'bg-white border border-slate-200 text-slate-800 ml-6'
                  : 'bg-teal-50 border border-teal-200 text-slate-900 mr-6'
              }`}
            >
              <span className="font-bold mr-1.5">
                {item.who === 'user'
                  ? language === 'ta'
                    ? 'நீங்கள்:'
                    : 'You:'
                  : 'Gemini:'}
              </span>
              {item.text}
            </motion.div>
          ))}
        </div>
      )}

      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-600 shrink-0" />
          {language === 'ta'
            ? 'அவசர நிலைகளுக்கு 108 அழைக்கவும்.'
            : 'For emergencies, call local emergency services.'}
        </span>
        <a
          href="tel:108"
          className="font-bold text-orange-700 inline-flex items-center gap-1 shrink-0 hover:underline"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          108 / 112
        </a>
      </div>
    </div>
  );
}
