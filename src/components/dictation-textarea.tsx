"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Voice-dictation textarea (AI recommendation doc §21) using the browser's
 * native Web Speech API — no server call, no API key. Falls back to a plain
 * textarea (mic button hidden) in browsers without SpeechRecognition support
 * (notably Firefox and Safari as of this writing).
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

export function DictationTextarea({
  label,
  name,
  rows = 3,
  placeholder,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const chunks: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunks.push(event.results[i][0].transcript);
      }
      const transcript = chunks.join(" ").trim();
      const el = textareaRef.current;
      if (el && transcript) {
        const needsSpace = el.value.length > 0 && !/[\s\n]$/.test(el.value);
        el.value = el.value + (needsSpace ? " " : "") + transcript;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setSupported(true);

    return () => recognition.stop();
  }, []);

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  }

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
        {supported && (
          <button
            type="button"
            onClick={toggle}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              listening
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-300 text-ink-500 hover:bg-slate-50"
            }`}
          >
            <span aria-hidden>{listening ? "●" : "🎤"}</span>
            {listening ? "Listening…" : "Dictate"}
          </button>
        )}
      </span>
      <textarea
        ref={textareaRef}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500"
      />
    </label>
  );
}
