let isLoginMode = true;
let currentUser = null;
let isVoiceModeEnabled = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = window.speechSynthesis;

if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
}

// Ensure login page loads by default
document.addEventListener('DOMContentLoaded', () => {
    showLogin();
});

function showLogin() {
    isLoginMode = true;
    document.getElementById('authButton').textContent = 'Login';
    document.getElementById('authMessage').textContent = '';
    document.getElementById('authForm').innerHTML = `
        <input type="email" id="email" placeholder="Email" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit" id="authButton">Login</button>
    `;
}

function showSignup() {
    isLoginMode = false;
    document.getElementById('authButton').textContent = 'Create Account';
    document.getElementById('authMessage').textContent = '';
    document.getElementById('authForm').innerHTML = `
        <input type="email" id="email" placeholder="Email" required>
        <input type="text" id="username" placeholder="Username" required>
        <input type="tel" id="phone" placeholder="Phone Number" pattern="[0-9]{10}" required>
        <input type="text" id="region" placeholder="Region (e.g., Punjab, Tamil Nadu)" required>
        <input type="password" id="password" placeholder="Password" required>
        <button type="submit" id="authButton">Create Account</button>
    `;
}

document.getElementById('authForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const username = document.getElementById('username') ? document.getElementById('username').value : null;
    const phone = document.getElementById('phone') ? document.getElementById('phone').value : null;
    const region = document.getElementById('region') ? document.getElementById('region').value : null;
    const password = document.getElementById('password').value;

    const users = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (isLoginMode) {
        const user = Object.values(users).find(u => u.email === email && u.password === password);
        if (user) {
            currentUser = user;
            showChatInterface();
            document.getElementById('authMessage').textContent = 'Logged in successfully!';
        } else {
            document.getElementById('authMessage').textContent = 'Invalid email or password!';
        }
    } else {
        if (users[username]) {
            document.getElementById('authMessage').textContent = 'Username already exists!';
        } else {
            users[username] = { email, phone, region, password, username };
            localStorage.setItem('users', JSON.stringify(users));
            document.getElementById('authMessage').textContent = 'Account created successfully! Please log in.';
            showLogin();
        }
    }
});

function showChatInterface() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('chatBox').style.display = 'block';
    document.getElementById('inputArea').style.display = 'flex';
    
    // Update the header section with a personalized greeting
    document.getElementById('headerSection').innerHTML = `
        <h1>Hello ${currentUser.username}, I am AgriBot!</h1>
        <p>How can I assist you today with your farming needs?</p>
    `;
    
    // Updated: Added Suggest Crops button with soil dropdown and Show History button
    document.getElementById('inputArea').innerHTML = `
        <select id="languageSelect">
            <option value="en" selected>English</option>
            <option value="hi">Hindi</option>
            <option value="ta">Tamil</option>
            <option value="od">Odia</option>
            <option value="pa">Punjabi</option>
            <option value="te">Telugu</option>
            <option value="ml">Malayalam</option>
        </select>
        <input type="text" id="userInput" placeholder="Type your query here...">
        <input type="button" id="sendButton" value="Send" onclick="sendMessage()">
        <input type="button" id="voiceModeButton" value="Voice Off" onclick="toggleVoiceMode()">
        <input type="button" id="voiceInputButton" value="🎤" onclick="startVoiceInput()" style="display: ${isVoiceModeEnabled ? 'inline-block' : 'none'};">
        <select id="soilSelect">
            <option value="Alluvial">Alluvial</option>
            <option value="Black">Black</option>
            <option value="Red">Red</option>
            <option value="Laterite">Laterite</option>
            <option value="Sandy">Sandy</option>
        </select>
        <input type="button" id="cropSuggestButton" value="SUGGEST CROPS" onclick="suggestCrops()">
        <input type="button" id="clearChatButton" value="Clear Chat" onclick="clearChat()">
        <input type="button" id="historyButton" value="Show History" onclick="showHistory()">
        <input type="button" id="logoutButton" value="Logout" onclick="logout()">
    `;
}

function toggleVoiceMode() {
    isVoiceModeEnabled = !isVoiceModeEnabled;
    const voiceModeButton = document.getElementById('voiceModeButton');
    const voiceInputButton = document.getElementById('voiceInputButton');
    if (isVoiceModeEnabled) {
        voiceModeButton.value = 'Voice On';
        voiceInputButton.style.display = 'inline-block';
    } else {
        voiceModeButton.value = 'Voice Off';
        voiceInputButton.style.display = 'none';
        if (synth && synth.speaking) {
            synth.cancel();
        }
    }
}

