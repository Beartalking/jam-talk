import React, { useState, useRef, useEffect } from 'react';
import { analyzeTranscript } from './utils/analyzeTranscript';
import { parseFeedback } from './utils/parseFeedback';

const WORDS = [
  'music', 'travel', 'technology', 'food', 'hobby', 'friendship', 'future', 'dream', 'challenge', 'success',
  'nature', 'book', 'movie', 'family', 'holiday', 'memory', 'adventure', 'learning', 'change', 'goal'
];

function getRandomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function getBrowserInfo() {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isChrome = /Chrome/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  
  return { isMobile, isChrome, isSafari, isIOS };
}

function App() {
  const [started, setStarted] = useState(false);
  const [word, setWord] = useState('');
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(60);
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [browserWarning, setBrowserWarning] = useState('');
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const { isMobile, isChrome, isSafari } = getBrowserInfo();
    
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setBrowserWarning('Speech recognition is not supported in this browser. Please try Chrome Desktop or Safari.');
    } else if (isMobile && isChrome) {
      setBrowserWarning('Recording may not work properly on Chrome Mobile. For best experience, please use Safari on mobile or Chrome on desktop.');
    }
  }, []);

  const handleStart = () => {
    setWord(getRandomWord());
    setStarted(true);
    
    // Track practice session start
    if (window.plausible) {
      window.plausible('Practice Started', { props: { word: getRandomWord() } });
    }
  };

  const handleMicrophoneClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please try:\n• Chrome on Desktop\n• Safari on Mobile\n• Edge on Desktop');
      return;
    }

    const { isMobile, isChrome } = getBrowserInfo();
    if (isMobile && isChrome) {
      const proceed = confirm('Chrome Mobile may have recording issues. Continue anyway?\n\nFor better experience, try Safari on mobile.');
      if (!proceed) return;
    }

    setRecording(true);
    setTranscript('');
    setAnalysis('');
    setTimer(60);

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };
    
    recognition.onerror = (event) => {
      setRecording(false);
      recognition.stop();
      clearInterval(timerRef.current);
      
      let errorMessage = 'Speech recognition error: ' + event.error;
      if (event.error === 'not-allowed') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (event.error === 'no-speech') {
        errorMessage = 'No speech detected. Please speak clearly and try again.';
      } else if (event.error === 'network') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      alert(errorMessage);
    };
    
    recognition.onend = async () => {
      setRecording(false);
      clearInterval(timerRef.current);
      if (finalTranscript.length > 0) {
        setLoadingAnalysis(true);
        
        // Track recording completion
        if (window.plausible) {
          window.plausible('Recording Completed', { 
            props: { 
              word: word,
              transcript_length: finalTranscript.length 
            } 
          });
        }
        
        try {
          const feedback = await analyzeTranscript(finalTranscript);
          setAnalysis(feedback);
          
          // Track feedback received
          if (window.plausible) {
            window.plausible('Feedback Received');
          }
        } catch (e) {
          setAnalysis('Analysis failed. Please try again.');
        }
        setLoadingAnalysis(false);
      }
    };
    
    recognition.start();

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          recognition.stop();
          setRecording(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (!started) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#fff',
        padding: '1rem',
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>JAM Talk</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#444' }}>
          Just a minute - Practice your English speaking skills!
        </p>
        
        {browserWarning && (
          <div style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            maxWidth: '400px',
            textAlign: 'center',
            fontSize: '0.9rem',
            border: '1px solid #ffeaa7',
          }}>
            ⚠️ {browserWarning}
          </div>
        )}
        
        <button
          style={{
            background: '#FF5722',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '100px',
            height: '100px',
            fontSize: '1.2rem',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#e64a19')}
          onMouseOut={e => (e.currentTarget.style.background = '#FF5722')}
          onClick={handleStart}
        >
          Start
        </button>
      </div>
    );
  }

  // Prompt or recording screen
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#fff',
    }}>
      <div style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>
        欢迎来到 JAM-Talk！现在给你一个单词，请用英文讲述 60 秒
      </div>
      <h2 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{word}</h2>
      <div style={{ fontSize: '1.1rem', color: '#888', marginBottom: '2rem' }}>
        ✏️ 点击麦克风按钮，规定时间围绕 "{word}" 进行 60 秒的英文表达<br/>
        例：What is it? What does it mean for you?
      </div>
      {/* Only show the button if analysis is not present */}
      {!analysis && (
        <button
          style={{
            background: recording ? '#e64a19' : '#FF5722',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '100px',
            height: '100px',
            fontSize: '1.2rem',
            cursor: recording ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            transition: 'background 0.2s',
            marginBottom: '1rem',
          }}
          onClick={recording ? undefined : handleMicrophoneClick}
          disabled={recording}
        >
          {recording ? 'Listening...' : '开始 60 秒'}
        </button>
      )}
      {/* Hide the button when analysis is shown */}
      {analysis && null}
      <div style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#222' }}>
        {recording && `⏱️ ${timer} 秒`}
      </div>
      {transcript && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#f9f9f9',
          borderRadius: '8px',
          maxWidth: '400px',
          color: '#333',
          fontSize: '1rem',
        }}>
          <strong>Transcript:</strong>
          <div>{transcript}</div>
        </div>
      )}
      {loadingAnalysis && (
        <div style={{ marginTop: '1rem', color: '#888' }}>Analyzing...</div>
      )}
      {analysis && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#e3f2fd',
          borderRadius: '8px',
          maxWidth: '600px',
          color: '#1a237e',
          fontSize: '1rem',
        }}>
          <FeedbackDisplay feedback={analysis} />
        </div>
      )}
      {analysis && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button
            style={{
              background: '#FF5722',
              color: '#fff',
              border: 'none',
              borderRadius: '24px',
              padding: '0.75rem 2rem',
              fontSize: '1.1rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'background 0.2s',
            }}
            onClick={() => {
              setStarted(false);
              setWord('');
              setTranscript('');
              setAnalysis('');
              
              // Track practice again
              if (window.plausible) {
                window.plausible('Practice Again');
              }
            }}
          >
            Practice again
          </button>
          <button
            style={{
              background: '#FFB300',
              color: '#fff',
              border: 'none',
              borderRadius: '24px',
              padding: '0.75rem 2rem',
              fontSize: '1.1rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'background 0.2s',
            }}
            onClick={() => {
              setShowPaywall(true);
              
              // Track premium feature interest
              if (window.plausible) {
                window.plausible('AI Coach Clicked');
              }
            }}
          >
            AI Coach
          </button>
        </div>
      )}
     
      {/* Paywall Modal */}
      {showPaywall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ color: '#FF5722', marginBottom: '1rem' }}>🎯 AI Coach Premium</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Get personalized coaching, detailed pronunciation analysis, and unlimited practice sessions!
            </p>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF5722' }}>$9.99/month</div>
              <div style={{ fontSize: '0.9rem', color: '#888' }}>7-day free trial</div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                style={{
                  background: '#FF5722',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '24px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
                onClick={() => {
                  // Track premium conversion attempt
                  if (window.plausible) {
                    window.plausible('Premium Trial Started');
                  }
                  alert('This is a demo - no actual payment required!');
                }}
              >
                Start Free Trial
              </button>
              <button
                style={{
                  background: '#ccc',
                  color: '#666',
                  border: 'none',
                  borderRadius: '24px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
                onClick={() => setShowPaywall(false)}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackDisplay({ feedback }) {
  const parsed = parseFeedback(feedback);

  return (
    <div>
      {/* Original Transcript */}
      {parsed.originalTranscript && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            🌿 原始转录
          </div>
          <div style={{ 
            background: '#f5f5f5', 
            padding: '0.75rem', 
            borderRadius: '4px',
            color: '#333'
          }}>
            {parsed.originalTranscript}
          </div>
        </div>
      )}

      {/* Grammar Suggestions */}
      {parsed.grammar.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            ✏️ 语法建议
          </div>
          {parsed.grammar.map((item, idx) => (
            <div key={idx} style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: '#fff3e0',
              borderRadius: '4px',
              border: '1px solid #ffcc80'
            }}>
              {item.original && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#d32f2f' }}>❌ 原句: </span>
                  {item.original}
                </div>
              )}
              {item.suggestion && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#388e3c' }}>✅ 建议: </span>
                  {item.suggestion}
                </div>
              )}
              {item.explanation && (
                <div>
                  <span style={{ color: '#f57c00' }}>💡 解释: </span>
                  {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary Upgrades */}
      {parsed.vocabulary.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            💬 词汇升级
          </div>
          {parsed.vocabulary.map((item, idx) => (
            <div key={idx} style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: '#e8f5e8',
              borderRadius: '4px',
              border: '1px solid #81c784'
            }}>
              {item.original && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#d32f2f' }}>❌ 原词: </span>
                  {item.original}
                </div>
              )}
              {item.suggestion && (
                <div>
                  <span style={{ color: '#388e3c' }}>✅ 建议: </span>
                  {item.suggestion}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pronunciation Tips */}
      {parsed.pronunciation.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            🔈 发音提示
          </div>
          {parsed.pronunciation.map((item, idx) => (
            <div key={idx} style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: '#fff8e1',
              borderRadius: '4px',
              border: '1px solid #ffb74d'
            }}>
              {item.word && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>单词: </span>
                  {item.word}
                </div>
              )}
              {item.problem && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#d32f2f' }}>❌ 问题: </span>
                  {item.problem}
                </div>
              )}
              {item.tip && (
                <div>
                  <span style={{ color: '#388e3c' }}>✅ 中文提示: </span>
                  {item.tip}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {parsed.summary && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            ⭐️ 一句话总结
          </div>
          <div style={{ 
            background: '#f3e5f5', 
            padding: '0.75rem', 
            borderRadius: '4px',
            color: '#7b1fa2',
            fontWeight: 'bold'
          }}>
            {parsed.summary}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 