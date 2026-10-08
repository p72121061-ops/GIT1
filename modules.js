// ============================================================
// PHASE 3 MODULES — toggles + attendance
// Depends on: global `sb` (Supabase client, defined in app.js)
// ============================================================
(function(){
  const MODS = [
    {key:'attendance', label:'Attendance',      icon:'📋', desc:'Daily present/absent marking. Students see their attendance %.', built:true},
    {key:'timetable',  label:'Timetable',       icon:'🗓️', desc:'Class-wise weekly schedule. Students see their own class.',        built:true},
    {key:'results',    label:'Test Results',    icon:'📝', desc:'Tests and marks per student.',                                    built:true},
    {key:'materials',  label:'Study Materials', icon:'📚', desc:'Notes / video links for students.',                               built:false},
  ];

  window.MOD_FLAGS = window.MOD_FLAGS || {};
  const isOn = k => window.MOD_FLAGS[k] === true;
  let currentTab = null;

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const z = n => String(n).padStart(2,'0');
  const todayStr = () => { const d=new Date(); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); };
  const getStudents = () => { try{ return JSON.parse(localStorage.getItem('vt_fee_v3')||'[]'); }catch(e){ return []; } };

  // ── FLAGS — all built modules always ON ──
  async function loadFlags(){
    window.MOD_FLAGS = {};
    MODS.forEach(m => { if(m.built) window.MOD_FLAGS[m.key] = true; });
  }

  // ── TEACHER TABS ──
  function ensurePanel(){
    let p = document.getElementById('modPanel');
    if(!p){
      p = document.createElement('div');
      p.id = 'modPanel';
      p.style.cssText = [
        'display:none',
        'position:fixed',
        'top:0','left:0','right:0','bottom:0',
        'z-index:9999',
        'background:#FAF3E8',
        'overflow-y:auto',
        '-webkit-overflow-scrolling:touch',
        'padding:0',
      ].join(';');
      document.body.appendChild(p);
    }
    return p;
  }

  function ensureTabs(){
    const bar = document.querySelector('.fa-tabs');
    if(!bar) return;
    bar.querySelectorAll('.mod-tab').forEach(t => t.remove());
    const add = (name, label) => {
      const t = document.createElement('div');
      t.className = 'fa-tab mod-tab' + (currentTab===name ? ' active' : '');
      t.id = 'modTab_' + name;
      t.textContent = label;
      t.onclick = () => window.modSwitchTab(name);
      bar.appendChild(t);
    };
    MODS.forEach(m => { if(m.built) add(m.key, m.icon+' '+m.label); });
    // ⚙️ Modules tab intentionally hidden — controlled by admin only
  }

  window.modHideAll = function(){
    const p = document.getElementById('modPanel');
    if(p){ p.style.display = 'none'; p.scrollTop = 0; }
    document.querySelectorAll('.mod-tab').forEach(t => t.classList.remove('active'));
    currentTab = null;
  };

  window.modSwitchTab = function(name){
    ['faAllTab','faDefTab','faTopTab','faNoticeTab'].forEach(id => {
      const e = document.getElementById(id); if(e) e.style.display = 'none';
    });
    document.querySelectorAll('.fa-tab').forEach(t => t.classList.remove('active'));
    currentTab = name;
    const t = document.getElementById('modTab_'+name); if(t) t.classList.add('active');
    const p = ensurePanel(); p.style.display = '';
    if(name === 'attendance') renderAttendancePanel();
    if(name === 'timetable') renderTimetablePanel();
    if(name === 'results') renderResultsPanel();
  };

  // ── ATTENDANCE — TEACHER SIDE ──
  const att = { cls:'10', date: todayStr(), marks:{} };

  async function renderAttendancePanel(){
    const p = ensurePanel();
    p.innerHTML = `
      <div style="position:sticky;top:0;z-index:10;background:#FAF3E8;border-bottom:1px solid #E7DCC5;padding:14px 16px;display:flex;align-items:center;gap:12px;">
        <button onclick="window.modHideAll()" style="padding:7px 13px;border:1px solid #DDD2BC;border-radius:10px;background:#fff;color:#2A2318;font-size:13px;font-weight:700;cursor:pointer;">← Back</button>
        <span style="font-size:15px;font-weight:700;color:#2A2318;">📋 Attendance</span>
      </div>
      <div style="padding:16px;">
      <p style="font-size:11px;color:#7A6F5C;margin-bottom:14px;">Pick a date and class, mark absentees, then save. Everyone defaults to Present.</p>
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <input id="attDate" type="date" value="${att.date}" max="${todayStr()}" onchange="modAttChange()"
          style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid #DDD2BC;background:#F1E8D8;color:#2A2318;font-size:13px;font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;">
        <select id="attCls" onchange="modAttChange()"
          style="padding:10px 12px;border-radius:10px;border:1px solid #DDD2BC;background:#F1E8D8;color:#2A2318;font-size:13px;font-family:'Inter',sans-serif;outline:none;">
          ${['10','11','12'].map(c=>`<option value="${c}" ${att.cls===c?'selected':''}>Class ${c}</option>`).join('')}
        </select>
      </div>
      <div id="attSummary" style="font-size:12px;font-weight:600;color:#7A6F5C;margin-bottom:8px;"></div>
      <div id="attList"><p style="font-size:12px;color:#7A6F5C;padding:12px 0;">Loading…</p></div>
      <button id="attSaveBtn" onclick="modAttSave()" style="width:100%;margin-top:12px;padding:13px;border:none;border-radius:12px;background:#1D7A56;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">💾 Save Attendance</button>
      </div>
    `;
    await loadAttendance();
  }

  window.modAttChange = async function(){
    att.date = document.getElementById('attDate').value || todayStr();
    att.cls  = document.getElementById('attCls').value;
    await loadAttendance();
  };

  function classStudents(){
    return getStudents().filter(s => String(s.cls) === String(att.cls))
                        .sort((a,b) => String(a.name).localeCompare(String(b.name)));
  }

  async function loadAttendance(){
    const list = classStudents();
    att.marks = {};
    list.forEach(s => att.marks[s.id] = 'present');
    try{
      const { data, error } = await sb.from('attendance').select('student_id,status').eq('date', att.date);
      if(error) console.warn('Attendance load failed:', error.message);
      (data||[]).forEach(r => { if(att.marks[r.student_id] !== undefined) att.marks[r.student_id] = r.status; });
    }catch(e){ console.warn(e); }
    drawAttendanceList();
  }

  function drawAttendanceList(){
    const wrap = document.getElementById('attList');
    if(!wrap) return;
    const list = classStudents();
    if(!list.length){
      wrap.innerHTML = `<p style="font-size:12px;color:#7A6F5C;padding:12px 0;">No students in Class ${esc(att.cls)} yet.</p>`;
      document.getElementById('attSummary').textContent = '';
      return;
    }
    wrap.innerHTML = list.map(s => {
      const pres = att.marks[s.id] === 'present';
      return `
      <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E7DCC5;border-radius:12px;padding:10px 12px;margin-bottom:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#2A2318;">${esc(s.name)}</div>
          ${s.roll?`<div style="font-size:10px;color:#7A6F5C;">Roll ${esc(s.roll)}</div>`:''}
        </div>
        <button onclick="modAttMark(${s.id},'present')" style="padding:7px 14px;border-radius:8px;border:1px solid ${pres?'#1D7A56':'#DDD2BC'};background:${pres?'#1D7A56':'transparent'};color:${pres?'#fff':'#7A6F5C'};font-size:12px;font-weight:700;cursor:pointer;">P</button>
        <button onclick="modAttMark(${s.id},'absent')"  style="padding:7px 14px;border-radius:8px;border:1px solid ${!pres?'#B23B3B':'#DDD2BC'};background:${!pres?'#B23B3B':'transparent'};color:${!pres?'#fff':'#7A6F5C'};font-size:12px;font-weight:700;cursor:pointer;">A</button>
      </div>`;
    }).join('');
    const total = list.length;
    const absent = list.filter(s => att.marks[s.id] === 'absent').length;
    document.getElementById('attSummary').textContent = `Present: ${total-absent}  ·  Absent: ${absent}  ·  Total: ${total}`;
  }

  window.modAttMark = function(id, status){
    att.marks[id] = status;
    drawAttendanceList();
  };

  window.modAttSave = async function(){
    const list = classStudents();
    if(!list.length){ alert('No students to save.'); return; }
    const btn = document.getElementById('attSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    const rows = list.map(s => ({ student_id: s.id, date: att.date, status: att.marks[s.id] || 'present' }));
    const { error } = await sb.from('attendance').upsert(rows, { onConflict: 'student_id,date' });
    btn.disabled = false; btn.textContent = '💾 Save Attendance';
    if(error){
      alert('⚠️ Save failed: ' + error.message + '\n\n(Make sure phase3_schema.sql was run and you are logged in.)');
    } else {
      alert('✅ Attendance saved for ' + att.date);
    }
  };

  // ── ATTENDANCE — STUDENT SIDE ──
  async function renderStudentAttendance(studentId){
    try{
      const { data, error } = await sb.from('attendance').select('date,status')
        .eq('student_id', studentId).order('date', { ascending:false }).limit(400);
      if(error){ console.warn('Student attendance load failed:', error.message); return; }
      if(window._currentStudentId !== studentId) return;   // student switched/closed meanwhile
      const body = document.getElementById('spBody');
      if(!body) return;
      const rows = data || [];
      const total = rows.length;
      const present = rows.filter(r => r.status === 'present').length;
      const pct = total ? Math.round(present*100/total) : null;
      const col = pct===null ? '#7A6F5C' : pct>=75 ? '#1D7A56' : pct>=60 ? '#C9A227' : '#B23B3B';
      const recent = rows.slice(0, 10).map(r => {
        const d = new Date(r.date + 'T00:00:00');
        const lbl = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
        const ok = r.status === 'present';
        return `<div style="display:flex;justify-content:space-between;padding:8px 2px;border-bottom:1px solid #E7DCC5;font-size:13px;">
                  <span style="color:#2A2318;">${lbl}</span>
                  <span style="font-weight:700;color:${ok?'#1D7A56':'#B23B3B'};">${ok?'Present':'Absent'}</span>
                </div>`;
      }).join('');
      const pane = document.getElementById('spPane_attendance') || body;
      pane.innerHTML = `
        <div class="sp-stats" style="grid-template-columns:repeat(3,1fr);margin:14px 0 10px;">
          <div class="sp-stat"><div class="sp-stat-val" style="color:${col};">${pct===null?'—':pct+'%'}</div><div class="sp-stat-lbl">Attendance</div></div>
          <div class="sp-stat"><div class="sp-stat-val" style="color:#1D7A56;">${present}</div><div class="sp-stat-lbl">Present</div></div>
          <div class="sp-stat"><div class="sp-stat-val" style="color:#B23B3B;">${total-present}</div><div class="sp-stat-lbl">Absent</div></div>
        </div>
        ${total ? recent : '<p style="font-size:12px;color:#7A6F5C;">No attendance recorded yet.</p>'}
      `;
    }catch(e){ console.warn('Student attendance error:', e); }
  }

  // ── TIMETABLE (shared helpers) ──
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const tt = { cls:'10' };

  function fmt12(t){            // "17:00" -> "5:00 PM"
    if(!t) return '';
    const parts = t.split(':').map(Number);
    const h = parts[0], m = parts[1];
    return (((h+11)%12)+1) + ':' + z(m) + ' ' + (h>=12 ? 'PM' : 'AM');
  }
  function slotStart(slot){     // "5:00 PM - 6:00 PM" -> minutes since midnight
    const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(slot||'');
    if(!m) return 9999;
    let h = parseInt(m[1],10) % 12;
    if(m[3].toUpperCase() === 'PM') h += 12;
    return h*60 + parseInt(m[2],10);
  }
  const byTime = (a,b) => slotStart(a.time_slot) - slotStart(b.time_slot);

  // ── TIMETABLE — TEACHER SIDE ──
  async function renderTimetablePanel(){
    const p = ensurePanel();
    const inp = "padding:10px 12px;border-radius:10px;border:1px solid #DDD2BC;background:#F1E8D8;color:#2A2318;font-size:13px;font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;";
    p.innerHTML = `
      <div style="position:sticky;top:0;z-index:10;background:#FAF3E8;border-bottom:1px solid #E7DCC5;padding:14px 16px;display:flex;align-items:center;gap:12px;">
        <button onclick="window.modHideAll()" style="padding:7px 13px;border:1px solid #DDD2BC;border-radius:10px;background:#fff;color:#2A2318;font-size:13px;font-weight:700;cursor:pointer;">← Back</button>
        <span style="font-size:15px;font-weight:700;color:#2A2318;">🗓️ Timetable</span>
      </div>
      <div style="padding:16px;">
      <p style="font-size:11px;color:#7A6F5C;margin-bottom:14px;">Pick a class, add its weekly slots. Students see only their own class.</p>
      <select id="ttCls" onchange="modTtChange()" style="${inp}width:100%;margin-bottom:12px;">
        ${['10','11','12'].map(c=>`<option value="${c}" ${tt.cls===c?'selected':''}>Class ${c}</option>`).join('')}
      </select>
      <div style="background:#fff8ea;border:1px solid #E7DCC5;border-radius:14px;padding:12px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:#2A2318;margin-bottom:8px;">➕ Add a slot</div>
        <select id="ttDay" style="${inp}width:100%;margin-bottom:8px;">
          ${DAYS.map(d=>`<option value="${d}">${d}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <input id="ttStart" type="time" aria-label="Start time" style="${inp}flex:1;min-width:0;">
          <input id="ttEnd"   type="time" aria-label="End time"   style="${inp}flex:1;min-width:0;">
        </div>
        <input id="ttSubject" placeholder="Subject (e.g. Physics)" maxlength="40" style="${inp}width:100%;margin-bottom:8px;">
        <input id="ttTeacher" placeholder="Teacher name (optional)" maxlength="40" style="${inp}width:100%;margin-bottom:8px;">
        <button id="ttAddBtn" onclick="modTtAdd()" style="width:100%;padding:12px;border:none;border-radius:10px;background:#1D7A56;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">Add Slot</button>
      </div>
      <div id="ttList"></div>
      </div>
    `;
    await loadTimetable();
  }

  window.modTtChange = async function(){
    tt.cls = document.getElementById('ttCls').value;
    await loadTimetable();
  };

  async function loadTimetable(){
    const wrap = document.getElementById('ttList');
    if(!wrap) return;
    wrap.innerHTML = '<p style="font-size:12px;color:#7A6F5C;padding:8px 0;">Loading…</p>';
    const { data, error } = await sb.from('timetable').select('*').eq('cls', tt.cls);
    if(error){
      wrap.innerHTML = `<p style="font-size:12px;color:#B23B3B;padding:8px 0;">Load failed: ${esc(error.message)}<br>(Has phase3_schema.sql been run?)</p>`;
      return;
    }
    const rows = (data||[]).sort(byTime);
    if(!rows.length){
      wrap.innerHTML = `<p style="font-size:12px;color:#7A6F5C;padding:8px 0;">No slots for Class ${esc(tt.cls)} yet.</p>`;
      return;
    }
    wrap.innerHTML = DAYS.filter(d => rows.some(r => r.day_of_week === d)).map(d => `
      <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#B4872C;margin:14px 0 6px;">${d}</div>
      ${rows.filter(r => r.day_of_week === d).map(r => `
        <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E7DCC5;border-radius:12px;padding:10px 12px;margin-bottom:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#2A2318;">${esc(r.subject)}</div>
            <div style="font-size:11px;color:#7A6F5C;">${esc(r.time_slot)}${r.teacher_name ? ' · ' + esc(r.teacher_name) : ''}</div>
          </div>
          <button onclick="modTtDelete(${r.id})" aria-label="Delete slot" style="padding:6px 10px;border-radius:8px;border:1px solid #DDD2BC;background:transparent;color:#B23B3B;font-size:12px;font-weight:700;cursor:pointer;">✕</button>
        </div>`).join('')}
    `).join('');
  }

  window.modTtAdd = async function(){
    const day     = document.getElementById('ttDay').value;
    const start   = document.getElementById('ttStart').value;
    const end     = document.getElementById('ttEnd').value;
    const subject = document.getElementById('ttSubject').value.trim();
    const teacher = document.getElementById('ttTeacher').value.trim();
    if(!start || !end || !subject){ alert('Start time, end time aur subject zaroori hain.'); return; }
    if(end <= start){ alert('End time start time ke baad ka hona chahiye.'); return; }
    const btn = document.getElementById('ttAddBtn');
    btn.disabled = true; btn.textContent = 'Adding…';
    const { error } = await sb.from('timetable').insert({
      cls: tt.cls, day_of_week: day, time_slot: fmt12(start) + ' - ' + fmt12(end),
      subject, teacher_name: teacher || null
    });
    btn.disabled = false; btn.textContent = 'Add Slot';
    if(error){
      if(error.code === '23505') alert('Is class, din aur time pe pehle se ek slot hai.');
      else alert('⚠️ Save failed: ' + error.message + '\n\n(Make sure phase3_schema.sql was run and you are logged in.)');
      return;
    }
    document.getElementById('ttSubject').value = '';
    document.getElementById('ttTeacher').value = '';
    await loadTimetable();
  };

  window.modTtDelete = async function(id){
    if(!confirm('Delete this slot?')) return;
    const { error } = await sb.from('timetable').delete().eq('id', id);
    if(error){ alert('⚠️ Delete failed: ' + error.message); return; }
    await loadTimetable();
  };

  // ── TIMETABLE — STUDENT SIDE ──
  async function renderStudentTimetable(studentId){
    const s = getStudents().find(x => String(x.id) === String(studentId));
    if(!s) return;
    try{
      const { data, error } = await sb.from('timetable').select('*').eq('cls', String(s.cls));
      if(error){ console.warn('Student timetable load failed:', error.message); return; }
      if(String(window._currentStudentId) !== String(studentId)) return;
      const body = document.getElementById('spBody');
      if(!body) return;
      const rows = (data||[]).sort(byTime);
      const today = new Date().toLocaleDateString('en-US', { weekday:'long' });
      const days = DAYS.filter(d => rows.some(r => r.day_of_week === d));
      const pane = document.getElementById('spPane_timetable') || body;
      pane.innerHTML = `
        <div style="font-size:12px;color:#7A6F5C;margin:14px 0 8px;">Class ${esc(s.cls)} · Weekly Schedule</div>
        ${days.length ? days.map(d => `
          <div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${d===today?'#1D7A56':'#B4872C'};margin:12px 0 4px;">${d}${d===today?' · Today':''}</div>
          ${rows.filter(r => r.day_of_week === d).map(r => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:8px 2px;border-bottom:1px solid #E7DCC5;font-size:13px;">
              <span style="color:#2A2318;font-weight:600;">${esc(r.subject)}${r.teacher_name ? `<span style="color:#7A6F5C;font-weight:400;"> · ${esc(r.teacher_name)}</span>` : ''}</span>
              <span style="color:#7A6F5C;white-space:nowrap;">${esc(r.time_slot)}</span>
            </div>`).join('')}
        `).join('') : '<p style="font-size:12px;color:#7A6F5C;">No timetable set yet.</p>'}
      `;
    }catch(e){ console.warn('Student timetable error:', e); }
  }

  // ── TEST RESULTS — SHARED HELPERS ──
  const INP = "padding:10px 12px;border-radius:10px;border:1px solid #DDD2BC;background:#F1E8D8;color:#2A2318;font-size:13px;font-family:'Inter',sans-serif;outline:none;box-sizing:border-box;";
  const hdr = (title, onclick, label) => `
    <div style="position:sticky;top:0;z-index:10;background:#FAF3E8;border-bottom:1px solid #E7DCC5;padding:14px 16px;display:flex;align-items:center;gap:12px;">
      <button onclick="${onclick}" style="padding:7px 13px;border:1px solid #DDD2BC;border-radius:10px;background:#fff;color:#2A2318;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">${label}</button>
      <span style="font-size:15px;font-weight:700;color:#2A2318;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
    </div>`;
  const fmtN    = n => String(+Number(n).toFixed(2));
  const pctOf   = (m, t) => t ? Math.round(Number(m) * 100 / Number(t)) : 0;
  const pctCol  = p => p >= 75 ? '#1D7A56' : p >= 50 ? '#C9A227' : '#B23B3B';
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  // ── TEST RESULTS — TEACHER SIDE ──
  const res = { cls:'10', tests:[], stats:{}, open:null, existing:{} };

  function resStudents(cls){
    return getStudents().filter(s => String(s.cls) === String(cls))
                        .sort((a,b) => String(a.name).localeCompare(String(b.name)));
  }

  async function renderResultsPanel(){
    res.open = null;
    const p = ensurePanel();
    p.innerHTML = hdr('📝 Test Results', 'window.modHideAll()', '← Back') + `
      <div style="padding:16px;">
        <p style="font-size:11px;color:#7A6F5C;margin-bottom:14px;">Class chuno, naya test banao, phir marks daalo. Students apne marks apne panel mein dekhenge.</p>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <select id="resCls" onchange="modResCls()" style="${INP}">
            ${['10','11','12'].map(c => `<option value="${c}" ${res.cls===c?'selected':''}>Class ${c}</option>`).join('')}
          </select>
          <button onclick="modResToggleForm()" style="flex:1;padding:10px;border:none;border-radius:10px;background:#1D7A56;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">＋ New Test</button>
        </div>
        <div id="resForm" style="display:none;background:#fff;border:1px solid #E7DCC5;border-radius:12px;padding:12px;margin-bottom:12px;">
          <input id="resTitle" type="text" placeholder="Test name (e.g. Unit Test 1)" maxlength="60" style="${INP}width:100%;margin-bottom:8px;">
          <input id="resSubject" type="text" placeholder="Subject (e.g. Maths)" maxlength="40" style="${INP}width:100%;margin-bottom:8px;">
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input id="resTotal" type="number" inputmode="decimal" min="1" placeholder="Total marks" style="${INP}flex:1;min-width:0;">
            <input id="resDate" type="date" value="${todayStr()}" style="${INP}flex:1;min-width:0;">
          </div>
          <button id="resCreateBtn" onclick="modResCreate()" style="width:100%;padding:11px;border:none;border-radius:10px;background:#1D7A56;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">Create Test</button>
        </div>
        <div id="resList"><p style="font-size:12px;color:#7A6F5C;padding:12px 0;">Loading…</p></div>
      </div>`;
    await loadTests();
  }

  window.modResToggleForm = function(){
    const f = document.getElementById('resForm');
    if(f) f.style.display = f.style.display === 'none' ? '' : 'none';
  };

  window.modResCls = async function(){
    res.cls = document.getElementById('resCls').value;
    await loadTests();
  };

  async function loadTests(){
    const list = document.getElementById('resList');
    if(!list) return;
    const { data: tests, error } = await sb.from('tests').select('*').eq('cls', res.cls)
      .order('test_date', { ascending:false }).order('id', { ascending:false });
    if(error){
      list.innerHTML = `<p style="font-size:12px;color:#B23B3B;">⚠️ Load failed: ${esc(error.message)}</p>`;
      return;
    }
    res.tests = tests || [];
    res.stats = {};
    if(res.tests.length){
      const { data: rs } = await sb.from('results').select('test_id,marks_obtained').in('test_id', res.tests.map(t => t.id));
      (rs || []).forEach(r => {
        const st = res.stats[r.test_id] || (res.stats[r.test_id] = { n:0, sum:0 });
        st.n++; st.sum += Number(r.marks_obtained);
      });
    }
    drawTests();
  }

  function drawTests(){
    const list = document.getElementById('resList');
    if(!list) return;
    if(!res.tests.length){
      list.innerHTML = `<p style="font-size:12px;color:#7A6F5C;padding:12px 0;">Class ${esc(res.cls)} ka abhi koi test nahi hai. "＋ New Test" dabao.</p>`;
      return;
    }
    const classCount = resStudents(res.cls).length;
    list.innerHTML = res.tests.map(t => {
      const st = res.stats[t.id];
      const avg = st && st.n ? Math.round(st.sum / st.n * 100 / t.total_marks) : null;
      return `
      <div onclick="modResOpen(${t.id})" style="background:#fff;border:1px solid #E7DCC5;border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div style="font-size:14px;font-weight:700;color:#2A2318;">${esc(t.title)}</div>
          <div style="font-size:12px;font-weight:700;color:#7A6F5C;white-space:nowrap;">${fmtN(t.total_marks)} marks</div>
        </div>
        <div style="font-size:11px;color:#7A6F5C;margin-top:3px;">${esc(t.subject)} · ${fmtDate(t.test_date)}</div>
        <div style="font-size:12px;font-weight:600;margin-top:6px;color:${st ? pctCol(avg) : '#7A6F5C'};">
          ${st ? `${st.n}/${classCount} marked · Avg ${avg}%` : 'Marks abhi nahi daale'}
        </div>
      </div>`;
    }).join('');
  }

  window.modResCreate = async function(){
    const title   = document.getElementById('resTitle').value.trim();
    const subject = document.getElementById('resSubject').value.trim();
    const total   = Number(document.getElementById('resTotal').value);
    const date    = document.getElementById('resDate').value;
    if(!title || !subject){ alert('Test name aur subject zaroori hain.'); return; }
    if(!isFinite(total) || total <= 0){ alert('Total marks 0 se zyada hone chahiye.'); return; }
    if(!date){ alert('Date chuno.'); return; }
    const btn = document.getElementById('resCreateBtn');
    btn.disabled = true; btn.textContent = 'Creating…';
    const { data, error } = await sb.from('tests')
      .insert({ title, subject, cls: res.cls, total_marks: total, test_date: date })
      .select().single();
    btn.disabled = false; btn.textContent = 'Create Test';
    if(error){
      alert('⚠️ Save failed: ' + error.message + '\n\n(SQL run hui hai aur teacher login hai? Check karo.)');
      return;
    }
    await loadTests();
    await window.modResOpen(data.id);   // seedha marks entry khol do
  };

  window.modResOpen = async function(id){
    const t = res.tests.find(x => String(x.id) === String(id));
    if(!t) return;
    res.open = t;
    res.existing = {};
    const p = ensurePanel();
    p.scrollTop = 0;
    p.innerHTML = hdr(esc(t.title), 'modResBack()', '← Tests') + `<div style="padding:16px;"><p style="font-size:12px;color:#7A6F5C;">Loading…</p></div>`;
    const { data, error } = await sb.from('results').select('student_id,marks_obtained').eq('test_id', t.id);
    if(error){ alert('⚠️ Load failed: ' + error.message); return; }
    (data || []).forEach(r => { res.existing[r.student_id] = r.marks_obtained; });
    const list = resStudents(t.cls);
    p.innerHTML = hdr(esc(t.title), 'modResBack()', '← Tests') + `
      <div style="padding:16px;">
        <div style="font-size:12px;color:#7A6F5C;margin-bottom:12px;">${esc(t.subject)} · Class ${esc(t.cls)} · ${fmtDate(t.test_date)} · Total <b>${fmtN(t.total_marks)}</b></div>
        ${list.length ? list.map(s => {
          const v = res.existing[s.id];
          return `
          <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E7DCC5;border-radius:12px;padding:10px 12px;margin-bottom:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#2A2318;">${esc(s.name)}</div>
              ${s.roll ? `<div style="font-size:10px;color:#7A6F5C;">Roll ${esc(s.roll)}</div>` : ''}
            </div>
            <input id="resM_${s.id}" type="number" inputmode="decimal" min="0" max="${t.total_marks}" step="any"
              value="${v == null ? '' : fmtN(v)}" placeholder="—"
              style="${INP}width:78px;text-align:center;font-weight:700;">
            <span style="font-size:12px;color:#7A6F5C;white-space:nowrap;">/ ${fmtN(t.total_marks)}</span>
          </div>`;
        }).join('') : `<p style="font-size:12px;color:#7A6F5C;">Class ${esc(t.cls)} mein abhi koi student nahi hai.</p>`}
        ${list.length ? `<button id="resSaveBtn" onclick="modResSave()" style="width:100%;margin-top:6px;padding:13px;border:none;border-radius:12px;background:#1D7A56;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">💾 Save Marks</button>` : ''}
        <button onclick="modResDelete()" style="width:100%;margin-top:10px;padding:11px;border:1px solid #DDD2BC;border-radius:12px;background:transparent;color:#B23B3B;font-size:13px;font-weight:700;cursor:pointer;">🗑️ Delete this test</button>
      </div>`;
  };

  window.modResBack = function(){ renderResultsPanel(); };

  window.modResSave = async function(){
    const t = res.open;
    if(!t) return;
    const list = resStudents(t.cls);
    const rows = [], clear = [], bad = [];
    list.forEach(s => {
      const el = document.getElementById('resM_' + s.id);
      const v = el ? el.value.trim() : '';
      if(v === ''){ if(res.existing[s.id] !== undefined) clear.push(s.id); return; }
      const n = Number(v);
      if(!isFinite(n) || n < 0 || n > Number(t.total_marks)){ bad.push(s.name); return; }
      rows.push({ test_id: t.id, student_id: s.id, marks_obtained: n });
    });
    if(bad.length){
      alert('Ye marks galat hain (0 se ' + fmtN(t.total_marks) + ' ke beech hone chahiye):\n\n' + bad.join('\n'));
      return;
    }
    const btn = document.getElementById('resSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    let err = null;
    if(rows.length){
      const r1 = await sb.from('results').upsert(rows, { onConflict: 'test_id,student_id' });
      err = r1.error;
    }
    if(!err && clear.length){
      const r2 = await sb.from('results').delete().eq('test_id', t.id).in('student_id', clear);
      err = r2.error;
    }
    btn.disabled = false; btn.textContent = '💾 Save Marks';
    if(err){ alert('⚠️ Save failed: ' + err.message); return; }
    res.existing = {};
    rows.forEach(r => { res.existing[r.student_id] = r.marks_obtained; });
    alert('✅ Marks saved (' + rows.length + ' students)');
  };

  window.modResDelete = async function(){
    const t = res.open;
    if(!t) return;
    if(!confirm('"' + t.title + '" aur uske saare marks delete ho jayenge. Pakka?')) return;
    const { error } = await sb.from('tests').delete().eq('id', t.id);
    if(error){ alert('⚠️ Delete failed: ' + error.message); return; }
    renderResultsPanel();
  };

  // ── TEST RESULTS — STUDENT SIDE ──
  async function renderStudentResults(studentId, stu){
    const s = stu || window._currentStudentData;
    const pane = document.getElementById('spPane_results');
    if(!s || !pane) return;
    try{
      const { data, error } = await sb.rpc('get_student_results', { p_student_id: s.id, p_code: String(s.code) });
      if(String(window._currentStudentId) !== String(studentId)) return;
      if(error){
        console.warn('Student results load failed:', error.message);
        pane.innerHTML = '<p style="font-size:12px;color:#7A6F5C;margin-top:14px;">Results abhi load nahi ho paaye. Thodi der baad try karo.</p>';
        return;
      }
      const rows = data || [];
      if(!rows.length){
        pane.innerHTML = '<p style="font-size:12px;color:#7A6F5C;margin-top:14px;">Abhi koi test result nahi aaya.</p>';
        return;
      }
      const pcts = rows.map(r => pctOf(r.marks_obtained, r.total_marks));
      const avg  = Math.round(pcts.reduce((a,b) => a + b, 0) / pcts.length);
      const best = Math.max(...pcts);
      pane.innerHTML = `
        <div class="sp-stats" style="grid-template-columns:repeat(3,1fr);margin:14px 0 10px;">
          <div class="sp-stat"><div class="sp-stat-val" style="color:#24449E;">${rows.length}</div><div class="sp-stat-lbl">Tests</div></div>
          <div class="sp-stat"><div class="sp-stat-val" style="color:${pctCol(avg)};">${avg}%</div><div class="sp-stat-lbl">Average</div></div>
          <div class="sp-stat"><div class="sp-stat-val" style="color:#1D7A56;">${best}%</div><div class="sp-stat-lbl">Best</div></div>
        </div>
        ${rows.map((r, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid #E7DCC5;">
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#2A2318;">${esc(r.title)}</div>
              <div style="font-size:11px;color:#7A6F5C;">${esc(r.subject)} · ${fmtDate(r.test_date)}</div>
            </div>
            <div style="text-align:right;white-space:nowrap;">
              <div style="font-size:14px;font-weight:700;color:${pctCol(pcts[i])};">${fmtN(r.marks_obtained)}/${fmtN(r.total_marks)}</div>
              <div style="font-size:11px;color:${pctCol(pcts[i])};">${pcts[i]}%</div>
            </div>
          </div>`).join('')}
      `;
    }catch(e){ console.warn('Student results error:', e); }
  }

  // ── STUDENT PANEL TABS ──
  const SP_TABS = [
    { key:'attendance', label:'📋 Attendance' },
    { key:'timetable',  label:'🗓️ Timetable' },
    { key:'results',    label:'📝 Results' },
  ];

  function ensureStudentTabs(){
    const body = document.getElementById('spBody');
    if(!body) return;
    if(document.getElementById('spTabBar')) return;   // already injected

    const bar = document.createElement('div');
    bar.id = 'spTabBar';
    bar.style.cssText = 'display:flex;gap:4px;margin:18px 0 4px;border-bottom:1px solid #E7DCC5;';
    bar.innerHTML = SP_TABS.map((t, i) => `
      <button id="spTab_${t.key}" onclick="spSwitchTab('${t.key}')"
        style="flex:1;padding:10px 2px;border:none;background:none;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:'Inter',sans-serif;border-bottom:2px solid ${i===0?'#1D7A56':'transparent'};color:${i===0?'#1D7A56':'#7A6F5C'};">
        ${t.label}
      </button>`).join('');
    body.appendChild(bar);

    SP_TABS.forEach((t, i) => {
      const pane = document.createElement('div');
      pane.id = 'spPane_' + t.key;
      if(i !== 0) pane.style.display = 'none';
      body.appendChild(pane);
    });
  }

  window.spSwitchTab = function(tab){
    SP_TABS.forEach(t => {
      const btn  = document.getElementById('spTab_' + t.key);
      const pane = document.getElementById('spPane_' + t.key);
      const active = t.key === tab;
      if(btn){
        btn.style.borderBottom = active ? '2px solid #1D7A56' : '2px solid transparent';
        btn.style.color = active ? '#1D7A56' : '#7A6F5C';
      }
      if(pane) pane.style.display = active ? '' : 'none';
    });
  };

  // ── STUDENT DASHBOARD HOOK ──
  window.modOnStudentDashboard = async function(studentId, stu){
    await loadFlags();
    ensureStudentTabs();
    await Promise.all([
      renderStudentAttendance(studentId),
      renderStudentTimetable(studentId),
      renderStudentResults(studentId, stu),
    ]);
  };

  // ── INIT ──
  ensureTabs();
  loadFlags().then(ensureTabs);
})();
