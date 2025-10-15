// --- UI Element Initialization ---
const elements = {
    generateBtn: document.getElementById('generate-btn'),
    btnText: document.getElementById('btn-text'),
    loader: document.getElementById('loader'),
    dorkDescription: document.getElementById('dork-description'),
    resultContainer: document.getElementById('result-container'),
    generatedDork: document.getElementById('generated-dork'),
    copyBtn: document.getElementById('copy-btn'),
    searchBtn: document.getElementById('search-btn'),
    refineBtn: document.getElementById('refine-btn'),
    errorBox: document.getElementById('error-box'),
    errorMessage: document.getElementById('error-message'),
    copyIcon: document.getElementById('copy-icon'),
    checkIcon: document.getElementById('check-icon'),
    panelOverlay: document.getElementById('panel-overlay'),
    // Settings
    settingsToggleBtn: document.getElementById('settings-toggle-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    saveKeyFeedback: document.getElementById('save-key-feedback'),
    // History
    historyBtn: document.getElementById('history-btn'),
    historyPanel: document.getElementById('history-panel'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
};

let currentDork = '';

// --- Event Listeners ---
window.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) elements.apiKeyInput.value = savedKey;
    loadHistory();
});

elements.generateBtn.addEventListener('click', () => handleGenerateClick(false));
elements.refineBtn.addEventListener('click', () => handleGenerateClick(true));
elements.copyBtn.addEventListener('click', copyToClipboard);

// Panel Toggles
elements.settingsToggleBtn.addEventListener('click', () => openPanel(elements.settingsPanel));
elements.historyBtn.addEventListener('click', () => openPanel(elements.historyPanel));
elements.closeSettingsBtn.addEventListener('click', closePanels);
elements.closeHistoryBtn.addEventListener('click', closePanels);
elements.panelOverlay.addEventListener('click', closePanels);

elements.saveKeyBtn.addEventListener('click', () => {
    localStorage.setItem('geminiApiKey', elements.apiKeyInput.value.trim());
    elements.saveKeyFeedback.textContent = 'API Key Saved!';
    setTimeout(() => { elements.saveKeyFeedback.textContent = ''; closePanels(); }, 2000);
});

elements.clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('dorkHistory');
    loadHistory(); // Reloads to show empty state
});

// --- Panel Management ---
function openPanel(panel) {
    closePanels(); // Ensure only one is open
    panel.classList.add('open');
    elements.panelOverlay.classList.add('open');
}

function closePanels() {
    document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
    elements.panelOverlay.classList.remove('open');
}

// --- Core Functions ---
async function handleGenerateClick(isRefinement) {
    const description = elements.dorkDescription.value.trim();
    if (!description) {
        showError("Please enter a description for the dork.");
        return;
    }
    if (!elements.apiKeyInput.value.trim()) {
        showError("Please add your Gemini API key in settings.");
        openPanel(elements.settingsPanel);
        return;
    }

    setLoadingState(true);
    hideError();

    try {
        const prompt = isRefinement
            ? `Refine the following Google Dork: "${currentDork}". The original goal was: "${description}". Make it more specific, creative, or efficient.`
            : description;
        const dork = await fetchDork(prompt);

        if (dork === 'INVALID_DORK' || !isValidDorkStructure(dork)) {
            showError("Could not generate a valid dork. Try a more specific description.");
        } else {
            displayResult(dork);
            saveToHistory(dork);
        }
    } catch (error) {
        console.error('Error generating dork:', error);
        showError("An error occurred. Check your API key or try again.");
    } finally {
        setLoadingState(false);
    }
}

