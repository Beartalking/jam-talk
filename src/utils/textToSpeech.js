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

// OpenAI TTS Service for high-quality voices
export class OpenAITTSService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.currentAudio = null;
    this.isPlaying = false;
  }

  async generateSpeech(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: options.voice || 'alloy', // alloy, echo, fable, onyx, nova, shimmer
        speed: options.speed || 0.9, // 0.25 to 4.0
        response_format: 'mp3'
      }),
      signal: options.abortSignal // Add abort signal support
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API error: ${response.status}`);
    }

    return response.blob();
  }

  async speak(text, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        // Stop any current playback
        this.stop();

        // Check if already aborted
        if (options.abortSignal?.aborted) {
          reject(new Error('Aborted'));
          return;
        }

        // Track TTS generation start
        if (options.onStart) options.onStart();

        // Generate speech using OpenAI
        const audioBlob = await this.generateSpeech(text, options);
        
        // Check if aborted during generation
        if (options.abortSignal?.aborted) {
          reject(new Error('Aborted'));
          return;
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create audio element
        this.currentAudio = new Audio(audioUrl);
        this.isPlaying = true;

        // Set up event listeners
        this.currentAudio.onended = () => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          if (options.onEnd) options.onEnd();
          resolve();
        };

        this.currentAudio.onerror = (error) => {
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          if (options.onError) options.onError(error);
          reject(error);
        };

        // Handle manual stop during playback
        this.currentAudio.onpause = () => {
          if (this.currentAudio && this.currentAudio.currentTime === 0) {
            URL.revokeObjectURL(audioUrl);
          }
        };

        // Handle abort signal
        if (options.abortSignal) {
          options.abortSignal.addEventListener('abort', () => {
            this.stop();
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Aborted'));
          });
        }

        // Start playback
        await this.currentAudio.play();
        
      } catch (error) {
        this.isPlaying = false;
        this.currentAudio = null;
        if (options.onError) options.onError(error);
        reject(error);
      }
    });
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Clean up the audio element completely
      this.currentAudio.src = '';
      this.currentAudio.load();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }

  pause() {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
    }
  }

  resume() {
    if (this.currentAudio && !this.isPlaying) {
      this.currentAudio.play();
    }
  }
}

// Enhanced TTS Service using OpenAI TTS only
export class EnhancedTTSService {
  constructor() {
    this.openaiTTS = new OpenAITTSService();
    this.isPlaying = false;
    this.currentService = null;
    this.isGenerating = false;
    this.abortController = null;
  }

  async speak(text, options = {}) {
    // Prevent multiple simultaneous requests
    if (this.isGenerating || this.isPlaying) {
      console.log('TTS already in progress, stopping previous and starting new...');
      this.stop();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Create new abort controller for this request
    this.abortController = new AbortController();
    this.isGenerating = true;
    
    const enhancedOptions = {
      ...options,
      onStart: () => {
        this.isGenerating = false;
        this.isPlaying = true;
        if (options.onStart) options.onStart();
      },
      onEnd: () => {
        this.isGenerating = false;
        this.isPlaying = false;
        this.currentService = null;
        this.abortController = null;
        if (options.onEnd) options.onEnd();
      },
      onError: (error) => {
        this.isGenerating = false;
        this.isPlaying = false;
        this.currentService = null;
        this.abortController = null;
        if (options.onError) options.onError(error);
      }
    };

    try {
      // Use OpenAI TTS only
      console.log('Attempting OpenAI TTS...');
      this.currentService = 'openai';
      await this.openaiTTS.speak(text, { 
        ...enhancedOptions,
        abortSignal: this.abortController.signal 
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('OpenAI TTS aborted');
        return;
      }
      
      console.error('OpenAI TTS failed:', error);
      
      // Clean up states on failure
      this.isGenerating = false;
      this.isPlaying = false;
      this.currentService = null;
      this.abortController = null;
      
      // Rethrow the error to let the UI handle it
      throw error;
    }
  }

  stop() {
    // Abort any ongoing generation
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.isGenerating = false;
    this.isPlaying = false;
    
    // Stop OpenAI TTS service
    try {
      this.openaiTTS.stop();
    } catch (error) {
      console.log('Error stopping OpenAI TTS:', error);
    }
    
    this.currentService = null;
  }

  pause() {
    if (this.currentService === 'openai') {
      this.openaiTTS.pause();
    }
  }

  resume() {
    if (this.currentService === 'openai') {
      this.openaiTTS.resume();
    }
  }
}

// Create a singleton instance
export const ttsService = new EnhancedTTSService(); 