from flask import Flask, render_template, request, session, redirect, url_for, send_file, jsonify
import os
import pickle
import csv
from io import BytesIO, StringIO
from datetime import datetime

try:
    import numpy as np
except Exception:
    np = None

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
except Exception:
    letter = None
    getSampleStyleSheet = None
    ParagraphStyle = None
    inch = None
    colors = None
    SimpleDocTemplate = None
    Paragraph = None
    Spacer = None
    Table = None
    TableStyle = None

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET', 'dev-secret-change-me')
# Debug helper: store a summary of the last bulk upload processed (for troubleshooting)
last_bulk_info = {}

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
quick_model = None
full_model = None


def load_model(filename):
    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model file not found: {path}")
    with open(path, 'rb') as f:
        return pickle.load(f)


def safe_float(value, default=0.0):
    try:
        if value is None or value == '':
            return float(default)
        return float(value)
    except Exception:
        return float(default)


def to_native(value):
    if value is None:
        return None
    if isinstance(value, dict):
        return {str(k): to_native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_native(v) for v in value]
    if np is not None and isinstance(value, np.generic):
        return value.item()
    if hasattr(value, 'tolist') and not isinstance(value, (str, bytes)):
        try:
            return value.tolist()
        except Exception:
            pass
    return value


def predict_with_model(model, features):
    """
    Predict diabetes risk using model or robust fallback.
    Returns (prediction, probability).
    """
    try:
        bmi = float(features[0]) if len(features) > 0 else 25.0
        glucose = float(features[1]) if len(features) > 1 else 100.0
        age = float(features[2]) if len(features) > 2 else 40.0
    except (ValueError, TypeError, IndexError):
        bmi, glucose, age = 25.0, 100.0, 40.0

    if glucose > 200:
        return 1, 95.0
    if glucose < 40:
        return 0, 5.0

    if model is not None:
        try:
            arr = np.asarray(features, dtype=float).reshape(1, -1)
            prediction = model.predict(arr)[0]
            if hasattr(model, 'predict_proba'):
                proba = model.predict_proba(arr)[0]
                probability = round(float(proba[1]) * 100, 2)
            else:
                probability = round(float(prediction) * 85 + 15, 2) if prediction == 1 else round(100 - (float(prediction) * 85 + 15), 2)
            if glucose > 150 and probability < 50:
                probability = min(probability + 30, 95)
            return prediction, round(probability, 1)
        except Exception as e:
            print(f"⚠️ Model error: {e}. Using fallback.")

    bmi_score = min(100, max(0, (bmi - 10) / 40 * 100))
    glucose_score = min(100, max(0, (glucose - 50) / 250 * 100))
    age_score = min(100, max(0, (age - 20) / 60 * 100))

    risk_score = (glucose_score * 0.5 + bmi_score * 0.3 + age_score * 0.2)
    probability = min(95, max(5, risk_score))

    if glucose > 150:
        probability = max(probability, 70.0)
    if glucose > 200:
        probability = max(probability, 85.0)

    prediction = 1 if probability > 50 else 0
    return prediction, round(probability, 1)


def get_risk_level(probability):
    if probability < 35:
        return 'low', 'Low Risk – Non-Diabetic', '#10b981'
    elif probability < 65:
        return 'moderate', 'Moderate Risk – Pre-Diabetic', '#f59e0b'
    return 'high', 'High Risk – Diabetic', '#ef4444'


def generate_recommendations(risk_level, bmi, glucose, age, patient):
    recommendations = []
    if risk_level == 'high':
        recommendations.append({'priority': 'high', 'text': 'Consult a doctor within 1 week'})
        recommendations.append({'priority': 'high', 'text': 'Get HbA1c or fasting glucose testing soon'})
    elif risk_level == 'moderate':
        recommendations.append({'priority': 'medium', 'text': 'Schedule a checkup in 3 months'})
        recommendations.append({'priority': 'medium', 'text': 'Start daily 30-minute walks'})
    else:
        recommendations.append({'priority': 'low', 'text': 'Annual screening is still recommended'})

    if bmi > 30:
        recommendations.append({'priority': 'high', 'text': f'BMI {bmi} – consider a 5-10% weight loss to improve insulin sensitivity'})
    elif bmi > 25:
        recommendations.append({'priority': 'medium', 'text': f'BMI {bmi} – small weight loss and regular activity can help lower risk'})

    if glucose > 126:
        recommendations.append({'priority': 'high', 'text': f'Glucose {glucose} mg/dL is elevated; discuss this with a healthcare provider'})
    elif glucose > 100:
        recommendations.append({'priority': 'medium', 'text': f'Glucose {glucose} mg/dL suggests prediabetes; reduce sugary drinks and refined carbs'})

    if age >= 45:
        recommendations.append({'priority': 'medium', 'text': 'Age 45+ means annual diabetes screening is recommended'})

    if patient.get('smoking') == 'Current':
        recommendations.append({'priority': 'high', 'text': 'Smoking raises diabetes risk; consider a quit plan or support programs'})

    if patient.get('family_history') == 'Yes':
        recommendations.append({'priority': 'medium', 'text': 'Family history increases risk, so regular monitoring matters'})

    return recommendations