async function fetchDork(prompt, retries = 3, delay = 1000) {
    const systemPrompt = `You are a cybersecurity OSINT expert with access to real-time Google Search data. Your mission is to generate a single, precise, and powerful Google Dork based on a user's request. RULES: 1. OUTPUT ONLY THE DORK. No explanations, no markdown, no backticks, no extra text. 2. Combine operators creatively (inurl:, intitle:, filetype:, site:, intext:). 3. Use advanced syntax like parentheses, wildcards (*), and exclusion (-). 4. If the request is malicious, nonsensical, or invalid, output the exact string 'INVALID_DORK'.`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };
    const userApiKey = elements.apiKeyInput.value.trim();
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            if ((response.status === 429 || response.status >= 500) && retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return fetchDork(prompt, retries - 1, delay * 2);
            }
            throw new Error(`API Error: ${response.status}`);
        }
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Invalid API response structure.');
        // Clean the response to remove unwanted characters like backticks
        const cleanedText = text.trim().replace(/`/g, '');
        return cleanedText;
    } catch (error) {
        if (retries > 0) {
            await new Promise(res => setTimeout(res, delay));
            return fetchDork(prompt, retries - 1, delay * 2);
        }
        throw error;
    }
}

function isValidDorkStructure(dork) {
    return dork && dork.length > 3 && !dork.includes('\n');
}

function copyToClipboard() {
    const dorkText = elements.generatedDork.innerText;
    const textArea = document.createElement('textarea');
    textArea.value = dorkText;

    // Prevent scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            elements.copyIcon.classList.add('hidden');
            elements.checkIcon.classList.remove('hidden');
            setTimeout(() => {
                elements.copyIcon.classList.remove('hidden');
                elements.checkIcon.classList.add('hidden');
            }, 2000);
        }
    } catch (err) {
        console.error('Copy command failed', err);
    }

    document.body.removeChild(textArea);
}

// --- History Management ---
function getHistory() {
    return JSON.parse(localStorage.getItem('dorkHistory')) || [];
}

function saveToHistory(dork) {
    let history = getHistory();
    if (!history.includes(dork)) {
        history.unshift(dork);
        if (history.length > 50) history.pop();
        localStorage.setItem('dorkHistory', JSON.stringify(history));
        loadHistory();
    }
}

function loadHistory() {
    const history = getHistory();
    elements.historyList.innerHTML = '';
    if (history.length === 0) {
        elements.historyList.innerHTML = `<p class="text-center text-gray-500">No history yet.</p>`;
        return;
    }
    history.forEach(dork => {
        const item = document.createElement('div');
        item.className = "bg-[--bg-input] p-3 rounded-md text-sm cursor-pointer hover:bg-[#2a2a2a] border border-[--border-color]";
        item.textContent = dork;
        item.onclick = () => {
            elements.dorkDescription.value = `Find dorks related to: ${dork}`;
            displayResult(dork);
            closePanels();
        };
        elements.historyList.appendChild(item);
    });
}

// --- UI Helper Functions ---
function setLoadingState(isLoading) {
    elements.generateBtn.disabled = isLoading;
    elements.refineBtn.disabled = isLoading;
    elements.btnText.classList.toggle('hidden', isLoading);
    elements.loader.classList.toggle('hidden', !isLoading);
}

function displayResult(dork) {
    currentDork = dork;
    elements.generatedDork.textContent = dork;
    elements.searchBtn.href = `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
    elements.resultContainer.classList.remove('hidden');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorBox.classList.remove('hidden');
}

function hideError() {
    elements.errorBox.classList.add('hidden');
}

// --- Animated Background ---
const canvas = document.getElementById('stars-bg');
const ctx = canvas.getContext('2d');
let stars = [], shootingStars = [], animationFrameId;

const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars();
};

const initStars = () => {
    stars = [];
    const numStars = (canvas.width * canvas.height) / 9000;
    for (let i = 0; i < numStars; i++) {
        stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.2 + 0.5, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1, opacity: Math.random() * 0.7 + 0.2 });
    }
};

const createShootingStar = () => {
    const side = Math.floor(Math.random() * 4), isVertical = side < 2;
    shootingStars.push({
        x: isVertical ? Math.random() * canvas.width : (side === 2 ? 0 : canvas.width),
        y: !isVertical ? Math.random() * canvas.height : (side === 0 ? 0 : canvas.height),
        vx: isVertical ? (Math.random() - 0.5) * 4 : (side === 2 ? Math.random() * 4 + 2 : -(Math.random() * 4 + 2)),
        vy: !isVertical ? (Math.random() - 0.5) * 4 : (side === 0 ? Math.random() * 4 + 2 : -(Math.random() * 4 + 2)),
        len: Math.random() * 80 + 50,
        opacity: 1.0
    });
};

const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
        if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`; ctx.fill();
    });

    if (Math.random() < 0.03) createShootingStar();
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx; ss.y += ss.vy; ss.opacity -= 0.02;
        if (ss.opacity <= 0) { shootingStars.splice(i, 1); continue; }
        const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * ss.len, ss.y - ss.vy * ss.len);
        grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.beginPath(); ctx.moveTo(ss.x, ss.y); ctx.lineTo(ss.x - ss.vx * ss.len, ss.y - ss.vy * ss.len);
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.stroke();
    }
    animationFrameId = requestAnimationFrame(animate);
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animate();