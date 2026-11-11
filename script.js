// Prototype role data. Replace with Supabase companies.req / companies.pref later.
const roles = {
  software: { name: 'Northstar Tech · Software Engineering Intern', req: ['Python','SQL','JavaScript','React'], pref: ['AWS','Docker'] },
  data: { name: 'Harbor Analytics · Data Analyst Intern', req: ['SQL','Python','Excel','Data Visualization'], pref: ['Tableau','Statistics'] },
  it: { name: 'Summit Systems · IT Support Intern', req: ['Troubleshooting','Networking','Windows','Customer Service'], pref: ['Linux','Active Directory'] }
};
const normalize = s => s.trim().toLowerCase();
function calculateMatch(skills, company) {
  const known = new Set(skills.map(normalize).filter(Boolean));
  const matchedReq = company.req.filter(s => known.has(normalize(s)));
  const matchedPref = company.pref.filter(s => known.has(normalize(s)));
  const missingReq = company.req.filter(s => !known.has(normalize(s)));
  const missingPref = company.pref.filter(s => !known.has(normalize(s)));
  // Same formula as the existing Supabase Edge Function.
  const score = Math.round(100 * (0.75 * (company.req.length ? matchedReq.length / company.req.length : 1) + 0.25 * (company.pref.length ? matchedPref.length / company.pref.length : 1)));
  return {score,matchedReq,matchedPref,missingReq,missingPref};
}
function makeFeedback(r,company) {
  const parts = [`You match ${r.matchedReq.length} of ${company.req.length} required skills and ${r.matchedPref.length} of ${company.pref.length} preferred skills.`];
  if(r.matchedReq.length) parts.push(`Highlight your experience with ${r.matchedReq.join(', ')} in your resume.`);
  if(r.missingReq.length) parts.push(`To improve alignment, focus first on the required skills: ${r.missingReq.join(', ')}.`);
  else parts.push('You meet all listed required skill keywords.');
  if(r.missingPref.length) parts.push(`Additional experience with ${r.missingPref.join(', ')} may strengthen your profile.`);
  return parts.join(' ');
}
function tags(element,values,missing=false) {
  element.replaceChildren();
  if(!values.length){element.textContent='None';return;}
  for(const value of values){const tag=document.createElement('span');tag.className=`tag${missing?' missing':''}`;tag.textContent=value;element.append(tag);}
}
document.getElementById('analyze').addEventListener('click',()=>{
  const company=roles[document.getElementById('role').value];
  const skills=document.getElementById('skills').value.split(',');
  const r=calculateMatch(skills,company);
  document.getElementById('resultRole').textContent=company.name;
  document.getElementById('score').textContent=`${r.score}%`;
  document.getElementById('barfill').style.width=`${r.score}%`;
  document.getElementById('breakdown').textContent=`Required: ${r.matchedReq.length}/${company.req.length} · Preferred: ${r.matchedPref.length}/${company.pref.length}`;
  tags(document.getElementById('matched'),[...r.matchedReq,...r.matchedPref]);
  tags(document.getElementById('missing'),[...r.missingReq,...r.missingPref],true);
  document.getElementById('feedback').textContent=makeFeedback(r,company);
  document.getElementById('results').hidden=false;
});
