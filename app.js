/* No external scripts. All user-controlled text is escaped before rendering. */
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso = cents => new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP'}).format(cents/100);
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const option = (value, name) => `<option value="${esc(value)}">${esc(name)}</option>`;
const field = (label, name, type='text', extra='') => `<label class="field">${label}<input name="${name}" type="${type}" ${extra} required></label>`;
const stat = (label, value) => `<div class="stat"><span>${label}</span><strong>${esc(value)}</strong></div>`;
const empty = cols => `<tr><td class="empty" colspan="${cols}">No records yet. Add one to get started.</td></tr>`;
let toastTimer;
function toast(message, error=false) { const el=$('#toast'); el.textContent=message; el.className=error?'error':''; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,6000); }
async function api(app, path, method='GET', data) {
  const response = await fetch(`/api/${app}${path}`, {method, ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const result = await response.json();
  if(!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
function bindForm(selector, action) {
  $(selector).addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button[type="submit"]');
    button.disabled=true;
    try { await action(Object.fromEntries(new FormData(form)), form); } catch(error) { toast(error.message,true); }
    finally { button.disabled=false; }
  });
}
function bindAction(selector, action) {
  $(selector).addEventListener('click', async event => { const button=event.target.closest('button'); if(!button) return; button.disabled=true;
    try { await action(button); } catch(error) { toast(error.message,true); } finally { button.disabled=false; }
  });
}
function hero(number, heading, description, track) { return `<header class="hero hero-row"><div><div class="eyebrow">AttendFlow / ${track}</div><h1>${heading}</h1><p>${description}</p></div><span class="badge">Interactive demo</span></header>`; }
async function attendance() {
  $('#view').innerHTML=hero('02','Every check-in accounted for.','Manage workshop attendance with one record per student and event. Reports include students who are absent.','Backend engineering')+`<div class="stats" id="stats"></div><div class="split"><section class="panel"><div class="toolbar"><select id="event-select" aria-label="Choose event"></select><a id="export" class="button secondary">Export CSV</a></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Time (local)</th><th>Action</th></tr></thead><tbody id="records"></tbody></table></div></section><div><section class="panel"><h2>Add student</h2><form id="student-form">${field('Student number','student_no','text','maxlength="30"')}${field('Full name','name','text','maxlength="120"')}${field('Course','course','text','maxlength="80" value="BS Computer Science"')}<button type="submit">Add student</button></form></section><section class="panel"><h2>Create event</h2><form id="event-form">${field('Event name','name','text','maxlength="120"')}${field('Event date','event_date','date')}<button type="submit">Create event</button></form></section></div></div><p class="footer">Demonstration attendance. Dates describe events; check-ins use the current time and are stored in UTC.</p>`;
  $('#event-form [name="event_date"]').value=today();
  async function records() { const event=$('#event-select').value; const list=await api('attendance',`/records?event_id=${event}`); $('#export').href=`/api/attendance/export?event_id=${event}`; $('#export').download='attendance.csv'; $('#stats').innerHTML=stat('Registered students',list.length)+stat('Checked in',list.filter(r=>r.time_in).length)+stat('Completed',list.filter(r=>r.time_out).length); $('#records').innerHTML=list.map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.student_no)}</small></td><td><span class="tag ${r.status==='Absent'?'warning':''}">${r.status}</span></td><td>${r.time_in?esc(new Date(r.time_in).toLocaleTimeString()):'—'}${r.time_out?`<br><small>Out ${esc(new Date(r.time_out).toLocaleTimeString())}</small>`:''}</td><td>${r.status==='Completed'?'Done':`<button class="small ${r.status==='Present'?'secondary':''}" data-student="${r.student_id}" data-action="${r.status==='Absent'?'check-in':'check-out'}">${r.status==='Absent'?'Check in':'Check out'}</button>`}</td></tr>`).join('')||empty(4); }
  async function events(selected) { const list=await api('attendance','/events'); const current=selected||$('#event-select').value; $('#event-select').innerHTML=list.map(e=>option(e.id,`${e.name} · ${e.event_date}`)).join(''); if(current) $('#event-select').value=current; await records(); }
  $('#event-select').addEventListener('change',()=>records().catch(e=>toast(e.message,true)));
  bindAction('#records',async b=>{ await api('attendance',`/${b.dataset.action}`,'POST',{student_id:Number(b.dataset.student),event_id:Number($('#event-select').value)}); await records(); toast('Attendance updated.'); });
  bindForm('#student-form',async(d,f)=>{ await api('attendance','/students','POST',d); f.reset(); await records(); toast('Student added.'); });
  bindForm('#event-form',async(d,f)=>{ const result=await api('attendance','/events','POST',d); f.reset(); f.elements.event_date.value=today(); await events(String(result.id)); toast('Event created.'); });
  await events();
}
Promise.resolve().then(()=>attendance()).catch(error=>{toast(error.message,true); console.error(error);});
