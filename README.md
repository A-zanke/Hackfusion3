# PharmaBuddy - AI Pharmacy OS

## 🚀 Getting Started for Team Members

### 1. Clone the Project
```bash
git clone https://github.com/A-zanke/Hackfusion.git
cd Hackfusion
```

### 2. Setup Backend
```bash
cd backend
npm install
# Create .env file based on the template (see below)
```

### 3. Setup AI Agent
```bash
cd ai-agent
python -m venv venv
On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Setup Frontend
```bash
cd frontend
npm install
```

---

## 🏃 How to Run the Whole Project

You need **three terminal windows** open:

**Terminal 1: Backend**
```bash
cd backend
npm start
```

**Terminal 2: AI Agent**
```bash
cd ai-agent
# Activate venv first!
python main.py
```

**Terminal 3: Frontend**
```bash
cd frontend
npm run dev
```

---

## 📊 How to Import XLS Data to PostgreSQL

### Method A: Using DBeaver (GUI - Easiest)
1. Open **DBeaver** and connect to your PostgreSQL.
2. Right-click on your `Tables` folder -> **Import Data**.
3. Select **CSV** (Save your XLS as CSV first).
4. Map the columns and click **Finish**.

### Method B: Using Python (Automated)
I have added a script `ai-agent/import_data.py` (coming soon) that uses `pandas`.
1. Save XLS as `data.xlsx` in `ai-agent/`.
2. Run `python import_data.py`.

---

## 🛠 Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **AI Layer:** Python + FastAPI
- **Database:** PostgreSQL
- **Observability:** Langfuse
