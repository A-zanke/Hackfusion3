import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd
from langfuse import Langfuse
from langfuse.openai import openai
import json
import datetime
import requests

load_dotenv()

app = FastAPI(title="PharmaBuddy AI Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host="https://cloud.langfuse.com"
)

# Configuration
EXCEL_FILE = "Consumer Order History 1  .xlsx"
BACKEND_URL = "http://localhost:5000/api"

# System Prompt
SYSTEM_PROMPT = """
You are an AI Pharmacy Assistant designed only for medicine-related conversations.
You must NOT respond to non-medicine topics.
If a user asks anything unrelated, politely say:
“I can help only with medicine ordering, refills, or pharmacy-related questions.”

🌐 Input Modes
Accept text chat and voice input (English, Hindi, Marathi).
Detect the language automatically and reply in the same language.

🗣️ Voice & Language Behavior
Marathi -> Marathi
Hindi -> Hindi
English -> English

🧠 Conversation Flow (STRICT ORDER)
Step 1: Understand Medicine Intent
Step 2: Confirmation (MANDATORY)
Step 3: Price + Minimal Details
Step 4: Prescription Check
Step 5: Order Placement

🔐 Decision Logic (Metadata to include in JSON response)
You MUST return your response in a JSON format containing:
{
  "reply": "your message to user",
  "thinking": "your internal reasoning / Chain of Thought",
  "intent_verified": true/false,
  "safety_checked": true/false,
  "stock_checked": true/false,
  "action": "none/confirm/order/refill",
  "order_details": { "medicines": [...], "total_price": 0, "customer": { "name": "...", "age": "...", "mobile": "..." } }
}

PROACTIVE REFILLS:
If you detect a repeat customer who has ordered the same medicine before and enough time has passed (e.g. 30 days), suggest a refill.
"""

@app.get("/")
async def root():
    return {"message": "PharmaBuddy AI Agent is running"}

@app.get("/traces")
async def get_traces():
    # In a real scenario, we'd fetch from Langfuse API. 
    # For this hackathon demo, we'll return some internal log or mock recent traces.
    return [
        {
            "id": "trace-" + str(i),
            "type": ["Stock", "Safety", "Intent"][i % 3],
            "message": f"AI pipeline step {i}: {['Stock level verified', 'Interaction safe', 'Medicine intent confirmed'][i%3]}",
            "created_at": (datetime.datetime.now() - datetime.timedelta(minutes=i*2)).isoformat(),
            "thinking": f"Thought {i}: Processing request... verifying data sources."
        } for i in range(10)
    ]

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_input = data.get("message")
    history = data.get("history", [])
    
    # Logic to identify refills (Predictive Intelligence)
    history_context = ""
    try:
        df = pd.read_excel(EXCEL_FILE)
        # Simple match by name if provided in history or current message
        if user_input:
            match = df[df['Name'].str.contains(user_input, na=False, case=False)]
            if not match.empty:
                history_context = f"Customer History Found: {match.tail(3).to_dict()}"
    except:
        pass

    completion = openai.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + f"\n\nContext: {history_context}"},
            *history,
            {"role": "user", "content": user_input}
        ],
        response_format={ "type": "json_object" },
        # trace_id=trace.id - openai method might vary depending on version, using extra_headers if needed or just trace
    )
    
    response_data = json.loads(completion.choices[0].message.content)
    
    # If the action is "refill", we can log it as a proactive event
    if response_data.get("action") == "refill":
        print("Proactive Refill Event Triggered")
        
    # If the action is "order", we save it to Excel and DB
    if response_data.get("action") == "order":
        save_order(response_data.get("order_details"))
        
    langfuse.generation(
        name="pharmacy-chat-gen",
        input=user_input,
        output=response_data,
        metadata={"history_context": history_context}
    )
    
    return response_data

def save_order(details):
    # Save to Database
    try:
        res = requests.post(f"{BACKEND_URL}/orders", json={
            "customer_name": details.get("customer", {}).get("name"),
            "mobile": details.get("customer", {}).get("mobile"),
            "age": details.get("customer", {}).get("age"),
            "items": details.get("items", [])
        })
        print("DB Save Status:", res.status_code)
    except Exception as e:
        print("DB Save Error:", e)

    # Save to Excel
    try:
        df = pd.read_excel(EXCEL_FILE)
        new_row = {
            'Patient ID': f"PAT{len(df)+1:03d}",
            'Patient Age': details.get("customer", {}).get("age"),
            'Name': details.get("customer", {}).get("name"),
            'Mobile number': details.get("customer", {}).get("mobile"),
            'Medicine Name': ", ".join([i['name'] for i in details.get("medicines", [])]),
            'Quantity': sum([i['quantity'] for i in details.get("medicines", [])]),
            'Date of Purchase': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'Total Price': details.get("total_price")
        }
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_excel(EXCEL_FILE, index=False)
        print("Excel Save Success")
    except Exception as e:
        print("Excel Save Error:", e)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
