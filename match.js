/* Analyze page: sends the selected company ID and typed skills to /api/analyze-resume
   and renders the score, matched/missing skills and feedback.
   js/app.js calls window.renderKeywordMatch() when the form is submitted. */
'use strict';

const ANALYZE_API = '/api/analyze-resume';

function addText(parent, tag, content, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  parent.append(element);
  return element;
}

function addSkillTags(parent, values, emptyText) {
  if (!values.length) { addText(parent, 'p', emptyText || 'None'); return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-tags';
  for (const skill of values) addText(wrapper, 'span', skill, 'skill-chip');
  parent.append(wrapper);
}

function showAnalyzeError(message) {
  const result = document.getElementById('result');
  result.replaceChildren();
  result.className = '';
  addText(result, 'p', message, 'error').setAttribute('role', 'alert');
}

function showAnalyzeResult(d) {
  const result = document.getElementById('result');
  result.replaceChildren();
  result.className = 'result';

  addText(result, 'p', d.company.name);
  const score = addText(result, 'div', `${d.score}%`, 'score');
  score.setAttribute('aria-label', `Match score: ${d.score} percent`);
  addText(result, 'strong', 'Skill match rate');
  addText(result, 'p', 'Score = 75% required skill coverage + 25% preferred skill coverage. Matching is keyword-based.', 'small');

  result.setAttribute('tabindex', '-1');
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadCompanies() {
  const select = document.getElementById('company');
  try {
    const res = await fetch(ANALYZE_API);
    if (!res.ok) throw new Error();
    const rows = await res.json();
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = 'Select a company';
    select.append(first);
    for (const c of rows) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      select.append(opt);
    }
  } catch {
    select.replaceChildren();
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Could not load companies';
    select.append(opt);
    showAnalyzeError('Could not load companies. Check that the API is running and the Supabase environment variables are set.');
  }
}

window.renderKeywordMatch = async function renderKeywordMatch() {
  const companyId = document.getElementById('company').value;
  const skills = document.getElementById('skills').value;
  const button = document.querySelector('#form button.primary');
  const result = document.getElementById('result');

  result.className = '';
  result.textContent = 'Analyzing…';
  if (button) button.disabled = true;
  try {
    const res = await fetch(ANALYZE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, skills })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed.');
    showAnalyzeResult(data);
  } catch (err) {
    showAnalyzeError(err.message || 'Analysis failed.');
  } finally {
    if (button) button.disabled = false;
  }
};

loadCompanies();
