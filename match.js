/* Keyword matching demo, adapted from the supplied prototype and Supabase formula.
   No Supabase connection, API call, PDF reading, or AI generation. */
'use strict';

// DEMO ONLY: these are illustrative requirements, NOT official employer criteria.
const demoRoles = {
  'Technology Intern': {
    req: ['Troubleshooting', 'Networking', 'Windows', 'Customer Service'],
    pref: ['Linux', 'Active Directory']
  },
  'Business Analyst Intern': {
    req: ['Excel', 'SQL', 'Communication', 'Data Analysis'],
    pref: ['Tableau', 'Statistics']
  },
  'Software Engineering Intern': {
    req: ['Python', 'SQL', 'JavaScript', 'React'],
    pref: ['AWS', 'Docker']
  }
};

function normalizeSkill(skill) {
  return skill.trim().toLowerCase();
}
function calculateKeywordMatch(skills, role) {
  const known = new Set(skills.map(normalizeSkill).filter(Boolean));
  const matchedReq = role.req.filter(skill => known.has(normalizeSkill(skill)));
  const matchedPref = role.pref.filter(skill => known.has(normalizeSkill(skill)));
  const missingReq = role.req.filter(skill => !known.has(normalizeSkill(skill)));
  const missingPref = role.pref.filter(skill => !known.has(normalizeSkill(skill)));
  // Exact formula from team's Supabase Edge Function.
  const score = Math.round(100 * (
    .75 * (role.req.length ? matchedReq.length / role.req.length : 1) +
    .25 * (role.pref.length ? matchedPref.length / role.pref.length : 1)
  ));
  return { score, matchedReq, matchedPref, missingReq, missingPref };
}
function generateFeedback(r, role) {
  const parts = [
    `You match ${r.matchedReq.length} of ${role.req.length} required skills and ${r.matchedPref.length} of ${role.pref.length} preferred skills.`
  ];
  if (r.matchedReq.length) parts.push(`Highlight your experience with ${r.matchedReq.join(', ')} in your résumé.`);
  if (r.missingReq.length) parts.push(`Prioritize developing or demonstrating these required skills: ${r.missingReq.join(', ')}.`);
  else parts.push('You match every listed required skill keyword.');
  if (r.missingPref.length) parts.push(`Additional experience with ${r.missingPref.join(', ')} may strengthen your profile.`);
  return parts.join(' ');
}
function addText(parent, tag, content, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  parent.append(element);
  return element;
}
function addSkillTags(parent, values) {
  if (!values.length) { addText(parent, 'p', 'None'); return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-tags';
  for (const skill of values) addText(wrapper, 'span', skill, 'skill-chip');
  parent.append(wrapper);
}
window.renderKeywordMatch = function renderKeywordMatch() {
  const company = document.getElementById('company').value;
  const roleName = document.getElementById('role').value;
  const skills = document.getElementById('skills').value.split(',');
  const role = demoRoles[roleName];
  const r = calculateKeywordMatch(skills, role);
  const result = document.getElementById('result');
  result.replaceChildren();
  result.className = 'result';
  addText(result, 'span', 'KEYWORD MATCH · DEMO DATA · NOT AI', 'tag');
  addText(result, 'p', `${company} · ${roleName}`);
  const score = addText(result, 'div', `${r.score}%`, 'score');
  score.setAttribute('aria-label', `Match score: ${r.score} percent`);
  addText(result, 'strong', 'Skill match rate');
  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', String(r.score));
  const fill = document.createElement('span');
  fill.style.width = `${r.score}%`;
  progress.append(fill);
  result.append(progress);
  addText(result, 'p', `Required: ${r.matchedReq.length}/${role.req.length} · Preferred: ${r.matchedPref.length}/${role.pref.length}`);
  addText(result, 'strong', 'Matching skills');
  addSkillTags(result, [...r.matchedReq, ...r.matchedPref]);
  addText(result, 'strong', 'Missing skills');
  addSkillTags(result, [...r.missingReq, ...r.missingPref]);
  addText(result, 'strong', 'Feedback');
  addText(result, 'p', generateFeedback(r, role));
  addText(result, 'p', 'Score = 75% required skill coverage + 25% preferred skill coverage. Exact keyword matching (case-insensitive). No file was analyzed, no data was saved.', 'small');
  result.setAttribute('tabindex', '-1');
  result.focus({preventScroll: true});
  result.scrollIntoView({behavior: 'smooth', block: 'nearest'});
};
