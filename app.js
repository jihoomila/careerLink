'use strict';

const page = document.body.dataset.page;
const form = document.getElementById('form');
const result = document.getElementById('result');
const fileInput = document.getElementById('file');
const dropZone = document.getElementById('drop');
const fileError = document.getElementById('fileerror');
const isUpload = page === 'upload';
const maxFileSizeMB = isUpload ? 3 : 10;
const maxFileSize = maxFileSizeMB * 1024 * 1024;
let selectedFile = null;

document.querySelectorAll('.nav a.active').forEach(link => {
  link.setAttribute('aria-current', 'page');
});

function add(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
}

function clearResult() {
  result.replaceChildren();
  result.className = '';
}

function renderBox(title, lines) {
  clearResult();
  result.className = 'result';
  add(result, 'strong', title);

  for (const line of lines) {
    add(result, 'p', line);
  }

  result.setAttribute('tabindex', '-1');
  result.focus({ preventScroll: true });
}

function chooseFile(file) {
  selectedFile = null;
  clearResult();

  const filename = document.getElementById('filename');
  const allowedExtension = isUpload ? /\.pdf$/i : /\.(pdf|docx)$/i;

  if (!file || !allowedExtension.test(file.name)
      || file.size === 0 || file.size > maxFileSize) {
    const types = isUpload ? 'PDF' : 'PDF or DOCX';
    fileError.textContent = file
      ? `Choose a non-empty ${types} file up to ${maxFileSizeMB} MB.`
      : '';
    filename.textContent = 'Choose your résumé';
    fileInput.value = '';
    return;
  }

  selectedFile = file;
  fileError.textContent = '';
  filename.textContent = file.name;
}

if (fileInput) {
  fileInput.addEventListener('change', () => chooseFile(fileInput.files[0]));
}

if (fileInput && dropZone) {
  ['dragenter', 'dragover'].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(type => {
    dropZone.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', event => {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    fileInput.value = '';
    chooseFile(file);
  });
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the PDF.'));
    reader.onabort = () => reject(new Error('Reading the PDF was canceled.'));
    reader.readAsDataURL(file);
  });
}

if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (page === 'analyze') {
      if (typeof window.renderKeywordMatch === 'function') {
        window.renderKeywordMatch();
      }
      return;
    }

    if (page !== 'queue' && !isUpload) return;

    const companyInput = document.getElementById('company');
    const company = companyInput.value;
    const companyLabel = companyInput.selectedOptions[0]?.textContent.trim() || company;
    const button = form.querySelector('button[type="submit"], button.primary');
    if (button.disabled) return;

    const originalLabel = button.textContent;

    if (page === 'queue') {
      const name = document.getElementById('name').value.trim();

      if (!name) {
        renderBox('Enter your name.', []);
        return;
      }

      button.disabled = true;
      button.textContent = 'Joining…';

      try {
        const response = await fetch('/api/join-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: company, name })
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || data?.ticket == null) {
          renderBox('Could not get a queue number.', [
            data?.error || 'The server did not confirm your queue number.'
          ]);
          return;
        }

        renderBox(`Queue #${data.ticket}`, [companyLabel]);
      } catch {
        renderBox('Could not confirm your queue number.', [
          'Check your connection before submitting again.'
        ]);
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }

      return;
    }

    const file = selectedFile;
    if (!file) {
      fileError.textContent = 'Choose a PDF résumé first.';
      return;
    }

    const name = document.getElementById('student-name').value.trim();
    const email = document.getElementById('student-email').value.trim();

    clearResult();
    button.disabled = true;
    button.textContent = 'Uploading…';

    try {
      const fileBase64 = await readFileBase64(file);
      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          name,
          email,
          filename: file.name,
          fileBase64
        })
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.error || 'The server did not confirm the upload.');
      }

      renderBox('Résumé uploaded successfully.', [
        `${file.name} → ${companyLabel}`
      ]);
    } catch (error) {
      renderBox('Could not upload the résumé.', [error.message]);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  });

  form.addEventListener('input', event => {
    if (event.target !== fileInput) clearResult();
  });
}
