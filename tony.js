/**
 * Tony - The Machine Learning Assistant
 * RAG-based chatbot for Svyasa ML Course
 */

class TonyChat {
    constructor() {
        this.apiKeys = window.TONY_API_KEYS || [];
        this.currentKeyIndex = 0;
        this.knowledgeBase = [];
        this.history = [];
        this.isOpen = false;
        this.isProcessing = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        // Find the root path (tony.js location)
        const script = document.querySelector('script[src*="tony.js"]');
        this.rootPath = script ? script.src.split('tony.js')[0] : './';

        this.init();
    }

    async init() {
        // Dynamically load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = this.rootPath + 'tony.css';
        document.head.appendChild(link);

        // Load knowledge base
        try {
            const response = await fetch(this.rootPath + 'knowledge_base.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.knowledgeBase = await response.json();
            console.log(`Tony: Knowledge base loaded with ${this.knowledgeBase.length} entries.`);
        } catch (e) {
            console.error('Tony: Failed to load knowledge base.', e);
            if (window.location.protocol === 'file:') {
                this.addBotMessage("⚠️ **Note:** It looks like you're opening the HTML file directly. Knowledge base features might be limited due to browser security (CORS). For best results, use a local server (e.g., VS Code Live Server).");
            }
        }

        this.render();
        this.attachEvents();
        this.addBotMessage("Hi! I'm **Tony**, your ML learning assistant. Ask me anything about the modules in this course!");
    }

    getNextApiKey() {
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
                        <div class="tony-name">Tony <span style="font-size:10px; opacity:0.6">v1.0</span></div>
                        <div class="tony-status">Online</div>
                    </div>
                    <button id="tony-clear" title="Clear Chat" style="background:none; border:none; color:var(--tony-text-sec); cursor:pointer; font-size:14px; margin-right:8px;">↺</button>
                    <button id="tony-close" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">×</button>
                </div>
                <div class="tony-history" id="tony-history"></div>
                <div class="tony-input-area">
                    <div class="tony-input-wrapper">
                        <input type="text" id="tony-input" placeholder="Type your question..." autocomplete="off">
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
        const window = document.getElementById('tony-window');

        fab.onclick = () => {
            this.isOpen = !this.isOpen;
            window.classList.toggle('open', this.isOpen);
            if (this.isOpen) input.focus();
        };

        close.onclick = () => {
            this.isOpen = false;
            window.classList.remove('open');
        };

        const clearBtn = document.getElementById('tony-clear');
        clearBtn.onclick = () => {
            const hist = document.getElementById('tony-history');
            hist.innerHTML = '';
            this.history = [];
            this.addBotMessage("Chat cleared. How else can I help you?");
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

        const context = this.getRelevantContext(text);
        const answer = await this.askGemini(text, context);
        
        this.showTyping(false);
        this.addBotMessage(answer);
        this.isProcessing = false;
    }

    getRelevantContext(query) {
        if (!this.knowledgeBase.length) return "";

        const stopWords = new Set(['what', 'is', 'are', 'how', 'does', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'explain', 'tell', 'me']);
        const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !stopWords.has(w));
        
        if (words.length === 0) return "";

        const scores = this.knowledgeBase.map(item => {
            let score = 0;
            const itemText = (item.text || "").toLowerCase();
            const itemSection = (item.section || "").toLowerCase();
            const itemTitle = (item.page_title || "").toLowerCase();

            words.forEach(word => {
                // Exact word match in text
                const regex = new RegExp(`\\b${word}\\b`, 'g');
                const textMatches = (itemText.match(regex) || []).length;
                score += textMatches;

                // High weight for matches in titles or section headers
                if (itemTitle.includes(word)) score += 5;
                if (itemSection.includes(word)) score += 3;
            });
            return { ...item, score };
        });

        // Get top 8 most relevant snippets, sorted by score
        const topItems = scores
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        if (topItems.length === 0) return "No specific context found in the course materials.";

        // Deduplicate and format
        const seen = new Set();
        return topItems
            .map(item => {
                const key = `${item.url}-${item.section}`;
                const prefix = seen.has(key) ? "" : `\n[Context from ${item.page_title} > ${item.section}]:\n`;
                seen.add(key);
                return `${prefix}${item.text}`;
            })
            .join("\n");
    }

    async askGemini(query, context) {
        const apiKey = this.getNextApiKey();
        if (!apiKey || apiKey.startsWith('YOUR_')) {
            return "Please configure your **Gemini API keys** in `tony_keys.js` to enable the chatbot.";
        }

        // Using v1 stable endpoint
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const prompt = `
            SYSTEM INSTRUCTIONS:
            You are "Tony", a specialized AI assistant for this specific Machine Learning course.
            
            STRICT RULES:
            1. ONLY answer questions related to Machine Learning and the course content provided in the context.
            2. If a user asks something unrelated to Machine Learning (e.g., "tell me a joke", "who is the president", "how to cook"), politely respond: "I am Tony, a specialized ML assistant. I can only help you with topics related to this Machine Learning course."
            3. Use the provided CONTEXT to give accurate, course-specific answers. 
            4. If the user's question is about ML but not in the context, you may use your internal knowledge but KEEP IT RELEVANT to a student's learning.
            5. Keep responses professional, educational, and concise.
            
            CONTEXT FROM COURSE:
            ${context || "No specific context found."}
            
            USER QUESTION:
            ${query}
            
            TONY'S RESPONSE:
        `;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            if (data.error) {
                console.error("Gemini Error:", data.error);
                
                // Rotation logic: Try the next key for ANY error 
                // (Rate limiting, server overload, high demand, etc.)
                if (this.retryCount < this.apiKeys.length) {
                    this.retryCount++;
                    console.log(`Tony: Retrying with key ${this.currentKeyIndex + 1}/${this.apiKeys.length}...`);
                    return this.askGemini(query, context);
                }
                
                this.retryCount = 0; 
                return `**Tony's Error:** All API keys are currently exhausted or experiencing issues. \n\n (Last Error: ${data.error.message})`;
            }

            this.retryCount = 0;
            return data.candidates[0].content.parts[0].text;
        } catch (e) {
            console.error("Fetch Error:", e);
            return "Connection error. Please check your internet.";
        }
    }

    addUserMessage(text) {
        this.appendMessage('user', text);
    }

    addBotMessage(text) {
        // Advanced Markdown-to-HTML
        let html = text
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>') // Code blocks
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
            const div = document.getElementById('tony-typing');
            if (div) div.remove();
        }
    }
}

// Initialize Tony when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TonyChat());
} else {
    new TonyChat();
}