def feature_vector_from_form(model, field_names, form):
    normalized = {}
    for key, value in form.items():
        normalized[key.lower().replace('-', '_')] = safe_float(value, 0.0)

    if model is not None:
        model_names = list(getattr(model, 'feature_names_in_', []))
        if model_names:
            ordered = []
            for name in model_names:
                key = name.lower().replace(' ', '_').replace('-', '_')
                if key == 'bloodpressure':
                    key = 'blood_pressure'
                elif key == 'skinthickness':
                    key = 'skin_thickness'
                elif key == 'dpf':
                    key = 'dpf'
                ordered.append(normalized.get(key, 0.0))
            return ordered

    return [safe_float(form.get(name, 0), 0.0) for name in field_names]


def parse_profile(form):
    profile = {}
    for key in ['name', 'age', 'gender', 'family_history', 'family_member', 'gestational', 'height', 'weight', 'activity', 'diet', 'smoking', 'alcohol', 'sleep', 'stress', 'hypertension', 'cholesterol_history', 'email', 'glucose', 'bmi', 'bp_systolic']:
        profile[key] = form.get(key)
    return profile


def apply_risk_modifiers(probability, patient):
    prob = float(probability)
    reasons = []
    if patient.get('family_history') == 'Yes':
        prob = min(95.0, prob * 1.15)
        reasons.append(('Family history increase', 15))
    if patient.get('smoking') == 'Current':
        prob = min(95.0, prob * 1.10)
        reasons.append(('Smoking risk factor', 10))
    if patient.get('hypertension') == 'Yes':
        prob = min(95.0, prob * 1.08)
        reasons.append(('Hypertension risk factor', 8))
    if patient.get('gender') == 'Female' and patient.get('gestational') == 'Yes':
        prob = min(95.0, prob * 1.12)
        reasons.append(('Previous gestational diabetes', 12))
    if patient.get('activity', 0) and float(patient.get('activity', 0)) < 150:
        prob = min(95.0, prob * 1.04)
        reasons.append(('Low physical activity', 4))
    if patient.get('sleep') and float(patient.get('sleep', 0)) < 6:
        prob = min(95.0, prob * 1.03)
        reasons.append(('Short sleep duration', 3))
    return prob, reasons


def load_models():
    """Legacy loader kept for compatibility but not called at import. Prefer ensure_model for lazy loading."""
    global quick_model, full_model
    for name, target in [('diabetes_quick_model.pkl', 'quick_model'), ('diabetes_full_model.pkl', 'full_model')]:
        try:
            path = os.path.join(MODEL_DIR, name)
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    if target == 'quick_model':
                        quick_model = pickle.load(f)
                    else:
                        full_model = pickle.load(f)
        except Exception:
            if target == 'quick_model':
                quick_model = None
            else:
                full_model = None


def ensure_model(mode):
    """Lazy-load the requested model ('quick' or 'full') into memory if available.
    Returns True if model is loaded or False otherwise."""
    global quick_model, full_model
    if mode == 'quick':
        if quick_model is not None:
            return True
        path = os.path.join(MODEL_DIR, 'diabetes_quick_model.pkl')
        if not os.path.exists(path):
            return False
        try:
            with open(path, 'rb') as f:
                quick_model = pickle.load(f)
            return True
        except Exception:
            quick_model = None
            return False
    else:
        if full_model is not None:
            return True
        path = os.path.join(MODEL_DIR, 'diabetes_full_model.pkl')
        if not os.path.exists(path):
            return False
        try:
            with open(path, 'rb') as f:
                full_model = pickle.load(f)
            return True
        except Exception:
            full_model = None
            return False


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'quick_model_loaded': quick_model is not None, 'full_model_loaded': full_model is not None})


