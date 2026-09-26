import {useState, useRef, useEffect, KeyboardEvent} from 'react';
import {Icon} from './UI';
import './AIChat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const starters = [
  'Find hidden beaches in India',
  'Plan a 3-day nature trip',
  'Suggest peaceful places near Delhi',
  'Underrated destinations in Northeast India',
  'What can I explore in Rajasthan?',
];

const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setError('');
    const userMsg: Message = {role: 'user', content: msg};
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const response = await fetch(base + '/ai/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: msg, history: messages.slice(-10)}),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || 'Unable to contact Wanderers AI');
      }
      const data = await response.json();
      setMessages(prev => [...prev, {role: 'assistant', content: data.reply}]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clear() {
    setMessages([]);
    setError('');
    setInput('');
  }

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Open Wanderers AI assistant" title="Ask Wanderers AI">
          <Icon name="auto_awesome" />
        </button>
      )}
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Wanderers AI assistant">
          <div className="ai-header">
            <div className="ai-header-info">
              <Icon name="auto_awesome" />
              <div>
                <b>Wanderers AI</b>
                <small>Your travel companion</small>
              </div>
            </div>
            <div className="ai-header-actions">
              {messages.length > 0 && (
                <button onClick={clear} aria-label="Clear chat" title="Clear chat">
                  <Icon name="delete_sweep" />
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close chat" title="Close">
                <Icon name="close" />
              </button>
            </div>
          </div>

          <div className="ai-messages" ref={listRef}>
            {messages.length === 0 && !loading && (
              <div className="ai-welcome">
                <Icon name="explore" />
                <p><b>Hello, fellow wanderer!</b></p>
                <p>I can help you discover hidden places, plan trips, and explore India's lesser-known stories.</p>
                <div className="ai-starters">
                  {starters.map(s => (
                    <button key={s} onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg-${m.role}`}>
                {m.role === 'assistant' && <span className="ai-avatar"><Icon name="auto_awesome" /></span>}
                <div className="ai-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-assistant">
                <span className="ai-avatar"><Icon name="auto_awesome" /></span>
                <div className="ai-bubble ai-thinking">Wanderers AI is exploring<span className="ai-dots"><span>.</span><span>.</span><span>.</span></span></div>
              </div>
            )}
            {error && (
              <div className="ai-error">
                <Icon name="error_outline" />
                <span>{error}</span>
                <button className="text-button" onClick={() => {setError(''); send(messages[messages.length - 1]?.content);}}>Retry</button>
              </div>
            )}
          </div>

          <div className="ai-composer">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about a destination, trip idea…"
              rows={1}
              maxLength={3000}
              aria-label="Type a message"
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} aria-label="Send message" title="Send">
              <Icon name="send" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
