# Diabetes Risk Prediction Web App

A Flask web application that predicts diabetes risk from health indicators and provides both single and bulk prediction modes.

## Features
- Quick prediction (glucose, BMI, age) with optional lifestyle/profile fields
- Full assessment (PIMA features) plus optional lifestyle and history fields
- Bulk prediction via CSV upload (quick or full format)
- Post-processing risk modifiers for family history, smoking, gestational diabetes, and more
- Results page with health profile, risk factor summary, and downloadable CSV for bulk runs

## Run locally
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then open `http://127.0.0.1:5001`.

Notes:
- Bulk prediction uses `pandas` if available, otherwise falls back to the Python csv module.
- The app expects model files in the `models/` directory: `diabetes_quick_model.pkl` and `diabetes_full_model.pkl`.
