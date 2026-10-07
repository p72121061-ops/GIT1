// ============================================================
// PHASE 3 MODULES — toggles + attendance
// Depends on: global `sb` (Supabase client, defined in app.js)
// ============================================================
(function(){
  const MODS = [
    {key:'attendance', label:'Attendance',      icon:'📋', desc:'Daily present/absent marking. Students see their attendance %.', built:true},
    {key:'timetable',  label:'Timetable',       icon:'🗓️', desc:'Class-wise weekly schedule. Students see their own class.',        built:true},
    {key:'results',    label:'Test Results',    icon:'📝', desc:'Tests and marks per student.',                                    built:false},
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

  // ── STUDENT PANEL TABS ──
  let spActiveTab = 'attendance';

  function ensureStudentTabs(){
    const body = document.getElementById('spBody');
    if(!body) return;

    // Tab bar already inject kiya hua hai toh dobara mat karo
    if(document.getElementById('spTabBar')) return;

    const tabBar = document.createElement('div');
    tabBar.id = 'spTabBar';
    tabBar.style.cssText = 'display:flex;gap:8px;margin:18px 0 4px;border-bottom:1px solid #E7DCC5;padding-bottom:0;';
    tabBar.innerHTML = `
      <button id="spTab_attendance" onclick="spSwitchTab('attendance')"
        style="flex:1;padding:10px 0;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;border-bottom:2px solid #1D7A56;color:#1D7A56;font-family:'Inter',sans-serif;">
        📋 Attendance
      </button>
      <button id="spTab_timetable" onclick="spSwitchTab('timetable')"
        style="flex:1;padding:10px 0;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;border-bottom:2px solid transparent;color:#7A6F5C;font-family:'Inter',sans-serif;">
        🗓️ Timetable
      </button>
    `;

    const attPane  = document.createElement('div'); attPane.id  = 'spPane_attendance';
    const ttPane   = document.createElement('div'); ttPane.id   = 'spPane_timetable'; ttPane.style.display = 'none';

    body.appendChild(tabBar);
    body.appendChild(attPane);
    body.appendChild(ttPane);
  }

  window.spSwitchTab = function(tab){
    spActiveTab = tab;
    ['attendance','timetable'].forEach(t => {
      const btn  = document.getElementById('spTab_' + t);
      const pane = document.getElementById('spPane_' + t);
      const active = t === tab;
      if(btn){
        btn.style.borderBottom = active ? '2px solid #1D7A56' : '2px solid transparent';
        btn.style.color = active ? '#1D7A56' : '#7A6F5C';
      }
      if(pane) pane.style.display = active ? '' : 'none';
    });
  };

  // ── STUDENT DASHBOARD HOOK ──
  window.modOnStudentDashboard = async function(studentId){
    await loadFlags();
    ensureStudentTabs();
    // Dono panes mein content inject karo
    await renderStudentAttendance(studentId);
    await renderStudentTimetable(studentId);
  };

  // ── INIT ──
  ensureTabs();
  loadFlags().then(ensureTabs);
})();
