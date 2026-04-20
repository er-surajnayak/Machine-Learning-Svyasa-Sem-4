/**
 * Tony - The Machine Learning Assistant
 * LLM-powered chatbot for Svyasa ML Course
 */

class TonyChat {
    constructor() {
        this.apiKeys = window.TONY_API_KEYS || [];
        this.currentKeyIndex = 0;
        this.isOpen = false;
        this.isProcessing = false;
        this.retryCount = 0;

        // Find the root path (tony.js location)
        const script = document.querySelector('script[src*="tony.js"]');
        this.rootPath = script ? script.src.split('tony.js')[0] : './';

        this.init();
    }

    init() {
        // Dynamically load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = this.rootPath + 'tony.css';
        document.head.appendChild(link);

        this.render();
        this.attachEvents();
        this.addBotMessage("Hi! I'm **Tony**, your ML learning assistant. Ask me anything about Machine Learning!");
    }

    getNextApiKey() {
        if (!this.apiKeys.length) return null;
        const key = this.apiKeys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        return key;
    }

    render() {
        const container = document.createElement('div');
        container.id = 'tony-widget-container';
        container.innerHTML = `
            <button id="tony-fab" aria-label="Chat with Tony">
                <svg viewBox="0 0 24 24"><path d="M12,2A10,10,0,0,0,2,12a9.89,9.89,0,0,0,2.26,6.33L3,22l3.67-1.26A10,10,0,1,0,12,2Zm5,11H7a1,1,0,0,1,0-2h10a1,1,0,0,1,0,2Zm0-4H7A1,1,0,0,1,0,0,7,9a1,1,0,0,1,0-2h10a1,1,0,0,1,0,2Z"/></svg>
            </button>
            <div id="tony-window">
                <div class="tony-header">
                    <div class="tony-avatar">T</div>
                    <div class="tony-info">
                        <div class="tony-name">Tony <span style="font-size:10px; opacity:0.6">ML Assistant</span></div>
                        <div class="tony-status">Online</div>
                    </div>
                    <button id="tony-clear" title="Clear Chat" style="background:none; border:none; color:var(--tony-text-sec); cursor:pointer; font-size:14px; margin-right:8px;">↺</button>
                    <button id="tony-close" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">×</button>
                </div>
                <div class="tony-history" id="tony-history"></div>
                <div class="tony-input-area">
                    <div class="tony-input-wrapper">
                        <input type="text" id="tony-input" placeholder="Ask anything about ML..." autocomplete="off">
                        <button id="tony-send" title="Send">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
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
        const input = document.getElementById('tony-input');
        const send = document.getElementById('tony-send');
        const win = document.getElementById('tony-window');

        fab.onclick = () => {
            this.isOpen = !this.isOpen;
            win.classList.toggle('open', this.isOpen);
            if (this.isOpen) input.focus();
        };

        close.onclick = () => {
            this.isOpen = false;
            win.classList.remove('open');
        };

        document.getElementById('tony-clear').onclick = () => {
            document.getElementById('tony-history').innerHTML = '';
            this.addBotMessage("Chat cleared! What ML topic can I help you with?");
        };

        const handleSend = () => {
            const val = input.value.trim();
            if (val && !this.isProcessing) {
                this.handleUserMsg(val);
                input.value = '';
            }
        };

        send.onclick = handleSend;
        input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };
    }

    async handleUserMsg(text) {
        this.addUserMessage(text);
        this.isProcessing = true;
        this.showTyping(true);

        const answer = await this.askGemini(text);

        this.showTyping(false);
        this.addBotMessage(answer);
        this.isProcessing = false;
    }

    async askGemini(query) {
        const SYSTEM_PROMPT = `You are "Tony", a specialized AI assistant for a Machine Learning university course.

YOUR RULES:
1. ONLY answer questions related to Machine Learning, Data Science, or AI topics.
2. If a user asks something UNRELATED to ML/AI (e.g., jokes, cooking, sports, politics), politely decline with: "I'm Tony, your Machine Learning assistant. I can only help with ML and AI-related questions!"
3. Give clear, student-friendly explanations with examples where possible.
4. Use bullet points and structure for complex topics.
5. Be encouraging and educational in tone.`;

        // 1. Try Vercel Serverless Proxy first (keys are hidden on server)
        try {
            const response = await fetch('/api/tony', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, systemPrompt: SYSTEM_PROMPT })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                return data.candidates[0].content.parts[0].text;
            }
        } catch (e) {
            console.warn("Tony: Vercel proxy unavailable. Falling back to direct call.");
        }

        // 2. Fallback: Direct call using keys from tony_keys.js (for local dev)
        const apiKey = this.getNextApiKey();
        if (!apiKey || apiKey.startsWith('YOUR_')) {
            return "Please add your **Gemini API keys** to `tony_keys.js` for local development, or deploy to Vercel with environment variables set.";
        }

        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${query}\nTony:` }] }]
                })
            });

            const data = await response.json();

            if (data.error) {
                // Auto-rotate to next key on any error
                if (this.retryCount < this.apiKeys.length) {
                    this.retryCount++;
                    return this.askGemini(query);
                }
                this.retryCount = 0;
                const msg = (data.error.message || "").toLowerCase();
                if (msg.includes("quota") || msg.includes("limit")) {
                    return "⏳ All API keys have hit their quota. Please wait a minute and try again!";
                }
                return `Something went wrong: ${data.error.message}`;
            }

            this.retryCount = 0;
            return data.candidates[0].content.parts[0].text;

        } catch (e) {
            return "Connection error. Please check your internet connection.";
        }
    }

    addUserMessage(text) {
        this.appendMessage('user', text);
    }

    addBotMessage(text) {
        let html = text
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        this.appendMessage('bot', html);
    }

    appendMessage(type, content) {
        const hist = document.getElementById('tony-history');
        const div = document.createElement('div');
        div.className = `tony-msg ${type}`;
        div.innerHTML = content;
        hist.appendChild(div);
        hist.scrollTop = hist.scrollHeight;
    }

    showTyping(show) {
        const hist = document.getElementById('tony-history');
        if (show) {
            const div = document.createElement('div');
            div.id = 'tony-typing';
            div.className = 'tony-typing';
            div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
            hist.appendChild(div);
            hist.scrollTop = hist.scrollHeight;
        } else {
            const el = document.getElementById('tony-typing');
            if (el) el.remove();
        }
    }
}

// Initialize Tony when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TonyChat());
} else {
    new TonyChat();
}
