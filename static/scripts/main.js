/**
 * GlucoShield - Main Interactive Logic
 */
document.addEventListener('DOMContentLoaded', function () {
  // 1. Theme Management (Sync with localStorage and system preference)
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const root = document.documentElement;

  function updateThemeUI(theme) {
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      root.classList.add('dark');
      if (themeIcon) themeIcon.className = 'fas fa-sun';
    } else {
      root.classList.remove('dark');
      if (themeIcon) themeIcon.className = 'fas fa-moon';
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // Ignore localStorage restrictions
    }
  }

  // Detect current theme on load
  const initialTheme = root.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
  updateThemeUI(initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      updateThemeUI(next);
    });
  }

  // 2. Mobile Navigation Toggle
  const mobileNavToggle = document.getElementById('mobileNavToggle');
  const mainNav = document.getElementById('mainNav');
  if (mobileNavToggle && mainNav) {
    mobileNavToggle.addEventListener('click', function () {
      const isVisible = mainNav.style.display === 'flex';
      mainNav.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        mainNav.style.flexDirection = 'column';
        mainNav.style.position = 'absolute';
        mainNav.style.top = '74px';
        mainNav.style.left = '0';
        mainNav.style.right = '0';
        mainNav.style.background = 'var(--bg-surface)';
        mainNav.style.padding = '1.5rem';
        mainNav.style.boxShadow = 'var(--shadow-xl)';
        mainNav.style.borderBottom = '1px solid var(--border-light)';
      }
    });
  }

  // 3. Automated BMI Calculator Helper (Height in cm & Weight in kg -> BMI)
  const heightInput = document.querySelector('input[name="height"]');
  const weightInput = document.querySelector('input[name="weight"]');
  const bmiInput = document.querySelector('input[name="bmi"]');

  function calculateAutoBMI() {
    if (!heightInput || !weightInput || !bmiInput) return;
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);
    if (h > 50 && w > 10) {
      const hm = h / 100;
      const computedBmi = (w / (hm * hm)).toFixed(1);
      if (computedBmi > 10 && computedBmi < 70) {
        bmiInput.value = computedBmi;
        // Trigger input event on bmiInput so live preview updates!
        bmiInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  if (heightInput && weightInput) {
    heightInput.addEventListener('input', calculateAutoBMI);
    weightInput.addEventListener('input', calculateAutoBMI);
  }

  // 4. Dynamic Form Conditional Fields
  const genderSelect = document.querySelector('select[name="gender"]');
  const gestationalGroup = document.getElementById('gestationalGroup') || document.querySelector('[data-group="gestational"]');
  if (genderSelect && gestationalGroup) {
    function checkGender() {
      if (genderSelect.value === 'Female') {
        gestationalGroup.style.display = 'flex';
      } else {
        gestationalGroup.style.display = 'none';
      }
    }
    genderSelect.addEventListener('change', checkGender);
    checkGender();
  }

  const familyHistorySelect = document.querySelector('select[name="family_history"]');
  const familyMemberGroup = document.getElementById('familyMemberGroup') || document.querySelector('[data-group="family-member"]');
  if (familyHistorySelect && familyMemberGroup) {
    function checkFamily() {
      if (familyHistorySelect.value === 'Yes') {
        familyMemberGroup.style.display = 'flex';
      } else {
        familyMemberGroup.style.display = 'none';
      }
    }
    familyHistorySelect.addEventListener('change', checkFamily);
    checkFamily();
  }

  // 5. Standard Form Submit Loader State
  const standardForms = document.querySelectorAll('form:not(#bulkUploadForm)');
  standardForms.forEach(function (form) {
    form.addEventListener('submit', function () {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Clinical Risk...';
      }
    });
  });

  // 6. Bulk Prediction Upload Logic (Drag-and-drop & AJAX file streamer)
  const bulkForm = document.getElementById('bulkUploadForm');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const loader = document.getElementById('bulkLoading');
  const status = document.getElementById('bulkStatus');

  function showFileMeta(name, size) {
    if (fileInfo && fileName) {
      const sizeStr = size ? ` (${(size / 1024).toFixed(1)} KB)` : '';
      fileName.textContent = name + sizeStr;
      fileInfo.style.display = 'flex';
    }
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        const f = e.dataTransfer.files[0];
        showFileMeta(f.name, f.size);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        const f = fileInput.files[0];
        showFileMeta(f.name, f.size);
      }
    });
  }

  if (bulkForm) {
    bulkForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (loader) loader.style.display = 'block';
      if (status) {
        status.textContent = 'Parsing clinical records and computing risk scores...';
        status.style.color = 'var(--primary)';
      }

      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        if (status) {
          status.textContent = 'Please choose a CSV file first.';
          status.style.color = 'var(--risk-high)';
        }
        if (loader) loader.style.display = 'none';
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = function (ev) {
        const text = ev.target.result;
        const form = new FormData();
        const modeSelect = bulkForm.querySelector('select[name="mode"]');
        const mode = modeSelect ? modeSelect.value : 'quick';
        form.append('mode', mode);
        form.append('file_text', text);

        fetch('/bulk-predict-ajax', {
          method: 'POST',
          body: form,
        })
          .then(async function (response) {
            if (!response.ok) {
              const errTxt = await response.text();
              throw new Error(errTxt || 'Bulk processing failed');
            }
            const blob = await response.blob();
            const cd = response.headers.get('Content-Disposition') || '';
            const m = cd.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i);
            const downloadFilename = m ? (m[1] || m[2] || 'bulk_predictions.csv') : 'bulk_predictions.csv';

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            if (status) {
              status.textContent = '✔ Batch predictions computed and downloaded successfully!';
              status.style.color = 'var(--risk-low)';
            }
          })
          .catch(function (err) {
            if (status) {
              status.textContent = 'Error: ' + (err.message || 'Processing failed');
              status.style.color = 'var(--risk-high)';
            }
          })
          .finally(function () {
            if (loader) loader.style.display = 'none';
          });
      };

      reader.onerror = function () {
        if (status) {
          status.textContent = 'Failed to read file in browser.';
          status.style.color = 'var(--risk-high)';
        }
        if (loader) loader.style.display = 'none';
      };

      reader.readAsText(file);
    });
  }
});
