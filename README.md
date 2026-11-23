# GlucoShield — Clinical AI Diabetes Risk Intelligence Platform

A high-performance Flask clinical intelligence platform that provides rapid diabetes risk stratification, multi-variable machine learning scoring, automated priority care guidance, and population health screening.

![GlucoShield Banner](https://img.shields.io/badge/GlucoShield-Clinical%20AI-0284c7?style=for-the-badge&logo=shield&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-Web%20Framework-black?style=for-the-badge&logo=flask&logoColor=white)
![Scikit-Learn](https://img.shields.io/badge/scikit--learn-ML%20Ensemble-f59e0b?style=for-the-badge&logo=scikit-learn&logoColor=white)

---

## 🌟 Key Features

- **Clinical AI Design System**: Modern Deep Teal & Electric Cyan UI with responsive mobile navigation, glassmorphic surfaces, and seamless light/dark mode persistence.
- **Rapid Screening Studio (~60s)**: Fast clinic check-in triage using core clinical biometrics (Glucose, BMI with auto-calculator from Height & Weight, Age).
- **Full Clinical Review (~3 mins)**: Comprehensive diagnostic assessment evaluating 8 core clinical laboratory biomarkers (Insulin, Blood Pressure, Triceps Skinfold, Diabetes Pedigree Function, Pregnancies, Glucose, BMI, Age) alongside extended lifestyle risk modifiers.
- **Real-Time Live Monitor**: Interactive sticky preview with dynamic SVG gauges, risk percentage tracking, and clinical outlook indicators.
- **Publication-Ready Diagnostic Reports**:
  - High-DPI Radial Risk Gauge showing probability percentage.
  - Stratified clinical follow-up guidance grouped into High Priority, Medium Priority, and Preventative Maintenance.
  - Instant official PDF report generation via ReportLab.
- **In-Depth Clinical Analytics**: Risk driver contribution breakdown progress bars, comparative laboratory reference table with status badges, and an interactive **Chart.js Lifestyle Radar Chart**.
- **Population Health Bulk Screening**: Drag-and-drop CSV batch upload with asynchronous file processing, validation hints, downloadable templates, and instant batch risk CSV export.
- **Clinical Operations Command Center**: Real-time cohort analytics, risk distribution doughnut charts, weekly screening throughput histograms, and pipeline health monitoring.

---

## 🚀 Quickstart & Local Installation

### 1. Clone the repository
```bash
git clone https://github.com/sakthikumar-1/diabetes-risk-predictor.git
cd diabetes-risk-predictor
```

### 2. Set up virtual environment
```bash
python -m venv .venv

# On Windows PowerShell
.\.venv\Scripts\Activate.ps1

# On macOS/Linux
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the application
```bash
python app.py
```

Open your browser and navigate to:
```
http://127.0.0.1:5001
```

---

## 📂 Project Structure

```text
├── app.py                      # Flask backend, routes, ML inference, and session management
├── models/
│   ├── diabetes_quick_model.pkl # Trained fast-screening model
│   └── diabetes_full_model.pkl  # Trained comprehensive clinical model
├── static/
│   ├── css/
│   │   └── style.css           # Complete clinical design system & dark/light theme
│   └── scripts/
│       └── main.js             # Theme toggle, live BMI calc, and bulk CSV streamer
├── templates/
│   ├── base.html               # Navigation shell, topbar, and clinical footer
│   ├── index.html              # Landing page & live clinical monitor simulator
│   ├── choice.html             # Assessment mode selector (Quick vs Full)
│   ├── quick.html              # Fast triage assessment studio
│   ├── full.html               # 8-biomarker comprehensive review studio
│   ├── results.html            # Patient risk report with high-DPI radial gauge
│   ├── analytics.html          # Deep-dive analytics, factor breakdown & radar chart
│   ├── bulk.html               # Batch population CSV upload & processor
│   ├── dashboard.html          # Clinical operations center with Chart.js analytics
│   ├── 404.html                # Friendly clinical 404 page
│   └── 500.html                # Friendly clinical 500 page
├── requirements.txt            # Python dependencies
└── render.yaml                 # Deployment configuration
```

---

## 📄 License & Medical Disclaimer

This platform is developed for clinical screening, educational demonstration, and diagnostic decision-support assistance. It does not substitute for formal laboratory diagnostic panels or professional physician consultation.
