import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { PronunciationResult } from "../types";

const pronunciationTool: FunctionDeclaration = {
  name: "submit_pronunciation_evaluation",
  description: "Call this function when the user has finished speaking the sentence to submit their pronunciation score.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: "Score from 0-100" },
      generalFeedback: { type: Type.STRING, description: "Advice in Vietnamese regarding intonation and clarity" },
      words: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            isCorrect: { type: Type.BOOLEAN },
            ipa: { type: Type.STRING, description: "The IPA notation of how the user pronounced it (if wrong) or correct IPA" },
            errorType: { type: Type.STRING, description: "Brief error e.g. 'Silent letter', 'Wrong vowel'" },
          },
        },
      },
    },
    required: ["score", "generalFeedback", "words"],
  },
};

export class GeminiLiveService {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private stream: MediaStream | null = null;
  public isConnected = false;
  
  // Callbacks
  public onEvaluationResult: ((result: PronunciationResult) => void) | null = null;
  public onAudioData: ((volume: number) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  async connect(targetSentence: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Setup Input Context (Microphone) - Request 16kHz
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      // 2. Setup Output Context (Speaker) - 24kHz for Gemini response
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        },
        systemInstruction: `You are a strict American English Pronunciation Coach. 
        The user MUST read this exact sentence: "${targetSentence}".
        
        Instructions:
        1. Listen to the user.
        2. If they are silent, wait.
        3. Once they speak the full sentence, analyze their pronunciation immediately.
        4. Call 'submit_pronunciation_evaluation' with the score (0-100), feedback in Vietnamese, and word-by-word analysis.
        5. AFTER calling the tool, say a short encouraging phrase like "Good job" or "Try again" based on the score.
        `,
        tools: [{ functionDeclarations: [pronunciationTool] }],
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: config,
        callbacks: {
          onopen: () => {
            console.log("Live Session Connected");
            this.isConnected = true;
            // IMPORTANT: Pass the promise so sendRealtimeInput waits for it
            this.startAudioInput(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (The Score)
            if (message.toolCall) {
              console.log("Tool call received", message.toolCall);
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === "submit_pronunciation_evaluation") {
                  if (this.onEvaluationResult) {
                    this.onEvaluationResult(fc.args as unknown as PronunciationResult);
                  }
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: [{
                      id: fc.id,
                      name: fc.name,
                      response: { result: "ok" }
                    }]
                  }));
                }
              }
            }

            // Handle Audio Output (The Voice)
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
               await this.playAudio(audioData);
            }
          },
          onclose: () => {
            console.log("Session Closed");
            this.isConnected = false;
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.isConnected = false;
            if (this.onError) this.onError("Kết nối bị gián đoạn. Vui lòng thử lại.");
          }
        }
      });

      await sessionPromise; 

    } catch (err) {
      console.error(err);
      this.disconnect();
      if (this.onError) this.onError("Không thể kết nối với AI (Microphone hoặc Mạng).");
    }
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    // Buffer size 2048 for lower latency (approx 128ms at 16k)
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
      const avg = sum / inputData.length;
      if (this.onAudioData) this.onAudioData(avg);

      // Resample logic
      let pcm16: Int16Array;
      const currentRate = this.inputAudioContext!.sampleRate;
      
      if (currentRate !== 16000) {
         pcm16 = this.downsampleTo16k(inputData, currentRate);
      } else {
         pcm16 = this.floatTo16BitPCM(inputData);
      }

      const base64Data = this.arrayBufferToBase64(pcm16.buffer);

      sessionPromise.then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Data
          }
        });
      }).catch(err => {
          console.error("Send Input Error:", err);
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playAudio(base64String: string) {
    if (!this.outputAudioContext) return;
    
    if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
    }
    
    this.nextStartTime = Math.max(this.outputAudioContext.currentTime, this.nextStartTime);

    const audioBytes = this.base64ToArrayBuffer(base64String);
    const audioBuffer = await this.pcmToAudioBuffer(audioBytes, this.outputAudioContext);

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioContext.destination);
    source.start(this.nextStartTime);
    
    this.nextStartTime += audioBuffer.duration;
  }

  async disconnect() {
    this.isConnected = false;
    try {
      if (this.processor) {
        this.processor.disconnect();
        this.processor.onaudioprocess = null;
      }
      if (this.inputSource) this.inputSource.disconnect();
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.inputAudioContext) await this.inputAudioContext.close();
      if (this.outputAudioContext) await this.outputAudioContext.close();
    } catch (e) {
      console.error("Disconnect cleanup error", e);
    }
  }

  // --- Helpers ---

  private downsampleTo16k(input: Float32Array, inputRate: number) {
      if (inputRate === 16000) return this.floatTo16BitPCM(input);
      const ratio = inputRate / 16000;
      const newLength = Math.ceil(input.length / ratio);
      const output = new Int16Array(newLength);
      
      for (let i = 0; i < newLength; i++) {
          const offset = Math.floor(i * ratio);
          // Check bounds
          if (offset < input.length) {
            const s = Math.max(-1, Math.min(1, input[offset]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
      }
      return output;
  }

  private floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async pcmToAudioBuffer(data: ArrayBuffer, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data);
    const sampleRate = 24000; 
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }
}