@app.route('/assessment')
def assessment():
    return render_template('choice.html')


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/bulk')
def bulk_page():
    return render_template('bulk.html')


@app.route('/quick')
def quick():
    return render_template('quick.html')


@app.route('/full')
def full():
    return render_template('full.html')


@app.route('/predict', methods=['POST'])
def predict():
    patient = {
        'name': request.form.get('name', 'Patient'),
        'age': safe_float(request.form.get('age', 40), 40),
        'gender': request.form.get('gender', 'Other'),
        'email': request.form.get('email', ''),
        'height': safe_float(request.form.get('height', 0), 0),
        'weight': safe_float(request.form.get('weight', 0), 0),
        'bmi': safe_float(request.form.get('bmi', 0), 0),
        'glucose': safe_float(request.form.get('glucose', 100), 100),
        'bp_systolic': safe_float(request.form.get('bp_systolic', 120), 120),
        'activity': safe_float(request.form.get('activity', 0), 0),
        'diet': safe_float(request.form.get('diet', 5), 5),
        'smoking': request.form.get('smoking', 'Never'),
        'alcohol': request.form.get('alcohol', 'None'),
        'sleep': safe_float(request.form.get('sleep', 7), 7),
        'stress': safe_float(request.form.get('stress', 5), 5),
        'family_history': request.form.get('family_history', 'No'),
        'family_member': request.form.get('family_member', 'Parent') if request.form.get('family_history') == 'Yes' else None,
        'hypertension': request.form.get('hypertension', 'No'),
        'cholesterol_history': request.form.get('cholesterol_history', 'No'),
        'gestational': request.form.get('gestational') if request.form.get('gender') == 'Female' else None,
        'lifestyle_expanded': request.form.get('lifestyle_expanded', '0') == '1',
    }

    if patient['height'] > 0 and patient['weight'] > 0:
        height_m = patient['height'] / 100
        patient['bmi'] = round(patient['weight'] / (height_m * height_m), 1)

    bmi = patient['bmi'] or 25
    glucose = patient['glucose'] or 100
    age = patient['age'] or 40
    mode = request.form.get('mode', 'quick')

    # Ensure the requested model is loaded lazily. If loading fails, fall back to the built-in heuristic.
    try:
        ensure_model(mode)
    except Exception:
        # If ensure_model raises unexpectedly, ignore and let predict_with_model handle None model.
        pass

    if mode == 'quick':
        features = [bmi, glucose, age]
        label, probability = predict_with_model(quick_model, features)
    else:
        pregnancies = safe_float(request.form.get('pregnancies', 0), 0)
        blood_pressure = safe_float(request.form.get('blood_pressure', 120), 120)
        skin_thickness = safe_float(request.form.get('skin_thickness', 0), 0)
        insulin = safe_float(request.form.get('insulin', 0), 0)
        dpf = safe_float(request.form.get('dpf', 0.5), 0.5)
        features = [pregnancies, glucose, blood_pressure, skin_thickness, insulin, bmi, dpf, age]
        label, probability = predict_with_model(full_model, features)

    probability, modifiers = apply_risk_modifiers(probability, patient)
    if glucose > 200:
        probability = max(probability, 85.0)
        risk_level, result_text, color = 'high', 'High Risk – Diabetic', '#ef4444'
    elif glucose > 150 and probability < 50:
        probability = min(probability + 30, 80.0)
        risk_level, result_text, color = get_risk_level(probability)
    else:
        risk_level, result_text, color = get_risk_level(probability)
    recommendations = generate_recommendations(risk_level, bmi, glucose, age, patient)

    activity_score = min(10.0, (patient.get('activity', 0) or 0) / 15.0)
    diet_score = min(10.0, float(patient.get('diet', 5) or 5))
    sleep_score = min(10.0, (patient.get('sleep', 7) or 7) / 0.8)
    stress_score = max(0, 10 - float(patient.get('stress', 5) or 5))
    family_score = 8 if patient.get('family_history') == 'Yes' else 0
    smoking_score = {'Never': 10, 'Former': 5, 'Current': 0}.get(patient.get('smoking'), 5)

    # Persist patient separately for downstream flows (PDF, audit, re-assessment)
    session['patient'] = to_native(patient)
    session['result'] = to_native({
        'probability': round(probability, 1),
        'risk_level': risk_level,
        'result_text': result_text,
        'color': color,
        'recommendations': recommendations,
        'patient': patient,
        'bmi': bmi,
        'glucose': glucose,
        'age': age,
        'bp_systolic': patient.get('bp_systolic', 120),
        'bp_diastolic': 80,
        'date': datetime.now().strftime('%B %d, %Y'),
        'activity_score': round(activity_score, 1),
        'diet_score': round(diet_score, 1),
        'sleep_score': round(sleep_score, 1),
        'stress_score': round(stress_score, 1),
        'family_score': family_score,
        'smoking_score': smoking_score,
        'modifiers': modifiers,
        'label': int(label),
    })

    return render_template('results.html', **session['result'])


