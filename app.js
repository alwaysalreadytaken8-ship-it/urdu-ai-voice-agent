const form = document.getElementById("chatForm");
const input = document.getElementById("message");
const chat = document.getElementById("chat");
const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const autoSpeak = document.getElementById("autoSpeak");

let history = [];
let recognition = null;
let listening = false;

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  const label = document.createElement("b");
  label.textContent = role === "user" ? "Aap" : "Agent";
  const p = document.createElement("p");
  p.textContent = text;
  bubble.append(label, p);
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    statusEl.textContent = "Is browser mein text-to-speech support nahi hai.";
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const urduVoice = voices.find(v => /^ur(-|_)/i.test(v.lang)) ||
                    voices.find(v => /urdu/i.test(v.name));
  if (urduVoice) utterance.voice = urduVoice;
  utterance.lang = urduVoice?.lang || "ur-PK";
  utterance.rate = 0.95;
  utterance.onstart = () => statusEl.textContent = "Agent jawab suna raha hai...";
  utterance.onend = () => statusEl.textContent = "Ready — agla sawal poochhein.";
  utterance.onerror = () => statusEl.textContent = "Browser ki awaaz nahi chal saki; text jawab maujood hai.";
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(text) {
  text = text.trim();
  if (!text) return;
  addBubble("user", text);
  input.value = "";
  sendBtn.disabled = true;
  micBtn.disabled = true;
  statusEl.textContent = "AI soch raha hai...";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({message: text, history})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request fail ho gayi.");
    const reply = data.reply || "Maaf kijiye, jawab nahi mila.";
    addBubble("assistant", reply);
    history.push({role:"user", content:text}, {role:"assistant", content:reply});
    history = history.slice(-12);
    statusEl.textContent = "Jawab tayyar hai.";
    if (autoSpeak.checked) speak(reply);
  } catch (error) {
    addBubble("assistant", "Maaf kijiye, masla aa gaya: " + error.message);
    statusEl.textContent = "Connection ya server setting check karein.";
  } finally {
    sendBtn.disabled = false;
    micBtn.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  sendMessage(input.value);
});

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    statusEl.textContent = "Is browser mein speech recognition nahi hai. Chrome ya Edge ka latest version try karein.";
    return null;
  }
  const r = new SpeechRecognition();
  r.lang = "ur-PK";
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  r.onstart = () => {
    listening = true;
    micBtn.classList.add("listening");
    micBtn.innerHTML = "🔴 <span>Sun raha hoon...</span>";
    statusEl.textContent = "Ab Roman Urdu ya Urdu mein boliye...";
  };
  r.onresult = e => {
    const transcript = e.results[0][0].transcript;
    input.value = transcript;
    statusEl.textContent = "Aap ki baat likh di gayi. Jawab bhej raha hoon...";
    sendMessage(transcript);
  };
  r.onerror = e => {
    statusEl.textContent = e.error === "not-allowed"
      ? "Microphone permission allow karein."
      : "Awaaz samajh nahi aayi. Dobara koshish karein ya type karein.";
  };
  r.onend = () => {
    listening = false;
    micBtn.classList.remove("listening");
    micBtn.innerHTML = "🎤 <span>Bol kar poochhein</span>";
  };
  return r;
}

micBtn.addEventListener("click", () => {
  if (!recognition) recognition = setupRecognition();
  if (!recognition) return;
  if (listening) recognition.stop();
  else {
    try { recognition.start(); }
    catch (_) { statusEl.textContent = "Mic dobara use karne se pehle ek lamha ruk kar try karein."; }
  }
});

input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
