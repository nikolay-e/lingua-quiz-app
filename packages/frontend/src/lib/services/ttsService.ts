import api from '../../api';

export interface TTSState {
  isAvailable: boolean;
  supportedLanguages: string[];
  isPlaying: boolean;
}

export class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private state: TTSState = {
    isAvailable: false,
    supportedLanguages: [],
    isPlaying: false,
  };
  private stateCallbacks: ((state: TTSState) => void)[] = [];

  subscribe(callback: (state: TTSState) => void): () => void {
    this.stateCallbacks.push(callback);
    callback(this.state);

    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateCallbacks.splice(index, 1);
      }
    };
  }

  private updateState(updates: Partial<TTSState>): void {
    this.state = { ...this.state, ...updates };
    this.stateCallbacks.forEach((callback) => callback(this.state));
  }

  async initializeLanguages(token: string): Promise<void> {
    try {
      const ttsData = await api.getTTSLanguages(token);
      this.updateState({
        isAvailable: ttsData.available,
        supportedLanguages: ttsData.supportedLanguages || [],
      });
    } catch (error: unknown) {
      console.warn('Failed to load TTS languages:', error);
      this.updateState({
        isAvailable: false,
        supportedLanguages: [],
      });
    }
  }

  canUseTTS(language: string): boolean {
    return this.state.isAvailable && this.state.supportedLanguages.includes(language);
  }

  async playTTS(token: string, text: string, language: string): Promise<void> {
    if (!this.canUseTTS(language) || this.state.isPlaying) {
      return;
    }

    this.stopCurrentAudio();
    this.updateState({ isPlaying: true });

    try {
      const ttsData = await api.synthesizeSpeech(token, text, language);
      const audioBlob = new Blob([Uint8Array.from(atob(ttsData.audioData), (c) => c.charCodeAt(0))], {
        type: 'audio/mpeg',
      });
      const audioUrl = URL.createObjectURL(audioBlob);

      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onended = (): void => {
        this.updateState({ isPlaying: false });
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      this.currentAudio.onerror = (): void => {
        this.updateState({ isPlaying: false });
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
      };

      await this.currentAudio.play();
    } catch (error: unknown) {
      console.error('TTS playback failed:', error);
      this.updateState({ isPlaying: false });
    }
  }

  stopCurrentAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
      this.updateState({ isPlaying: false });
    }
  }

  getState(): TTSState {
    return { ...this.state };
  }

  destroy(): void {
    this.stopCurrentAudio();
    this.stateCallbacks = [];
  }
}

export const ttsService = new TTSService();
