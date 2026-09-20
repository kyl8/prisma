// ============================================================================
// PRISMA — Feedback sonoro centralizado
// ============================================================================
// API única para todos os sons de interface. Sons são discretos, com
// cooldown por tipo, cache de Audio, preload após a primeira interação
// (respeitando as regras de autoplay) e preferência persistida no
// localStorage (prisma_sound_enabled).
//
// Para adicionar um novo som:
// 1. Coloque o arquivo em public/sounds/.
// 2. Adicione o tipo em UISound e a entrada em SOUND_CONFIG.
// 3. Chame playUISound("novo-som") no ponto do evento (nunca no render).
// ============================================================================

import { useSyncExternalStore } from "react";

export type UISound =
  | "notification"
  | "success"
  | "submit"
  | "save"
  | "warning"
  | "error";

type SoundConfig = {
  src: string;
  volume: number;
  /** Impede que o mesmo som toque várias vezes em sequência. */
  cooldown: number;
};

const SOUND_CONFIG: Record<UISound, SoundConfig> = {
  notification: { src: "/sounds/notification.wav", volume: 0.22, cooldown: 300 },
  success: { src: "/sounds/success.wav", volume: 0.24, cooldown: 500 },
  submit: { src: "/sounds/submit.wav", volume: 0.24, cooldown: 600 },
  save: { src: "/sounds/save.wav", volume: 0.15, cooldown: 200 },
  warning: { src: "/sounds/warning.wav", volume: 0.18, cooldown: 300 },
  error: { src: "/sounds/error.wav", volume: 0.18, cooldown: 300 },
};

const STORAGE_KEY = "prisma_sound_enabled";

const audioCache = new Map<UISound, HTMLAudioElement>();
const lastPlayedAt = new Map<UISound, number>();

function readEnabled(): boolean {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

let enabled = typeof window !== "undefined" ? readEnabled() : true;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage indisponível */
  }
  emit();
}

export function toggleSound() {
  setSoundEnabled(!enabled);
}

/** Estado reativo do som para os botões dos headers. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => enabled);
}

function getAudio(type: UISound): HTMLAudioElement {
  const cached = audioCache.get(type);
  if (cached) return cached;
  const audio = new Audio(SOUND_CONFIG[type].src);
  audioCache.set(type, audio);
  return audio;
}

/**
 * Toca um som de interface. Não faz nada se os sons estiverem
 * desativados ou se o mesmo som tiver tocado há menos do cooldown.
 * Falhas de autoplay são silenciadas: o som é sempre complementar
 * ao feedback visual.
 */
export function playUISound(type: UISound) {
  if (!enabled) return;
  const config = SOUND_CONFIG[type];
  const now = Date.now();
  const last = lastPlayedAt.get(type) ?? 0;
  if (now - last < config.cooldown) return;
  lastPlayedAt.set(type, now);
  try {
    const audio = getAudio(type);
    audio.volume = config.volume;
    audio.currentTime = 0;
    audio.play().catch(() => {
      /* navegador bloqueou o áudio — sem erro no console */
    });
  } catch {
    /* áudio indisponível */
  }
}

let preloaded = false;

/** Carrega os arquivos em cache sem reproduzir (sem autoplay). */
export function preloadUISounds() {
  if (preloaded) return;
  preloaded = true;
  (Object.keys(SOUND_CONFIG) as UISound[]).forEach((type) => {
    try {
      getAudio(type).load();
    } catch {
      /* ignora falhas de carregamento */
    }
  });
}

if (typeof window !== "undefined") {
  // Preload somente após a primeira interação do usuário.
  window.addEventListener("pointerdown", preloadUISounds, { once: true });
}
