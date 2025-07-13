export class TextToSpeechService {
  constructor() {
    this.synthesis = window.speechSynthesis;
    this.voice = null;
    this.isPlaying = false;
    this.currentUtterance = null;
    
    // Initialize with preferred voice
    this.initializeVoice();
  }
  
  initializeVoice() {
    // Wait for voices to load
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      
      // Prefer native English voices
      const preferredVoices = [
        'Alex', // macOS
        'Samantha', // macOS
        'Microsoft Zira - English (United States)', // Windows
        'Google US English', // Chrome
        'en-US'
      ];
      
      for (const preferredVoice of preferredVoices) {
        const voice = voices.find(v => 
          v.name.includes(preferredVoice) || 
          v.lang.startsWith('en-US') || 
          v.lang.startsWith('en-GB')
        );
        if (voice) {
          this.voice = voice;
          break;
        }
      }
      
      // Fallback to first English voice
      if (!this.voice) {
        this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      }
    };
    
    if (this.synthesis.getVoices().length > 0) {
      setVoice();
    } else {
      this.synthesis.addEventListener('voiceschanged', setVoice);
    }
  }
  
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
      
      // Stop any current speech
      this.stop();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set voice and options
      if (this.voice) {
        utterance.voice = this.voice;
      }
      
      utterance.rate = options.rate || 0.9; // Slightly slower for clarity
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;
      utterance.lang = options.lang || 'en-US';
      
      // Set up event listeners
      utterance.onstart = () => {
        this.isPlaying = true;
        if (options.onStart) options.onStart();
      };
      
      utterance.onend = () => {
        this.isPlaying = false;
        this.currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve();
      };
      
      utterance.onerror = (event) => {
        this.isPlaying = false;
        this.currentUtterance = null;
        if (options.onError) options.onError(event);
        reject(event);
      };
      
      // Store current utterance
      this.currentUtterance = utterance;
      
      // Start speaking
      this.synthesis.speak(utterance);
    });
  }
  
  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isPlaying = false;
      this.currentUtterance = null;
    }
  }
  
  pause() {
    if (this.synthesis && this.isPlaying) {
      this.synthesis.pause();
    }
  }
  
  resume() {
    if (this.synthesis && this.synthesis.paused) {
      this.synthesis.resume();
    }
  }
  
  getAvailableVoices() {
    return this.synthesis ? this.synthesis.getVoices() : [];
  }
  
  setVoice(voiceName) {
    const voices = this.getAvailableVoices();
    const voice = voices.find(v => v.name === voiceName);
    if (voice) {
      this.voice = voice;
    }
  }
}

// Create a singleton instance
export const ttsService = new TextToSpeechService(); 