@app.route('/reset')
def reset():
    # Clear session result and patient when user cancels or wants to start over
    session.pop('result', None)
    session.pop('patient', None)
    return redirect(url_for('index'))


@app.route('/results')
def results():
    if 'result' not in session:
        return redirect(url_for('index'))
    if request.args.get('view') == 'details':
        return redirect(url_for('analytics'))
    return render_template('results.html', **session['result'])


@app.route('/analytics')
def analytics():
    if 'result' not in session:
        return redirect(url_for('index'))

    result = session.get('result', {})
    patient = result.get('patient', {})
    risk_level = result.get('risk_level', 'moderate')
    score = float(result.get('probability', 50))

    factors = [
        {'label': 'Glucose', 'percent': 35, 'value': f"{result.get('glucose', 100)} mg/dL"},
        {'label': 'BMI', 'percent': 22, 'value': f"{result.get('bmi', 25)} kg/m²"},
        {'label': 'Age', 'percent': 8, 'value': f"{patient.get('age', 40)} years"},
        {'label': 'Family history', 'percent': 15 if patient.get('family_history') == 'Yes' else 0, 'value': patient.get('family_history', 'No')},
        {'label': 'Smoking', 'percent': 5 if patient.get('smoking') == 'Current' else 0, 'value': patient.get('smoking', 'Never')},
    ]

    lifestyle = {
        'activity': patient.get('activity', 0) or 0,
        'diet': patient.get('diet', 0) or 0,
        'sleep': patient.get('sleep', 0) or 0,
        'stress': patient.get('stress', 0) or 0,
        'smoking': patient.get('smoking', 'Never'),
        'alcohol': patient.get('alcohol', 'None'),
    }

    recommendations = result.get('recommendations', [])
    has_lifestyle_data = any(v not in (None, '', 0, 'None', 'Never', 'No') for v in lifestyle.values()) or patient.get('family_history') == 'Yes'

    return render_template(
        'analytics.html',
        probability=score,
        color=result.get('color', '#0d9488'),
        risk_level=risk_level,
        result_text=result.get('result_text', 'Moderate Risk'),
        glucose=result.get('glucose', 100),
        bmi=result.get('bmi', 25),
        age=patient.get('age', 40),
        gender=patient.get('gender', 'Other'),
        name=patient.get('name', 'Patient'),
        date=result.get('date', 'Assessment date unavailable'),
        bp_systolic=result.get('bp_systolic', 120),
        bp_diastolic=result.get('bp_diastolic', 80),
        activity_score=result.get('activity_score', 5),
        diet_score=result.get('diet_score', 5),
        sleep_score=result.get('sleep_score', 5),
        stress_score=result.get('stress_score', 5),
        family_score=result.get('family_score', 0),
        smoking_score=result.get('smoking_score', 5),
        patient=patient,
        modifiers=result.get('modifiers', []),
        factors=factors,
        recommendations=recommendations,
        has_lifestyle_data=has_lifestyle_data,
        lifestyle=lifestyle,
    )


