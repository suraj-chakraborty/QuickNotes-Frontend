import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  Users,
  Trophy,
  Zap,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Share2,
  CheckCircle2,
  XCircle,
  Award,
} from 'lucide-react';

const SAMPLE_TEXTS = {
  words25: "the quick brown fox jumps over the lazy dog while searching for knowledge in a world full of curiosity and constant digital innovation and fast progress",
  words50: "technology continues to evolve at a rapid pace shaping how we communicate create and solve complex problems together across the globe through collaboration open source software and creative engineering every new idea brings us closer to building tools that empower people to achieve their goals and create something truly meaningful",
  code: "function calculateSpeed(totalChars, seconds) { const minutes = seconds / 60; const words = totalChars / 5; return Math.round(words / minutes); } const result = calculateSpeed(250, 30); console.log(result);",
  quote: "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Do not settle. As with all matters of the heart, you will know when you find it.",
};

export default function TypingTest({ socket, documentId, onClose }) {
  const [testMode, setTestMode] = useState('time'); // 'time' | 'words' | 'quote' | 'code'
  const [timeLimit, setTimeLimit] = useState(30); // 15, 30, 60
  const [wordLimit, setWordLimit] = useState(25); // 25, 50, 100
  const [textCategory, setTextCategory] = useState('words50');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Multiplayer Race State
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [username, setUsername] = useState(() => localStorage.getItem('qn-username') || `Player_${Math.floor(1000 + Math.random() * 9000)}`);
  const [raceStatus, setRaceStatus] = useState('idle'); // 'idle' | 'countdown' | 'racing' | 'finished'
  const [countdown, setCountdown] = useState(3);
  const [players, setPlayers] = useState([]);

  // Local Typing Engine State
  const [targetText, setTargetText] = useState(SAMPLE_TEXTS.words50);
  const [userInput, setUserInput] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errorsCount, setErrorsCount] = useState(0);

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Audio Click Synthesizer
  const playClickSound = (isCorrect) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isCorrect ? 600 : 220, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // AudioContext fallback
    }
  };

  // Join multiplayer race on socket
  useEffect(() => {
    if (!socket || !isMultiplayer) return;

    socket.emit('join-race', { username });

    const handleRaceState = (state) => {
      if (state.players) setPlayers(state.players);
    };

    const handleRaceStarting = ({ text, startTime: startAt }) => {
      setTargetText(text);
      setRaceStatus('countdown');
      setUserInput('');
      setIsFinished(false);

      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          setRaceStatus('racing');
          setIsStarted(true);
          setStartTime(Date.now());
          if (inputRef.current) inputRef.current.focus();
        }
      }, 200);
    };

    socket.on('race-state-updated', handleRaceState);
    socket.on('race-starting', handleRaceStarting);

    return () => {
      socket.off('race-state-updated', handleRaceState);
      socket.off('race-starting', handleRaceStarting);
    };
  }, [socket, isMultiplayer, username]);

  // Restart / Reset Game
  const resetGame = (newText = null) => {
    clearInterval(timerRef.current);
    setUserInput('');
    setIsStarted(false);
    setIsFinished(false);
    setStartTime(null);
    setElapsedSeconds(0);
    setWpm(0);
    setAccuracy(100);
    setErrorsCount(0);
    setRaceStatus('idle');

    if (newText) {
      setTargetText(newText);
    } else {
      setTargetText(SAMPLE_TEXTS[textCategory] || SAMPLE_TEXTS.words50);
    }

    if (socket && isMultiplayer) {
      socket.emit('reset-race');
    }

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  };

  // Start Multiplayer Race
  const startMultiplayerRace = () => {
    if (!socket) return;
    socket.emit('start-race', { text: targetText });
  };

  // Calculate live statistics
  const updateStats = (inputStr, totalTimeSec) => {
    if (totalTimeSec <= 0 || inputStr.length === 0) return;

    let correctChars = 0;
    let errors = 0;

    for (let i = 0; i < inputStr.length; i++) {
      if (inputStr[i] === targetText[i]) {
        correctChars++;
      } else {
        errors++;
      }
    }

    const minutes = totalTimeSec / 60;
    const calculatedWpm = Math.max(0, Math.round((correctChars / 5) / minutes));
    const calculatedAcc = Math.round((correctChars / inputStr.length) * 100);

    setWpm(calculatedWpm);
    setAccuracy(calculatedAcc);
    setErrorsCount(errors);

    const progressPercent = Math.min(100, Math.round((inputStr.length / targetText.length) * 100));

    // Send update to multiplayer server
    if (socket && isMultiplayer) {
      socket.emit('update-race-progress', {
        progress: progressPercent,
        wpm: calculatedWpm,
        accuracy: calculatedAcc,
        finished: inputStr.length >= targetText.length,
      });
    }
  };

  // Timer Tick
  useEffect(() => {
    if (isStarted && !isFinished) {
      timerRef.current = setInterval(() => {
        const timeNow = (Date.now() - startTime) / 1000;
        setElapsedSeconds(Math.floor(timeNow));
        updateStats(userInput, timeNow);

        // Check if time-based mode finished
        if (testMode === 'time' && timeNow >= timeLimit) {
          finishTest();
        }
      }, 250);
    }

    return () => clearInterval(timerRef.current);
  }, [isStarted, isFinished, startTime, userInput, testMode, timeLimit]);

  const finishTest = () => {
    clearInterval(timerRef.current);
    setIsFinished(true);
    setIsStarted(false);
    setRaceStatus('finished');
  };

  // Handle typing key inputs
  const handleInputChange = (e) => {
    if (isFinished) return;

    const val = e.target.value;

    if (!isStarted) {
      setIsStarted(true);
      setStartTime(Date.now());
      setRaceStatus('racing');
    }

    const lastCharIdx = val.length - 1;
    if (lastCharIdx >= 0 && lastCharIdx < targetText.length) {
      const isCharCorrect = val[lastCharIdx] === targetText[lastCharIdx];
      playClickSound(isCharCorrect);
    }

    setUserInput(val);

    const timePassed = Math.max(0.5, (Date.now() - (startTime || Date.now())) / 1000);
    updateStats(val, timePassed);

    // Finish when input matches or exceeds target length
    if (val.length >= targetText.length) {
      finishTest();
    }
  };

  // Text Breakdown rendering
  const renderedChars = useMemo(() => {
    return targetText.split('').map((char, index) => {
      let state = 'pending';
      if (index < userInput.length) {
        state = userInput[index] === char ? 'correct' : 'incorrect';
      }
      const isCurrent = index === userInput.length;

      return (
        <span
          key={index}
          className={`race-char ${state} ${isCurrent ? 'current' : ''}`}
        >
          {char}
        </span>
      );
    });
  }, [targetText, userInput]);

  return (
    <div className="typing-test-overlay">
      <div className="typing-test-container">
        {/* Header Controls */}
        <div className="typing-header">
          <div className="typing-title-group">
            <div className="logo-icon-sm">
              <Zap size={15} />
            </div>
            <h3>Speed Typing Race</h3>
          </div>

          {/* Test Mode Filters */}
          <div className="typing-controls-row">
            <button
              className={`pill-btn ${!isMultiplayer ? 'active' : ''}`}
              onClick={() => {
                setIsMultiplayer(false);
                resetGame();
              }}
            >
              Solo Practice
            </button>

            <button
              className={`pill-btn ${isMultiplayer ? 'active' : ''}`}
              onClick={() => {
                setIsMultiplayer(true);
                resetGame();
              }}
            >
              <Users size={14} />
              <span>Multiplayer Room</span>
            </button>

            <div className="divider-vert"></div>

            <button
              className={`pill-btn ${textCategory === 'words25' ? 'active' : ''}`}
              onClick={() => {
                setTextCategory('words25');
                resetGame(SAMPLE_TEXTS.words25);
              }}
            >
              Short (25w)
            </button>

            <button
              className={`pill-btn ${textCategory === 'words50' ? 'active' : ''}`}
              onClick={() => {
                setTextCategory('words50');
                resetGame(SAMPLE_TEXTS.words50);
              }}
            >
              Standard (50w)
            </button>

            <button
              className={`pill-btn ${textCategory === 'code' ? 'active' : ''}`}
              onClick={() => {
                setTextCategory('code');
                resetGame(SAMPLE_TEXTS.code);
              }}
            >
              Code Syntax
            </button>

            <button
              className="action-btn icon-only"
              onClick={() => setSoundEnabled((prev) => !prev)}
              title={soundEnabled ? 'Mute typing audio' : 'Enable typing audio'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <button className="action-btn icon-only" onClick={onClose} title="Close Speed Test">
              ✕
            </button>
          </div>
        </div>

        {/* Live Metrics Dashboard */}
        <div className="metrics-dashboard">
          <div className="metric-box">
            <span className="metric-label">WPM</span>
            <span className="metric-val primary">{wpm}</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Accuracy</span>
            <span className="metric-val">{accuracy}%</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Time</span>
            <span className="metric-val">{elapsedSeconds}s</span>
          </div>

          <div className="metric-box">
            <span className="metric-label">Errors</span>
            <span className="metric-val danger">{errorsCount}</span>
          </div>
        </div>

        {/* Multiplayer Leaderboard / Race Tracks */}
        {isMultiplayer && (
          <div className="race-tracks-container">
            <div className="race-tracks-header">
              <span className="race-tracks-title">
                <Trophy size={14} /> Live Competitors ({players.length})
              </span>
              {raceStatus === 'idle' && (
                <button className="action-btn primary" onClick={startMultiplayerRace}>
                  <Play size={13} /> Start Race for All
                </button>
              )}
            </div>

            <div className="tracks-list">
              {players.map((player) => (
                <div key={player.id} className="player-track">
                  <div className="player-meta">
                    <span className="player-name">{player.username}</span>
                    <span className="player-wpm">{player.wpm} WPM</span>
                  </div>
                  <div className="track-bar">
                    <div
                      className="track-progress"
                      style={{ width: `${player.progress || 0}%` }}
                    ></div>
                  </div>
                  {player.rank && (
                    <span className="player-badge">#{player.rank}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {raceStatus === 'countdown' && (
          <div className="countdown-banner">
            <h2>{countdown > 0 ? countdown : 'GO!'}</h2>
            <p>Get your fingers ready...</p>
          </div>
        )}

        {/* Target Words Display Box */}
        <div
          className="typing-words-box"
          onClick={() => {
            if (inputRef.current) inputRef.current.focus();
          }}
        >
          {renderedChars}
        </div>

        {/* Invisible Typing Input Focus Target */}
        <input
          ref={inputRef}
          type="text"
          className="hidden-typing-input"
          value={userInput}
          onChange={handleInputChange}
          autoFocus
          disabled={raceStatus === 'countdown'}
        />

        {/* Bottom Quick Controls */}
        <div className="typing-footer">
          <button className="action-btn primary" onClick={() => resetGame()}>
            <RotateCcw size={14} />
            <span>Restart Test (Tab)</span>
          </button>
          <span className="typing-hint">Click anywhere on the text or start typing to begin</span>
        </div>

        {/* Results Screen Modal */}
        {isFinished && (
          <div className="results-overlay">
            <div className="results-card">
              <div className="results-header">
                <Award size={28} color="var(--accent-primary)" />
                <h2>Test Completed!</h2>
              </div>

              <div className="results-grid">
                <div className="res-stat">
                  <span className="res-stat-label">Net Speed</span>
                  <span className="res-stat-val primary">{wpm} WPM</span>
                </div>
                <div className="res-stat">
                  <span className="res-stat-label">Accuracy</span>
                  <span className="res-stat-val">{accuracy}%</span>
                </div>
                <div className="res-stat">
                  <span className="res-stat-label">Total Time</span>
                  <span className="res-stat-val">{elapsedSeconds}s</span>
                </div>
                <div className="res-stat">
                  <span className="res-stat-label">Mistakes</span>
                  <span className="res-stat-val danger">{errorsCount}</span>
                </div>
              </div>

              <div className="results-actions">
                <button className="action-btn primary" onClick={() => resetGame()}>
                  <RotateCcw size={14} /> Try Again
                </button>
                <button
                  className="action-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(`⚡ I just scored ${wpm} WPM with ${accuracy}% accuracy on QuickNotes Typing Race!`);
                    alert('Score copied to clipboard!');
                  }}
                >
                  <Share2 size={14} /> Share Score
                </button>
                <button className="action-btn" onClick={onClose}>
                  Back to Notes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
