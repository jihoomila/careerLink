'use strict';

const page = document.body.dataset.page;
const form = document.getElementById('form');
const result = document.getElementById('result');
const fileInput = document.getElementById('file');
const dropZone = document.getElementById('drop');
const fileError = document.getElementById('fileerror');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let selectedFile = null;

document.querySelectorAll('.nav a.active').forEach(link => {
  link.setAttribute('aria-current', 'page');
});

function add(parent, tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
}

function renderBox(title, lines) {
  result.replaceChildren();
  result.className = 'result';
  add(result, 'strong', title);

  for (const line of lines) {
    add(result, 'p', line);
  }

  result.setAttribute('tabindex', '-1');
  result.focus({ preventScroll: true });
}

function chooseFile(file) {
  if (!file) return;

  selectedFile = null;
  result.replaceChildren();
  result.className = '';

  const filename = document.getElementById('filename');
  const valid = /\.(pdf|docx)$/i.test(file.name)
    && file.size > 0
    && file.size <= MAX_FILE_SIZE;

  if (!valid) {
    fileError.textContent = 'Choose a non-empty PDF or DOCX file up to 10 MB.';
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
    fileInput.value = '';
    chooseFile(event.dataTransfer.files[0]);
  });
}

function openDemoDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open('careerlink-demo-storage', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeSubmission(data) {
  const db = await openDemoDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('submissions', 'readwrite');
    transaction.objectStore('submissions').add(data);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('Storage failed'));
    };
  });
}

if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const companyInput = document.getElementById('company');
    const company = companyInput.value;
    const button = form.querySelector('button[type="submit"], button.primary');

    if (page === 'queue') {
      if (button.disabled) return;

      const name = document.getElementById('name').value.trim();
      const companyLabel = companyInput.selectedOptions[0].textContent.trim();

      if (!name) {
        renderBox('Enter your name.', []);
        return;
      }

      const originalLabel = button.textContent;
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
    } else if (page === 'upload') {
      if (!selectedFile) {
        fileError.textContent = 'Choose a PDF or DOCX résumé first.';
        return;
      }

      button.disabled = true;
      button.textContent = 'Saving…';

      try {
        await storeSubmission({
          company,
          name: document.getElementById('student-name').value.trim(),
          email: document.getElementById('student-email').value.trim(),
          filename: selectedFile.name,
          file: selectedFile,
          createdAt: new Date().toISOString()
        });
        renderBox('Demo résumé saved on this device.', [
          `${selectedFile.name} → ${company}`,
          'Saved in this browser (IndexedDB). NOT uploaded to Supabase or delivered to a recruiter.'
        ]);
      } catch (error) {
        renderBox('Could not save the résumé.', [
          error.message || 'Browser storage unavailable or full.'
        ]);
      } finally {
        button.disabled = false;
        button.textContent = 'Save Demo Submission →';
      }
    } else if (page === 'analyze' && typeof window.renderKeywordMatch === 'function') {
      window.renderKeywordMatch();
    }
  });

  form.addEventListener('input', event => {
    if (event.target === fileInput) return;
    result.replaceChildren();
    result.className = '';
  });
}