@app.route('/bulk-predict', methods=['GET', 'POST'])
def bulk_predict():

    if request.method == 'GET':
        return render_template('bulk.html')

    if 'file' not in request.files:
        return 'No file uploaded', 400

    uploaded = request.files['file']
    if uploaded.filename == '':
        return 'No file selected', 400

    mode = request.form.get('mode', 'quick')
    # Lazy-load required model for bulk predictions
    try:
        ensure_model(mode)
    except Exception:
        pass

    # Snapshot request-level metadata to help debug missing file uploads
    try:
        global last_bulk_info
        last_bulk_info = {
            'received': True,
            'form_keys': list(request.form.keys()),
            'files_keys': list(request.files.keys()),
            'content_length': request.content_length,
        }
    except Exception:
        app.logger.exception('Could not record request metadata for bulk upload')

    try:
        # Read bytes robustly and log basic diagnostics so browser errors are visible
        raw = b''
        try:
            # Prefer the underlying stream to avoid read-position issues
            stream = getattr(uploaded, 'stream', None)
            if stream is not None:
                try:
                    stream.seek(0)
                except Exception:
                    pass
                try:
                    raw = stream.read()
                except Exception:
                    raw = b''

            # If nothing read, try FileStorage.read() (some WSGI servers buffer differently)
            if not raw:
                try:
                    uploaded.seek(0)
                except Exception:
                    pass
                try:
                    raw = uploaded.read()
                except Exception:
                    raw = b''

            # Final fallback: read raw request body
            if not raw:
                try:
                    raw = request.get_data() or b''
                except Exception:
                    raw = b''
        except Exception:
            app.logger.exception('Error reading uploaded file')
            raw = b''

        app.logger.info(f"Bulk upload received: filename={uploaded.filename} size_bytes={len(raw)}")
        if not raw or len(raw) == 0:
            app.logger.warning("Uploaded file appears empty")
            return 'Uploaded file is empty', 400

        # Try UTF-8 with BOM, fallback to latin-1
        try:
            content = raw.decode('utf-8-sig')
        except Exception:
            try:
                content = raw.decode('latin-1')
            except Exception:
                app.logger.exception('Failed to decode uploaded CSV')
                return 'Could not decode uploaded file as text CSV', 400

        app.logger.debug(f"CSV preview (first 300 chars): {content[:300]!r}")

        text_stream = StringIO(content, newline='')
        reader = csv.DictReader(text_stream)
        if reader.fieldnames:
            reader.fieldnames = [
                (field.strip().lower().replace(' ', '_').replace('-', '_') if field else '')
                for field in reader.fieldnames
            ]

        rows = []
        for row in reader:
            if row is None:
                continue
            normalized_row = {}
            for key, value in row.items():
                if key is None:
                    continue
                normalized_key = key.strip().lower().replace(' ', '_').replace('-', '_')
                normalized_row[normalized_key] = value.strip() if isinstance(value, str) else value
            rows.append(normalized_row)

        # Diagnostic: expose parsed row count and a small preview for troubleshooting
        try:
            # 'last_bulk_info' is declared global earlier in the function; update it here
            last_bulk_info = {
                'filename': uploaded.filename,
                'rows': len(rows),
                'preview': rows[:5]
            }
        except Exception:
            app.logger.exception('Unable to set last_bulk_info')

        if not rows:
            app.logger.warning('CSV parsed but returned zero rows after normalization')
            return 'CSV file parsed but contained no rows; check separators and line endings', 400

        result_rows = []

        for row in rows:
            try:
                if mode == 'quick':
                    bmi = safe_float(row.get('bmi', row.get('BMI', 25)), 25)
                    glucose = safe_float(row.get('glucose', row.get('Glucose', 100)), 100)
                    age = safe_float(row.get('age', row.get('Age', 40)), 40)
                    _, prob = predict_with_model(quick_model, [bmi, glucose, age])
                else:
                    pregnancies = safe_float(row.get('pregnancies', 0), 0)
                    glucose = safe_float(row.get('glucose', row.get('Glucose', 100)), 100)
                    bp = safe_float(row.get('blood_pressure', row.get('BloodPressure', row.get('bp_systolic', 120))), 120)
                    skin = safe_float(row.get('skin_thickness', row.get('SkinThickness', 0)), 0)
                    insulin = safe_float(row.get('insulin', row.get('Insulin', 0)), 0)
                    bmi = safe_float(row.get('bmi', row.get('BMI', 25)), 25)
                    dpf = safe_float(row.get('dpf', row.get('DPF', 0.5)), 0.5)
                    age = safe_float(row.get('age', row.get('Age', 40)), 40)
                    _, prob = predict_with_model(full_model, [pregnancies, glucose, bp, skin, insulin, bmi, dpf, age])

                risk_level, _, _ = get_risk_level(prob)
                result_rows.append({**row, 'risk_score': round(prob, 1), 'risk_level': risk_level})
            except Exception as exc:
                result_rows.append({**row, 'risk_score': 'Error', 'risk_level': str(exc)})

        output = StringIO(newline='')
        if result_rows:
            writer = csv.DictWriter(output, fieldnames=result_rows[0].keys())
            writer.writeheader()
            writer.writerows(result_rows)

        return send_file(
            BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'bulk_predictions_{datetime.now().strftime("%Y%m%d_%H%M")}.csv'
        )
    except Exception as exc:
        app.logger.exception('Bulk predict failed')
        return f'Error processing file: {str(exc)}', 500


