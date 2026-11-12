/* Analyze page: shows the match percentage the student received when they uploaded their résumé.
   js/app.js saves it in this browser after a successful upload (key: careerlink-uploaded-scores-v1). */
'use strict';

function addText(parent, tag, content, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  parent.append(element);
  return element;
}

function showUploadedScores() {
  const box = document.getElementById('scores');
  if (!box) return;

  let items = [];
  try {
    const raw = JSON.parse(localStorage.getItem('careerlink-uploaded-scores-v1') || 'null');
    if (raw && raw.items) items = Object.values(raw.items);
  } catch {
    // unreadable storage: treat as nothing uploaded
  }
  items.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));

  box.replaceChildren();

  if (!items.length) {
    addText(box, 'strong', 'No résumé uploaded yet');
    const p = addText(box, 'p', 'Upload your PDF résumé to see your match percentage here. ');
    const link = document.createElement('a');
    link.href = '/upload.html';
    link.textContent = 'Go to Upload Résumé →';
    link.style.color = 'var(--green)';
    link.style.fontWeight = '600';
    p.append(link);
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('div');
    if (i > 0) {
      card.style.marginTop = '22px';
      card.style.paddingTop = '18px';
      card.style.borderTop = '1px solid #e1e8e3';
    }
    addText(card, 'strong', item.companyName);
    addText(card, 'p', item.filename);
    const score = addText(card, 'div', `${item.score}%`, 'score');
    score.setAttribute('aria-label', `Résumé match score for ${item.companyName}: ${item.score} percent`);
    addText(card, 'strong', 'Skill match rate');
    addText(card, 'p', `Scored on ${new Date(item.savedAt).toLocaleDateString()} from the PDF you uploaded in this browser. Score = 75% required + 25% preferred skills.`, 'small');
    box.append(card);
  });
}

showUploadedScores();
