# 📋 PharmaAI Voice Testing Guide

This guide provides comprehensive testing scenarios for the voice and speech features of PharmaAI.

## 🎙️ Voice Recognition Tests (STT)

### 1. Basic Tablet Commands
- **Input**: "Combiflam tablet"
- **Expected**: "Combiflam tablet" appears in the chat and is processed correctly.

### 2. Multi-language Recognition
- **Hindi**: "दवा दवा" (Dawa Dawa)
- **Marathi**: "औषध घ्या" (Aushadh Ghya)
- **Expected**: The system correctly detects the language and responds appropriately.

---

## 🔊 Speech Output Tests (TTS)

### 1. Voice Selection Verification
- **Scenario**: Trigger any AI response using voice input (Mic button).
- **Verification**: Open Browser Console (F12).
- **Expected Log**: `[PharmaAI Voice] Using: Microsoft Zira Desktop - English (United States) (en-US)` (or equivalent Zira voice).
- **Fallback**: If Zira is unavailable, it should log a Female voice or the default system voice.

### 2. Emoji & Symbol Filtering
- **Scenario**: Send a message that triggers a response containing emojis or symbols (e.g., "order medicine").
- **Verification**: Listen to the AI speech.
- **Expected**: It should NOT say "party popper" or "check mark". It should skip: 🎉✅❌⚠️⚕️💊💰📦📝🧾★☆♦♥♠♣•.

### 3. Natural Speech Parameters
- **Rate**: 1.0 (Normal speed, easy to follow).
- **Pitch**: 1.0 (Natural human tone).
- **Volume**: 0.9 (Comfortable listening level).

---

## 🛠️ Debugging Tools

### Console Commands
Check all available voices on your system:
```javascript
window.speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang));
```

### Manual Voice Test
Test the speech engine directly from the console:
```javascript
const u = new SpeechSynthesisUtterance("Testing PharmaAI Voice Filtering 🎉 ★");
window.speechSynthesis.speak(u);
```

---

## ⚠️ Error Checking
- **Speech Error**: If the speech fails, check for `[PharmaAI Voice] Speech error:` in the console.
- **Microphone Access**: Ensure your browser has permission to use the microphone for recognition tests.
