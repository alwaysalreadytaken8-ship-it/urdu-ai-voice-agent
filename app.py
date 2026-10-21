import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()
ROOT = Path(__file__).parent
API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()

app = FastAPI(title="Urdu AI Voice Agent")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

SYSTEM_PROMPT = """
You are a friendly Urdu AI voice assistant. The user usually speaks Roman Urdu.
Reply naturally and briefly in Roman Urdu unless the user asks for English or Urdu script.
Keep answers suitable for being spoken aloud, normally 2-5 sentences.
If you are uncertain, say so. Do not claim to be human.
"""

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)

@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/chat")
def chat(body: ChatRequest):
    if not API_KEY or API_KEY == "paste_your_api_key_here":
        raise HTTPException(status_code=503, detail="Server par OPENAI_API_KEY set nahi hai.")
    # Accept only user/assistant history messages and limit their size.
    safe_history = []
    for item in body.history[-12:]:
        role = item.get("role")
        content = item.get("content", "")
        if role in ("user", "assistant") and isinstance(content, str):
            safe_history.append({"role": role, "content": content[:4000]})
    try:
        client = OpenAI(api_key=API_KEY)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                *safe_history,
                {"role": "user", "content": body.message},
            ],
            temperature=0.7,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            answer = "Maaf kijiye, is dafa jawab nahi bana. Dobara poochhein."
        return {"reply": answer}
    except Exception as exc:
        # Keep server-side detail out of the browser response.
        print(f"OpenAI API error: {exc}")
        raise HTTPException(status_code=502, detail="AI service se jawab nahi mil saka. API key, model aur billing check karein.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