@app.route('/bulk-predict-ajax', methods=['POST'])
def bulk_predict_ajax():
    """Alternate endpoint that accepts raw CSV text in a form field 'file_text'.
    This is used when browser file uploads arrive empty — the client reads the file with FileReader
    and sends the text payload to this endpoint which returns a CSV attachment response.
    """
    if 'file_text' not in request.form:
        return 'No file_text provided', 400

    file_text = request.form.get('file_text', '')
    if not file_text:
        return 'Uploaded file is empty', 400

    mode = request.form.get('mode', 'quick')
    try:
        # reuse parsing logic from bulk_predict but operate on provided text
        content = file_text
        text_stream = StringIO(content, newline='')
        reader = csv.DictReader(text_stream)
        if reader.fieldnames:
            reader.fieldnames = [
                (field.strip().lower().replace(' ', '_').replace('-', '_') if field else '')
                for field in reader.fieldnames
            ]

        rows = []
        for row in reader:
            if row is None:
                continue
            normalized_row = {}
            for key, value in row.items():
                if key is None:
                    continue
                normalized_key = key.strip().lower().replace(' ', '_').replace('-', '_')
                normalized_row[normalized_key] = value.strip() if isinstance(value, str) else value
            rows.append(normalized_row)

        result_rows = []
        for row in rows:
            try:
                if mode == 'quick':
                    bmi = safe_float(row.get('bmi', row.get('BMI', 25)), 25)
                    glucose = safe_float(row.get('glucose', row.get('Glucose', 100)), 100)
                    age = safe_float(row.get('age', row.get('Age', 40)), 40)
                    _, prob = predict_with_model(quick_model, [bmi, glucose, age])
                else:
                    pregnancies = safe_float(row.get('pregnancies', 0), 0)
                    glucose = safe_float(row.get('glucose', row.get('Glucose', 100)), 100)
                    bp = safe_float(row.get('blood_pressure', row.get('BloodPressure', row.get('bp_systolic', 120))), 120)
                    skin = safe_float(row.get('skin_thickness', row.get('SkinThickness', 0)), 0)
                    insulin = safe_float(row.get('insulin', row.get('Insulin', 0)), 0)
                    bmi = safe_float(row.get('bmi', row.get('BMI', 25)), 25)
                    dpf = safe_float(row.get('dpf', row.get('DPF', 0.5)), 0.5)
                    age = safe_float(row.get('age', row.get('Age', 40)), 40)
                    _, prob = predict_with_model(full_model, [pregnancies, glucose, bp, skin, insulin, bmi, dpf, age])

                risk_level, _, _ = get_risk_level(prob)
                result_rows.append({**row, 'risk_score': round(prob, 1), 'risk_level': risk_level})
            except Exception as exc:
                result_rows.append({**row, 'risk_score': 'Error', 'risk_level': str(exc)})

        output = StringIO(newline='')
        if result_rows:
            writer = csv.DictWriter(output, fieldnames=result_rows[0].keys())
            writer.writeheader()
            writer.writerows(result_rows)

        return send_file(
            BytesIO(output.getvalue().encode('utf-8')),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'bulk_predictions_{datetime.now().strftime("%Y%m%d_%H%M")}.csv'
        )
    except Exception as exc:
        app.logger.exception('Bulk predict ajax failed')
        return f'Error processing file: {str(exc)}', 500