async function sendMessage() {
    const userInput = document.getElementById('userInput').value;
    const language = document.getElementById('languageSelect').value;
    if (!userInput) return;

    addMessage(userInput, 'user-message');
    document.getElementById('userInput').value = '';

    // Add to history
    addToHistory(userInput);

    const botResponse = await getBotResponseWithRetry(userInput, currentUser.region, language);
    addBotMessageWithSpeech(botResponse, language);
    if (isVoiceModeEnabled) {
        speakResponse(botResponse, language);
    }
}

// Updated: Suggest crops with soil type using default region from account
async function suggestCrops() {
    const language = document.getElementById('languageSelect').value;
    const soilType = document.getElementById('soilSelect').value;
    const query = JSON.stringify({ query: "Which crops should I grow?", soil: soilType });
    addMessage(`Requesting crops for ${soilType} soil...`, 'user-message');
    
    // Add to history
    addToHistory(`Requesting crops for ${soilType} soil...`);
    
    const botResponse = await getBotResponseWithRetry(query, currentUser.region, language);
    addBotMessageWithSpeech(botResponse, language);
    if (isVoiceModeEnabled) {
        speakResponse(botResponse, language);
    }
}

function addMessage(text, className) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.innerHTML = text.replace(/\n/g, '<br>');
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addBotMessageWithSpeech(text, language) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
        ${text.replace(/\n/g, '<br>')}
        <button class="speak-avatar-btn">Speak with Avatar</button>
    `;
    const button = messageDiv.querySelector('.speak-avatar-btn');
    button.addEventListener('click', () => {
        showAvatarSpeech(encodeURIComponent(text), language);
    });
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function getBotResponseWithRetry(userInput, region, language, retries = 3, delay = 19000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: userInput, region: region, language: language }),
            });
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || delay / 1000;
                addMessage(`Quota exceeded. Retrying in ${retryAfter} seconds...`, 'bot-message');
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.response || data.error || 'No response from server';
        } catch (error) {
            if (i === retries - 1) {
                return `Error: ${error.message}. Please try again later or check your API quota`;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function startVoiceInput() {
    if (!isVoiceModeEnabled || !recognition) return;
    const language = document.getElementById('languageSelect').value;
    recognition.lang = language === "en" ? "en-IN" : language + "-IN";
    recognition.start();

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        document.getElementById('userInput').value = transcript;
        sendMessage();
    };

    recognition.onerror = function(event) {
        addMessage("Sorry, I couldn’t understand your voice input.", 'bot-message');
    };
}

function speakResponse(text, language) {
    if (!synth || !isVoiceModeEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "en" ? "en-IN" : language + "-IN";
    utterance.rate = 1.0;
    const voices = synth.getVoices();
    const voice = voices.find(v => v.lang === utterance.lang) || voices.find(v => v.lang.startsWith(language));
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
}

function showAvatarSpeech(encodedText, language) {
    const text = decodeURIComponent(encodedText);
    const modal = document.getElementById('avatarModal');
    const avatarText = document.getElementById('avatarText');
    avatarText.textContent = text;
    modal.style.display = 'block';
    if (isVoiceModeEnabled) speakResponse(text, language);
}

function closeAvatarModal() {
    document.getElementById('avatarModal').style.display = 'none';
    synth.cancel();
}

function clearChat() {
    document.getElementById('chatBox').innerHTML = '';
}

function logout() {
    currentUser = null;
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('chatBox').style.display = 'none';
    document.getElementById('inputArea').style.display = 'none';
    document.getElementById('greetingHeader').style.display = 'none';
    document.getElementById('headerSection').innerHTML = `
        <h1>AgriBot - Your Farming Assistant</h1>
        <p>Ask about crop selection, pest management, soil health, or farming techniques!</p>
    `;
    showLogin();
}

// New: Function to add a query to the user's history
function addToHistory(query) {
    if (!currentUser) return;
    const historyKey = `chatHistory_${currentUser.username}`;
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    history.push({
        query: query,
        timestamp: new Date().toLocaleString()
    });
    localStorage.setItem(historyKey, JSON.stringify(history));
}

// New: Function to display the user's chat history
function showHistory() {
    if (!currentUser) return;
    const historyKey = `chatHistory_${currentUser.username}`;
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    if (history.length === 0) {
        addMessage("No chat history available.", 'bot-message');
        return;
    }

    let historyText = "Your Chat History:\n";
    history.forEach((entry, index) => {
        historyText += `${index + 1}. [${entry.timestamp}] ${entry.query}\n`;
    });
    addMessage(historyText, 'bot-message');
}