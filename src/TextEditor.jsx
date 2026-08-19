import { useCallback, useEffect, useState, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidV4 } from 'uuid';
import {
  FileText,
  Plus,
  Share2,
  Download,
  Moon,
  Sun,
  Users,
  Printer,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
  Clock,
  Palette,
  Type,
  History,
  Check,
  X,
  FileCode,
  Globe,
  ChevronDown,
  Target,
  Zap,
  LayoutTemplate,
  Keyboard,
} from 'lucide-react';
import TypingTest from './TypingTest';

const SAVE_INTERVAL = 2000;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Register Undo / Redo SVG Icons into Quill's icon registry
const icons = Quill.import('ui/icons');
icons['undo'] = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
icons['redo'] = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;

// Complete, rich toolbar configuration
const TOOLBAR_OPTIONS = [
  ['undo', 'redo'],
  [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
  [{ indent: '-1' }, { indent: '+1' }],
  [{ direction: 'rtl' }],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'video'],
  ['clean'],
];

// Document Starter Templates
const TEMPLATES = [
  {
    id: 'meeting',
    title: 'Meeting Notes',
    desc: 'Agenda, discussion items, and action items with owners.',
    icon: Users,
    html: `
      <h2>📅 Meeting Notes</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()} | <strong>Attendees:</strong> [Names]</p>
      <hr/>
      <h3>🎯 Agenda</h3>
      <ul><li>Discussion point 1</li><li>Discussion point 2</li></ul>
      <h3>💬 Key Decisions</h3>
      <blockquote>Decided to proceed with Phase 1 rollout next week.</blockquote>
      <h3>✅ Action Items</h3>
      <ul data-checked="false">
        <li data-checked="false"><strong>Owner:</strong> Complete documentation</li>
        <li data-checked="false"><strong>Owner:</strong> Review PR and deploy to staging</li>
      </ul>
    `,
  },
  {
    id: 'prd',
    title: 'Product Requirements (PRD)',
    desc: 'Goal, user problem, user stories, and acceptance criteria.',
    icon: Target,
    html: `
      <h2>🚀 Feature: [Feature Name]</h2>
      <p><strong>Status:</strong> In Review | <strong>Author:</strong> [Your Name]</p>
      <hr/>
      <h3>1. Problem Statement</h3>
      <p>Why are we building this? Who is the user and what pain point are we solving?</p>
      <h3>2. Goals & Success Metrics</h3>
      <ul>
        <li>Increase user engagement by 20%</li>
        <li>Reduce task completion time to under 1 minute</li>
      </ul>
      <h3>3. User Stories</h3>
      <p>As a <em>[user type]</em>, I want to <em>[action]</em> so that <em>[benefit]</em>.</p>
      <h3>4. Technical Requirements & Out of Scope</h3>
      <pre class="ql-syntax">API endpoint: /api/v1/resource\nPayload: { id, title, content }</pre>
    `,
  },
  {
    id: 'tasks',
    title: 'Sprint Checklist',
    desc: 'Prioritized task list with interactive check boxes.',
    icon: Check,
    html: `
      <h2>⚡ Sprint Task Checklist</h2>
      <hr/>
      <h3>🔥 High Priority</h3>
      <ul data-checked="false">
        <li data-checked="false">Fix critical websocket reconnect latency</li>
        <li data-checked="false">Upgrade styling and mobile viewport responsiveness</li>
      </ul>
      <h3>⭐ Medium Priority</h3>
      <ul data-checked="false">
        <li data-checked="false">Add dark/light mode toggle with persistence</li>
        <li data-checked="false">Implement export to Markdown and PDF</li>
      </ul>
      <h3>💡 Backlog</h3>
      <ul data-checked="false">
        <li data-checked="false">User authentication & workspace management</li>
      </ul>
    `,
  },
  {
    id: 'tech',
    title: 'Technical Design Doc',
    desc: 'Architecture overview, data models, and API interfaces.',
    icon: FileCode,
    html: `
      <h2>💻 Technical Architecture Spec</h2>
      <hr/>
      <h3>1. Overview & Context</h3>
      <p>High-level architecture design for real-time synchronization.</p>
      <h3>2. System Architecture</h3>
      <p>Frontend (React 19 + Vite) ⟷ WebSockets (Socket.IO) ⟷ Backend (Express 5) ⟷ MongoDB Atlas.</p>
      <h3>3. Data Model</h3>
      <pre class="ql-syntax">{\n  _id: "uuid-string",\n  title: "Document Title",\n  data: Object (Quill Delta),\n  timestamps: true\n}</pre>
    `,
  },
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [saveStatus, setSaveStatus] = useState('loading'); // 'loading' | 'saved' | 'saving' | 'offline'
  const [userCount, setUserCount] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  
  // Modals & Drawers
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isRecentDrawerOpen, setIsRecentDrawerOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isTypingTestOpen, setIsTypingTestOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [wordGoal, setWordGoal] = useState(500);

  // Styling options
  const [theme, setTheme] = useState(() => localStorage.getItem('qn-theme') || 'light');
  const [paperTint, setPaperTint] = useState(() => localStorage.getItem('qn-paper') || 'white');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('qn-font') || 'sans');
  const [recentDocs, setRecentDocs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('qn-recent-docs') || '[]');
    } catch {
      return [];
    }
  });

  const titleRef = useRef(docTitle);
  titleRef.current = docTitle;
  const isDirtyRef = useRef(false);
  const quillRef = useRef(null);
  quillRef.current = quill;

  // Apply Theme & Styling to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qn-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-paper', paperTint);
    localStorage.setItem('qn-paper', paperTint);
  }, [paperTint]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontFamily);
    localStorage.setItem('qn-font', fontFamily);
  }, [fontFamily]);

  // Handle Zen Mode Esc key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenMode]);

  // Track Recent Documents in localStorage
  useEffect(() => {
    if (!documentId) return;
    setRecentDocs((prev) => {
      const filtered = prev.filter((d) => d.id !== documentId);
      const updated = [{ id: documentId, title: docTitle || 'Untitled Document', time: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem('qn-recent-docs', JSON.stringify(updated));
      return updated;
    });
  }, [documentId, docTitle]);

  // Align Quill picker dropdowns perfectly below the clicked label on mobile
  useEffect(() => {
    const handlePickerClick = (e) => {
      const label = e.target.closest('.ql-picker-label');
      if (!label) return;
      const picker = label.closest('.ql-picker');
      if (!picker) return;

      const rect = label.getBoundingClientRect();
      const options = picker.querySelector('.ql-picker-options');
      if (options) {
        const top = rect.bottom + 6;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 180));
        options.style.setProperty('--picker-top', `${top}px`);
        options.style.setProperty('--picker-left', `${left}px`);
      }
    };

    document.addEventListener('click', handlePickerClick, true);
    document.addEventListener('touchstart', handlePickerClick, { passive: true, capture: true });
    return () => {
      document.removeEventListener('click', handlePickerClick, true);
      document.removeEventListener('touchstart', handlePickerClick, { capture: true });
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Toast Helper
  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // 1. Establish Socket Connection
  useEffect(() => {
    const s = io(BACKEND_URL, {
      path: '/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
      withCredentials: true,
    });

    s.on('connect', () => {
      setSaveStatus('saved');
    });

    s.on('disconnect', () => {
      setSaveStatus('offline');
    });

    s.on('connect_error', () => {
      setSaveStatus('offline');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // 2. Load Document Data & Title
  useEffect(() => {
    if (!socket || !quill) return;

    const handleLoadDoc = (doc) => {
      if (doc.data) {
        quill.setContents(doc.data);
      }
      if (doc.title) {
        setDocTitle(doc.title);
      }
      quill.enable();
      setSaveStatus('saved');
      updateStats(quill);
    };

    const handleUserCount = (count) => {
      setUserCount(count || 1);
    };

    const handleTitleRename = (newTitle) => {
      setDocTitle(newTitle);
    };

    socket.once('load-document', handleLoadDoc);
    socket.on('user-count', handleUserCount);
    socket.on('document-renamed', handleTitleRename);

    socket.emit('get-document', documentId);

    return () => {
      socket.off('user-count', handleUserCount);
      socket.off('document-renamed', handleTitleRename);
    };
  }, [socket, quill, documentId]);

  // 3. Calculate Stats
  const updateStats = (editor) => {
    if (!editor) return;
    const text = editor.getText().trim();
    const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setCharCount(text.length);
  };

  // 4. Real-time Changes (from other clients)
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta) => {
      quill.updateContents(delta);
      updateStats(quill);
    };

    socket.on('receive-changes', handler);
    return () => {
      socket.off('receive-changes', handler);
    };
  }, [socket, quill]);

  // 5. Sending Local Changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      isDirtyRef.current = true;
      setSaveStatus('saving');
      socket.emit('send-changes', delta);
      updateStats(quill);
    };

    quill.on('text-change', handler);
    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, quill]);

  // 6. Auto-Save to MongoDB
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      if (isDirtyRef.current) {
        socket.emit('save-document', {
          data: quill.getContents(),
          title: titleRef.current,
        });
        isDirtyRef.current = false;
        setSaveStatus('saved');
      }
    }, SAVE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [socket, quill]);

  // Title Update
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setDocTitle(newTitle);
    isDirtyRef.current = true;
    if (socket) {
      socket.emit('rename-document', newTitle);
    }
  };

  // Share Link
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Document link copied to clipboard!');
    } catch {
      showToast('Could not copy link');
    }
  };

  // New Note
  const handleNewNote = () => {
    navigate(`/documents/${uuidV4()}`);
  };

  // Apply Starter Template
  const handleApplyTemplate = (template) => {
    if (!quill) return;
    quill.clipboard.dangerouslyPasteHTML(template.html);
    setDocTitle(template.title);
    if (socket) {
      socket.emit('rename-document', template.title);
    }
    isDirtyRef.current = true;
    updateStats(quill);
    setIsTemplateModalOpen(false);
    showToast(`Applied ${template.title} template`);
  };

  // Clear Document
  const handleClearDoc = () => {
    if (!quill) return;
    quill.setText('');
    setDocTitle('Untitled Document');
    isDirtyRef.current = true;
    updateStats(quill);
    setIsClearModalOpen(false);
    showToast('Document cleared');
  };

  // Export handlers
  const handleExport = (format) => {
    if (!quill) return;
    setIsExportOpen(false);

    const filename = `${docTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'document'}`;

    if (format === 'txt') {
      const text = quill.getText();
      downloadFile(`${filename}.txt`, text, 'text/plain');
      showToast('Exported as Plain Text (.txt)');
    } else if (format === 'html') {
      const html = quill.root.innerHTML;
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${docTitle}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1.5rem;line-height:1.7;color:#1e293b;}</style></head><body><h1>${docTitle}</h1>${html}</body></html>`;
      downloadFile(`${filename}.html`, fullHtml, 'text/html');
      showToast('Exported as HTML (.html)');
    } else if (format === 'md') {
      const text = quill.getText();
      downloadFile(`${filename}.md`, `# ${docTitle}\n\n${text}`, 'text/markdown');
      showToast('Exported as Markdown (.md)');
    } else if (format === 'print') {
      window.print();
    }
  };

  const downloadFile = (name, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initialize Quill Editor Instance with Custom Toolbar Handlers
  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = '';
    const editor = document.createElement('div');
    wrapper.append(editor);

    const q = new Quill(editor, {
      theme: 'snow',
      placeholder: 'Start writing, brainstorming, or take notes with your team...',
      modules: {
        toolbar: {
          container: TOOLBAR_OPTIONS,
          handlers: {
            undo: function () {
              this.quill.history.undo();
            },
            redo: function () {
              this.quill.history.redo();
            },
          },
        },
        history: {
          delay: 1000,
          maxStack: 100,
          userOnly: true,
        },
      },
    });

    q.disable();
    setQuill(q);
  }, []);

  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const goalProgress = Math.min(100, Math.round((wordCount / (wordGoal || 500)) * 100));

  return (
    <div className={`app-container ${zenMode ? 'zen-mode' : ''}`}>
      {/* Typing Test Modal / View */}
      {isTypingTestOpen && (
        <TypingTest
          socket={socket}
          documentId={documentId}
          onClose={() => setIsTypingTestOpen(false)}
        />
      )}

      {/* Zen Mode Exit Button */}
      {zenMode && (
        <button className="zen-exit-btn" onClick={() => setZenMode(false)} title="Exit Focus Mode (Esc)">
          <Minimize2 size={14} />
          <span>Exit Focus Mode</span>
        </button>
      )}

      {/* Modern Top Navigation Bar */}
      <header className={`navbar ${zenMode ? 'hidden' : ''}`}>
        <div className="nav-left">
          {/* Recent Notes Drawer Trigger */}
          <button
            className="action-btn icon-only"
            onClick={() => setIsRecentDrawerOpen(true)}
            title="Recent Documents"
          >
            <History size={15} />
          </button>

          <div className="logo-badge" onClick={handleNewNote} title="QuickNotes — New Note">
            <div className="logo-icon">
              <Zap size={14} />
            </div>
            <span className="logo-text">QuickNotes</span>
          </div>

          <div className="title-container">
            <input
              type="text"
              className="document-title-input"
              value={docTitle}
              onChange={handleTitleChange}
              placeholder="Untitled Document"
              title="Click to rename document"
            />
            {/* Status Badge */}
            <div className={`status-pill ${saveStatus}`} title={`Status: ${saveStatus}`}>
              <span className="status-dot"></span>
              <span className="status-text">
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'offline' && 'Offline'}
                {saveStatus === 'loading' && 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="nav-actions">
          {/* Active Collaborators */}
          <div className="collaborators-pill" title={`${userCount} active collaborator(s)`}>
            <Users size={13} />
            <span>{userCount}</span>
          </div>

          {/* Typing Test Mode Switcher */}
          <button
            className="action-btn highlight"
            onClick={() => setIsTypingTestOpen(true)}
            title="Speed Typing Test & Race"
          >
            <Keyboard size={14} />
            <span className="nav-btn-text">Typing Race</span>
          </button>

          {/* Desktop Only: Templates Trigger */}
          <button
            className="action-btn desktop-only-btn"
            onClick={() => setIsTemplateModalOpen(true)}
            title="Choose a starter template"
          >
            <LayoutTemplate size={14} />
            <span className="nav-btn-text">Templates</span>
          </button>

          {/* Desktop Only: Style Dropdown */}
          <div className="dropdown-wrapper desktop-only-btn">
            <button
              className="action-btn icon-only"
              onClick={() => setIsStyleOpen((prev) => !prev)}
              title="Page Style & Typography"
            >
              <Palette size={14} />
            </button>

            {isStyleOpen && (
              <div className="dropdown-menu" onClick={() => setIsStyleOpen(false)}>
                <div style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  PAPER TINT
                </div>
                <button className="dropdown-item" onClick={() => setPaperTint('white')}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffffff', border: '1px solid #cbd5e1' }}></span>
                  Clean White
                </button>
                <button className="dropdown-item" onClick={() => setPaperTint('sepia')}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbf0d9', border: '1px solid #d4c5a9' }}></span>
                  Warm Sepia
                </button>
                <button className="dropdown-item" onClick={() => setPaperTint('mint')}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0' }}></span>
                  Fresh Mint
                </button>
                <button className="dropdown-item" onClick={() => setPaperTint('slate')}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1e293b' }}></span>
                  Slate Dark
                </button>

                <div className="dropdown-divider"></div>
                <div style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                  FONT FAMILY
                </div>
                <button className="dropdown-item" onClick={() => setFontFamily('sans')}>
                  <Type size={13} /> Sans-Serif
                </button>
                <button className="dropdown-item" onClick={() => setFontFamily('serif')}>
                  <span style={{ fontFamily: 'serif', fontWeight: 'bold' }}>S</span> Elegant Serif
                </button>
                <button className="dropdown-item" onClick={() => setFontFamily('mono')}>
                  <FileCode size={13} /> Monospace
                </button>
              </div>
            )}
          </div>

          {/* Desktop Only: Share Button */}
          <button className="action-btn desktop-only-btn" onClick={handleShare} title="Copy shareable link">
            <Share2 size={14} />
            <span className="nav-btn-text">Share</span>
          </button>

          {/* Desktop Only: Export Dropdown */}
          <div className="dropdown-wrapper desktop-only-btn">
            <button
              className="action-btn"
              onClick={() => setIsExportOpen((prev) => !prev)}
              title="Export document"
            >
              <Download size={14} />
              <span className="nav-btn-text">Export</span>
              <ChevronDown size={12} />
            </button>

            {isExportOpen && (
              <div className="dropdown-menu" onClick={() => setIsExportOpen(false)}>
                <button className="dropdown-item" onClick={() => handleExport('md')}>
                  <FileText size={14} /> Markdown (.md)
                </button>
                <button className="dropdown-item" onClick={() => handleExport('txt')}>
                  <FileCode size={14} /> Plain Text (.txt)
                </button>
                <button className="dropdown-item" onClick={() => handleExport('html')}>
                  <Globe size={14} /> Web HTML (.html)
                </button>
                <button className="dropdown-item" onClick={() => handleExport('print')}>
                  <Printer size={14} /> Print / Save as PDF
                </button>
              </div>
            )}
          </div>

          {/* Desktop Only: Focus / Zen Mode */}
          <button
            className="action-btn icon-only desktop-only-btn"
            onClick={() => setZenMode(true)}
            title="Enter Focus / Zen Mode"
          >
            <Maximize2 size={14} />
          </button>

          {/* Theme Toggle */}
          <button
            className="action-btn icon-only"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          {/* Clear Document Button (Direct Trash Icon) */}
          <button
            className="action-btn icon-only danger"
            onClick={() => setIsClearModalOpen(true)}
            title="Clear Document"
          >
            <Trash2 size={14} />
          </button>

          {/* New Document Button */}
          <button className="action-btn primary" onClick={handleNewNote} title="Create fresh note">
            <Plus size={14} />
            <span className="nav-btn-text">New</span>
          </button>
        </div>
      </header>

      {/* Editor Main Canvas */}
      <main className="editor-workspace">
        <div className="quill-editor-wrapper" ref={wrapperRef}></div>
      </main>

      {/* Bottom Floating Stats Bar */}
      <footer className={`bottom-bar ${zenMode ? 'hidden' : ''}`}>
        <div className="bottom-stat">
          <strong>{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
        </div>
        <div className="bottom-divider"></div>
        <div className="bottom-stat">
          <strong>{charCount}</strong> characters
        </div>
        <div className="bottom-divider"></div>
        <div className="bottom-stat">
          <Clock size={12} />
          <span>~{readingTimeMinutes} min read</span>
        </div>
        <div className="bottom-divider"></div>
        <div className="bottom-stat word-goal-bar" title={`Word Goal: ${wordCount} / ${wordGoal}`}>
          <Target size={12} />
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${goalProgress}%` }}></div>
          </div>
          <span>{goalProgress}%</span>
        </div>
      </footer>

      {/* Starter Templates Modal */}
      {isTemplateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTemplateModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Sparkles size={16} color="var(--accent-primary)" />
                <span>Starter Document Templates</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsTemplateModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Select a template to insert structured content:
              </p>
              <div className="templates-grid">
                {TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  return (
                    <div
                      key={tmpl.id}
                      className="template-card"
                      onClick={() => handleApplyTemplate(tmpl)}
                    >
                      <div className="template-header">
                        <Icon size={15} color="var(--accent-primary)" />
                        <span>{tmpl.title}</span>
                      </div>
                      <div className="template-desc">{tmpl.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Document Confirmation Modal */}
      {isClearModalOpen && (
        <div className="modal-overlay" onClick={() => setIsClearModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--status-danger)' }}>
                <Trash2 size={16} />
                <span>Clear Document?</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsClearModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to erase all text in this document?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="action-btn" onClick={() => setIsClearModalOpen(false)}>
                  Cancel
                </button>
                <button
                  className="action-btn danger"
                  style={{ background: 'var(--status-danger)', color: '#fff', border: 'none' }}
                  onClick={handleClearDoc}
                >
                  Yes, Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Notes Drawer */}
      {isRecentDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsRecentDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <History size={16} color="var(--accent-primary)" />
                <span>Recent Documents</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsRecentDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="drawer-list">
              {recentDocs.length === 0 ? (
                <p style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No recent documents found on this device.
                </p>
              ) : (
                recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`drawer-item ${doc.id === documentId ? 'active' : ''}`}
                    onClick={() => {
                      setIsRecentDrawerOpen(false);
                      if (doc.id !== documentId) {
                        navigate(`/documents/${doc.id}`);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                      <FileText size={14} />
                      <span className="drawer-item-title">{doc.title}</span>
                    </div>
                    {doc.id === documentId && <Check size={13} color="var(--accent-primary)" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <Check size={13} color="var(--status-success)" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