@app.route('/bulk-test')
def bulk_test_download():
    """Simple test endpoint to download a small sample CSV with correct headers.
    Use this to verify that the browser will download an attachment from the server.
    """
    sample = 'bmi,glucose,age\n11,127,77\n20,78,66\n22,88,32\n'
    return send_file(BytesIO(sample.encode('utf-8')), mimetype='text/csv', as_attachment=True, download_name='bulk_test_sample.csv')


@app.route('/bulk-status')
def bulk_status():
    """Return JSON about the last bulk upload the server parsed (for debugging)."""
    try:
        return jsonify(last_bulk_info)
    except Exception:
        return jsonify({'error': 'no bulk info available'})


@app.route('/bulk-debug', methods=['GET', 'POST'])
def bulk_debug():
    """Temporary debug endpoint: GET shows a tiny upload form, POST returns JSON about the uploaded file.
    Use this from your browser to confirm whether the file bytes arrive at the server when submitted from Chrome.
    """
    if request.method == 'GET':
        return """
        <!doctype html>
        <html><body>
          <h3>Bulk debug upload</h3>
          <form method="POST" enctype="multipart/form-data">
            <input type="file" name="file" accept=".csv" required><br><br>
            <button type="submit">Upload for debug</button>
          </form>
        </body></html>
        """

    # POST: inspect the upload
    if 'file' not in request.files:
        return jsonify({'files_keys': list(request.files.keys()), 'form_keys': list(request.form.keys()), 'message': 'No file part in request'}), 400

    f = request.files['file']
    raw = f.read()
    preview = None
    try:
        preview = raw[:512].decode('utf-8', errors='replace')
    except Exception:
        preview = str(raw[:512])

    info = {
        'filename': f.filename,
        'size_bytes': len(raw),
        'preview': preview,
        'form_keys': list(request.form.keys()),
        'files_keys': list(request.files.keys())
    }
    return jsonify(info), 200


