import React, { useState, useRef, useEffect } from 'react';
import { analyzeTranscript } from './utils/analyzeTranscript';
import { parseFeedback } from './utils/parseFeedback';
import { redirectToCheckout } from './utils/stripe';
import { getUsageStats, incrementUsage, canPractice, setSubscriptionStatus, resetUsageCount } from './utils/usageTracker';

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
  const [usageStats, setUsageStats] = useState(getUsageStats());
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

    // Check for successful payment callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setSubscriptionStatus('active');
      setUsageStats(getUsageStats());
      alert('🎉 Payment successful! You now have unlimited practice sessions.');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
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
    // Check usage limit first
    if (!canPractice()) {
      setShowPaywall(true);
      return;
    }

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
        
        // Increment usage count
        incrementUsage();
        setUsageStats(getUsageStats());
        
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
        <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#444' }}>
          Just a minute - Practice your English speaking skills!
        </p>
        
        {/* Usage Stats */}
        <div style={{
          background: usageStats.isSubscribed ? '#e8f5e8' : '#fff3e0',
          color: usageStats.isSubscribed ? '#2e7d32' : '#f57c00',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          border: `1px solid ${usageStats.isSubscribed ? '#81c784' : '#ffb74d'}`,
        }}>
          {usageStats.isSubscribed ? (
            '🎉 Premium用户 - 无限练习'
          ) : (
            `🆓 免费体验: ${usageStats.remainingFree}/${2} 次剩余`
          )}
        </div>
        
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
        
        {/* Test Reset Button - Remove in production */}
        {(window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app')) && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              style={{
                background: '#9e9e9e',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              onClick={() => {
                resetUsageCount();
                setSubscriptionStatus('inactive');
                setUsageStats(getUsageStats());
                alert('Usage reset for testing!');
              }}
            >
              🔄 Reset Usage (Test)
            </button>
            <button
              style={{
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              onClick={() => {
                localStorage.setItem('jamtalk_test_mode', 'true');
                alert('Test mode enabled! Now you can use test cards.');
              }}
            >
              🧪 Enable Test Mode
            </button>
          </div>
        )}
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
      
      {/* Survey Section */}
      {analysis && (
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f8f9fa',
          borderRadius: '12px',
          maxWidth: '500px',
          textAlign: 'center',
          border: '1px solid #e9ecef',
        }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#495057' }}>
            📝 帮助我们改进 JAM Talk
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '1rem', lineHeight: '1.4' }}>
            您的体验如何？请花1分钟填写问卷，帮助我们打造更好的英语口语练习工具
          </div>
          <a
            href="https://tally.so/r/mK20dg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#6c757d',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '20px',
              padding: '0.6rem 1.5rem',
              fontSize: '0.9rem',
              transition: 'background 0.2s',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#5a6268')}
            onMouseOut={e => (e.currentTarget.style.background = '#6c757d')}
            onClick={() => {
              // Track survey click
              if (window.plausible) {
                window.plausible('Survey Clicked');
              }
            }}
          >
            填写问卷 (1分钟)
          </a>
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
            maxWidth: '450px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ color: '#FF5722', marginBottom: '1rem' }}>🎯 解锁无限练习</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              您已用完 2 次免费体验！升级到 Premium 获取无限练习机会和 AI 个性化辅导。
            </p>
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF5722' }}>$9.99/月</div>
              <div style={{ fontSize: '0.9rem', color: '#888' }}>7天免费试用</div>
            </div>
            
            {/* Payment Button */}
            <button
              style={{
                background: '#FF5722',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: '1rem',
                width: '100%',
                transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#e64a19')}
              onMouseOut={e => (e.currentTarget.style.background = '#FF5722')}
              onClick={async () => {
                try {
                  // Debug: Check if Stripe key is loaded
                  console.log('Stripe key loaded:', !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
                  console.log('Starting checkout with price ID:', 'price_1RjSXJRPpCqX9umiVW7UQoHt');
                  
                  // Track premium conversion attempt
                  if (window.plausible) {
                    window.plausible('Premium Payment Started');
                  }
                  
                  // Use your actual Stripe Price ID
                  const priceId = 'price_1RjSXJRPpCqX9umiVW7UQoHt';
                  
                  // Try live mode first, fallback to test if needed
                  try {
                    await redirectToCheckout(priceId);
                  } catch (stripeError) {
                    console.error('Live mode failed, error:', stripeError);
                    // If you have a test price ID, you could try that here
                    throw stripeError;
                  }
                } catch (error) {
                  console.error('Payment error details:', error);
                  console.error('Error message:', error.message);
                  console.error('Error type:', error.type);
                  alert(`支付系统错误: ${error.message || '请稍后再试'}`);
                }
              }}
            >
              开始免费试用
            </button>
            
            {/* Waitlist Button */}
            <a
                             href="https://tally.so/r/mV7yzM"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                background: '#6c757d',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '24px',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                marginBottom: '1rem',
                transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#5a6268')}
              onMouseOut={e => (e.currentTarget.style.background = '#6c757d')}
              onClick={() => {
                // Track waitlist signup
                if (window.plausible) {
                  window.plausible('Waitlist Clicked');
                }
              }}
            >
              加入等待名单
            </a>
            
            {/* Close Button */}
            <button
              style={{
                background: 'transparent',
                color: '#999',
                border: 'none',
                borderRadius: '24px',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
              onClick={() => setShowPaywall(false)}
            >
              暂时不需要
            </button>
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