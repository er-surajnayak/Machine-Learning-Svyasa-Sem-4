/**
 * Tony - The Machine Learning Assistant
 * Placeholder Version: Under Development
 */

class TonyChat {
    constructor() {
        this.isOpen = false;
        
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
    }

    render() {
        const container = document.createElement('div');
        container.id = 'tony-widget-container';
        container.innerHTML = `
            <button id="tony-fab" aria-label="About Tony">
                <svg viewBox="0 0 24 24"><path d="M12,2A10,10,0,0,0,2,12a9.89,9.89,0,0,0,2.26,6.33L3,22l3.67-1.26A10,10,0,1,0,12,2Zm5,11H7a1,1,0,0,1,0-2h10a1,1,0,0,1,0,2Zm0-4H7A1,1,0,0,1,0,0,7,9a1,1,0,0,1,0-2h10a1,1,0,0,1,0,2Z"/></svg>
            </button>
            <div id="tony-window">
                <div class="tony-header">
                    <div class="tony-avatar">T</div>
                    <div class="tony-info">
                        <div class="tony-name">Tony <span style="font-size:10px; opacity:0.6">Concept</span></div>
                        <div class="tony-status">Under Development</div>
                    </div>
                    <button id="tony-close" style="background:none; border:none; color:white; cursor:pointer; font-size:20px;">×</button>
                </div>
                <div class="tony-history" id="tony-history" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px; height: 100%;">
                    <div class="tony-avatar" style="width: 60px; height: 60px; font-size: 30px; margin-bottom: 20px;">T</div>
                    <h3 style="margin-bottom: 10px; color: var(--tony-text-pri);">Meet Tony</h3>
                    <p style="color: var(--tony-text-sec); font-size: 14px; margin-bottom: 20px;">
                        Tony is your upcoming AI-powered Machine Learning assistant. 
                        Designed to help students navigate across Modules and understand the concepts with ease.
                    </p>
                    <div style="background: rgba(var(--tony-accent-rgb), 0.1); border: 1px solid var(--tony-accent); color: var(--tony-accent); padding: 10px 20px; border-radius: 20px; font-weight: 500; font-size: 13px;">
                        🚀 Coming Soon
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    attachEvents() {
        const fab = document.getElementById('tony-fab');
        const close = document.getElementById('tony-close');
        const window = document.getElementById('tony-window');

        fab.onclick = () => {
            this.isOpen = !this.isOpen;
            window.classList.toggle('open', this.isOpen);
        };

        close.onclick = () => {
            this.isOpen = false;
            window.classList.remove('open');
        };
    }
}

// Initialize Tony when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new TonyChat());
} else {
    new TonyChat();
}
