/**
 * Tony - The Machine Learning Assistant (RAG chatbot)
 * Talks to /api/tony (Vercel serverless function) which retrieves from the
 * course notes and answers via Gemini. Keys stay on the server.
 */

class TonyChat {
    constructor() {
        this.isOpen = false;
        this.busy = false;
        this.history = []; // {role:'user'|'bot', text}

        const script = document.querySelector('script[src*="tony.js"]');
        this.rootPath = script ? script.src.split('tony.js')[0] : './';

        this.init();
    }

    init() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = this.rootPath + 'tony.css';
        document.head.appendChild(link);

        this.render();
        this.attachEvents();
        this.greet();
    }

    render() {
        const container = document.createElement('div');
        container.id = 'tony-widget-container';
        container.innerHTML = `
            <button id="tony-fab" aria-label="Chat with Tony">
                <svg viewBox="0 0 24 24"><path d="M12,2A10,10,0,0,0,2,12a9.89,9.89,0,0,0,2.26,6.33L3,22l3.67-1.26A10,10,0,1,0,12,2Zm5,11H7a1,1,0,0,1,0-2h10a1,1,0,0,1,0,2Zm0-4H7A1,1,0,0,1,7,7h10a1,1,0,0,1,0,2Z"/></svg>
            </button>
            <div id="tony-window">
                <div class="tony-header">
                    <div class="tony-avatar">T</div>
                    <div class="tony-info">
                        <div class="tony-name">Tony</div>
                        <div class="tony-status">ML Study Assistant</div>
                    </div>
                    <button id="tony-close" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">&times;</button>
                </div>
                <div class="tony-history" id="tony-history"></div>
                <div class="tony-input-area">
                    <div class="tony-input-wrapper">
                        <input id="tony-input" type="text" placeholder="Ask about any ML topic..." autocomplete="off" />
                        <button id="tony-send" aria-label="Send">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    attachEvents() {
        const fab = document.getElementById('tony-fab');
        const close = document.getElementById('tony-close');
        const win = document.getElementById('tony-window');
        const input = document.getElementById('tony-input');
        const send = document.getElementById('tony-send');

        fab.onclick = () => {
            this.isOpen = !this.isOpen;
            win.classList.toggle('open', this.isOpen);
            if (this.isOpen) setTimeout(() => input.focus(), 300);
        };
        close.onclick = () => { this.isOpen = false; win.classList.remove('open'); };
        send.onclick = () => this.handleSend();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
        });
    }

    greet() {
        this.addMessage('bot',
            "Hi, I'm **Tony** 👋 your Machine Learning study buddy. " +
            "Ask me to explain a concept, compare two topics, or point you to the right module. " +
            "I only answer from this course's notes.");
    }

    async handleSend() {
        const input = document.getElementById('tony-input');
        const text = input.value.trim();
        if (!text || this.busy) return;

        input.value = '';
        this.addMessage('user', text);
        this.history.push({ role: 'user', text });

        this.busy = true;
        document.getElementById('tony-send').disabled = true;
        const typing = this.showTyping();

        try {
            const res = await fetch(this.rootPath + 'api/tony', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, history: this.history.slice(-6) }),
            });
            const data = await res.json();
            typing.remove();

            if (!res.ok || data.error) {
                this.addMessage('bot', data?.error?.message || 'Sorry, something went wrong. Please try again.');
            } else {
                const answer = data.answer || "I couldn't find anything on that in the notes.";
                this.addMessage('bot', answer, data.sources);
                this.history.push({ role: 'bot', text: answer });
            }
        } catch (err) {
            typing.remove();
            this.addMessage('bot', 'I could not reach the server. Check your connection and try again.');
        } finally {
            this.busy = false;
            const send = document.getElementById('tony-send');
            if (send) send.disabled = false;
            input.focus();
        }
    }

    showTyping() {
        const history = document.getElementById('tony-history');
        const el = document.createElement('div');
        el.className = 'tony-typing';
        el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        history.appendChild(el);
        history.scrollTop = history.scrollHeight;
        return el;
    }

    addMessage(role, text, sources) {
        const history = document.getElementById('tony-history');
        const el = document.createElement('div');
        el.className = 'tony-msg ' + (role === 'user' ? 'user' : 'bot');
        el.innerHTML = this.format(text);

        if (sources && sources.length) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;';
            sources.slice(0, 4).forEach(s => {
                const a = document.createElement('a');
                a.href = this.resolveLink(s.url);
                a.textContent = '📄 ' + (s.title || s.url).replace(/ · Svyasa.*$/, '').replace(/ — .*$/, '');
                a.style.cssText = 'font-size:11px;text-decoration:none;color:var(--tony-primary);background:rgba(15,98,254,0.12);padding:4px 8px;border-radius:10px;';
                wrap.appendChild(a);
            });
            el.appendChild(wrap);
        }

        history.appendChild(el);
        history.scrollTop = history.scrollHeight;
    }

    // KB urls are relative to the site root (e.g. "module1/intro-ml.html").
    // rootPath already points at the site root (resolved from tony.js's src).
    resolveLink(url) {
        if (/^https?:\/\//.test(url)) return url;
        return this.rootPath + url;
    }

    // Minimal, safe markdown: escape HTML, then apply **bold**, `code`, and newlines.
    format(text) {
        const esc = (text || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return esc
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TonyChat());
} else {
    new TonyChat();
}