@app.route('/download-report')
def download_report():
    if 'result' not in session:
        return redirect(url_for('index'))
    data = session['result']
    patient = data.get('patient', {})

    if not all([letter, getSampleStyleSheet, ParagraphStyle, inch, colors, SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle]):
        return 'PDF reporting dependency is missing. Please install reportlab.', 500

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=0.75 * inch, leftMargin=0.75 * inch, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=colors.HexColor('#0f172a'))
    subtitle_style = ParagraphStyle('AppName', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#475569'))
    heading_style = ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=18, textColor=colors.HexColor('#0f172a'))
    normal_style = ParagraphStyle('ReportNormal', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14)
    small_style = ParagraphStyle('ReportSmall', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#475569'))
    risk_color = colors.HexColor(data.get('color', '#0d9488'))

    story.append(Paragraph('Diabetes Risk Assessment Report', title_style))
    story.append(Paragraph('MedInsight AI', subtitle_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", small_style))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph('<b>Patient Information</b>', heading_style))
    story.append(Paragraph(f"Name: {patient.get('name', 'N/A')}", normal_style))
    story.append(Paragraph(f"Age / Gender: {patient.get('age', 'N/A')} / {patient.get('gender', 'N/A')}", normal_style))
    story.append(Paragraph(f"Assessment Date: {data.get('date', datetime.now().strftime('%B %d, %Y'))}", normal_style))
    story.append(Spacer(1, 0.15 * inch))

    risk_text = data.get('result_text', 'Moderate Risk')
    risk_score = data.get('probability', 50)
    story.append(Paragraph('<b>Risk Summary</b>', heading_style))
    story.append(Paragraph(f"Risk Score: <font color='{risk_color.hexval()}'> {risk_score}% </font>", normal_style))
    story.append(Paragraph(f"Risk Category: {risk_text}", normal_style))
    if data.get('risk_level') == 'low':
        interpretation = 'Your results are within the normal range. Continue routine screening and maintain healthy habits.'
    elif data.get('risk_level') == 'moderate':
        interpretation = 'Your results suggest moderate risk and support the need for preventive care and follow-up review.'
    else:
        interpretation = 'Your results indicate high risk. Please consult a healthcare provider immediately.'
    story.append(Paragraph(interpretation, normal_style))
    story.append(Spacer(1, 0.15 * inch))

    metrics = [
        ['Parameter', 'Value', 'Normal Range', 'Status'],
        ['Glucose', f"{data.get('glucose', 'N/A')} mg/dL", '70-99 mg/dL', 'High' if float(data.get('glucose', 0)) > 99 else 'Normal'],
        ['BMI', f"{data.get('bmi', 'N/A')}", '18.5-24.9', 'Overweight' if float(data.get('bmi', 0)) > 24.9 else 'Normal'],
        ['Age', f"{patient.get('age', 'N/A')} years", 'N/A', 'N/A'],
        ['Blood Pressure', f"{data.get('bp_systolic', 'N/A')}/{data.get('bp_diastolic', 'N/A')}", '90-120 / 60-80', 'Normal'],
        ['Activity', f"{patient.get('activity', 'N/A')} min/week" if patient.get('activity') not in (None, '', 0) else 'N/A', '150+ min/week', 'N/A'],
    ]
    table = Table(metrics, colWidths=[1.5 * inch, 1.6 * inch, 1.6 * inch, 1.1 * inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e2e8f0')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph('<b>Contributing Factors</b>', heading_style))
    factors = []
    if float(data.get('glucose', 0)) > 100:
        factors.append('Glucose: elevated and a major contributor to the risk assessment.')
    if float(data.get('bmi', 0)) > 25:
        factors.append('BMI: above the ideal range and contributing to increased metabolic risk.')
    if int(patient.get('age', 0) or 0) >= 45:
        factors.append('Age: older age increases long-term diabetes risk.')
    if patient.get('family_history') == 'Yes':
        factors.append('Family history: history of diabetes increases overall risk.')
    if patient.get('smoking') == 'Current':
        factors.append('Smoking: current smoking contributes to elevated risk.')
    if not factors:
        factors.append('No major risk modifiers were identified from the provided assessment data.')
    for entry in factors:
        story.append(Paragraph(f"- {entry}", normal_style))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph('<b>Recommendations</b>', heading_style))
    for idx, rec in enumerate(data.get('recommendations', []), start=1):
        story.append(Paragraph(f"{idx}. {rec.get('text', '')}", normal_style))
    story.append(Spacer(1, 0.2 * inch))

    lifestyle = patient or {}
    lifestyle_data_present = any(v not in (None, '', 0, 'None', 'No', 'Never') for v in [
        lifestyle.get('activity'),
        lifestyle.get('diet'),
        lifestyle.get('sleep'),
        lifestyle.get('stress'),
        lifestyle.get('alcohol'),
        lifestyle.get('smoking'),
        lifestyle.get('family_history'),
    ])
    if lifestyle_data_present:
        story.append(Paragraph('<b>Lifestyle Summary</b>', heading_style))
        story.append(Paragraph(f"Activity: {lifestyle.get('activity', 'N/A')} min/week", normal_style))
        story.append(Paragraph(f"Diet: {lifestyle.get('diet', 'N/A')}", normal_style))
        story.append(Paragraph(f"Smoking: {lifestyle.get('smoking', 'N/A')}", normal_style))
        story.append(Paragraph(f"Alcohol: {lifestyle.get('alcohol', 'N/A')}", normal_style))
        story.append(Paragraph(f"Sleep: {lifestyle.get('sleep', 'N/A')} hours/night", normal_style))
        story.append(Paragraph(f"Stress: {lifestyle.get('stress', 'N/A')}", normal_style))
        story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph('<b>Action Plan</b>', heading_style))
    if data.get('risk_level') == 'high':
        actions = [
            'Consult a doctor within 1 week and request an HbA1c or fasting glucose review.',
            'Follow a structured plan for nutrition, movement, and sleep quality immediately.'
        ]
    elif data.get('risk_level') == 'moderate':
        actions = [
            'Schedule a check-up in 3 months to monitor glucose and metabolic markers.',
            'Start daily walks and reduce refined carbohydrates or sugary drinks.'
        ]
    else:
        actions = [
            'Maintain annual screening and continue healthy, preventative routines.',
            'Keep a balanced diet, regular movement, and a sustainable sleep routine.'
        ]
    for entry in actions:
        story.append(Paragraph(f"- {entry}", normal_style))
    story.append(Spacer(1, 0.2 * inch))

    story.append(Paragraph('<b>Medical Disclaimer</b>', heading_style))
    story.append(Paragraph('This report is for educational and informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.', normal_style))
    doc.build(story)
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"diabetes_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf")


@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404


@app.errorhandler(500)
def server_error(e):
    return render_template('500.html'), 500


if __name__ == '__main__':
    os.makedirs('models', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
