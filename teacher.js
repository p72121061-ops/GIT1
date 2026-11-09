// ============================================================
// TEACHER PANEL (Step 4) — sirf role === 'teacher' ke liye
// Depends on: global `sb`, window.vtFlags (app.js)
// Font: Outfit — sirf is panel (#tpPage) ke andar, main page pe nahi.
// ============================================================
(function(){
  const FEE = {'10':2000,'11':2500,'12':3000};
  const CAL_TO_AC = {0:9,1:10,2:11,3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,11:8};
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const SUBJECTS = ['Maths','Science','English','Hindi','Social Science','Physics','Chemistry','Biology','Accountancy','Business Studies','Economics','Computer'];
  const TABS = [
    { k:'students',   l:'👥 Students' },
    { k:'attendance', l:'📋 Attendance', f:'attendance' },
    { k:'timetable',  l:'🗓️ Timetable',  f:'timetable' },
    { k:'results',    l:'📝 Results',    f:'results' },
    { k:'materials',  l:'📚 Material',   f:'materials' },
    { k:'notices',    l:'📢 Notices' },
  ];

  const T = { staff:null, classes:[], cls:'', tab:'students', students:[], loaded:false,
              att:{ date:'', marks:{} }, res:{ tests:[], stats:{}, open:null, existing:{} }, mat:[] };

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const z = n => String(n).padStart(2,'0');
  const todayStr = () => { const d=new Date(); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); };
  const fmtN = n => String(+Number(n).toFixed(2));
  const fmtDate = d => new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  const pctOf = (m,t) => t ? Math.round(Number(m)*100/Number(t)) : 0;
  const pctCol = p => p>=75 ? '#1D7A56' : p>=50 ? '#C9A227' : '#B23B3B';
  const on = f => !(window.vtFlags && window.vtFlags[f] === false);
  const $ = id => document.getElementById(id);
  const fmt12 = t => { if(!t) return ''; const [h,m]=t.split(':').map(Number); return (((h+11)%12)+1)+':'+z(m)+' '+(h>=12?'PM':'AM'); };
  const slotStart = s => { const m=/(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(s||''); if(!m) return 9999; let h=parseInt(m[1],10)%12; if(m[3].toUpperCase()==='PM') h+=12; return h*60+parseInt(m[2],10); };

  // ── FONT + CSS (sirf #tpPage) ──
  function injectAssets(){
    if($('tpStyle')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
    const s = document.createElement('style');
    s.id = 'tpStyle';
    s.textContent = `
#tpPage{display:none;position:fixed;inset:0;z-index:998;background:var(--page);color:var(--ink);font-family:'Outfit',sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch}
#tpPage *{font-family:inherit;box-sizing:border-box}
#tpPage .tp-top{position:sticky;top:0;z-index:5;background:var(--sheet);border-bottom:1px solid var(--line)}
#tpPage .tp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px}
#tpPage .tp-title{font-size:16px;font-weight:700}
#tpPage .tp-sub{font-size:11px;color:var(--ash);margin-top:1px}
#tpPage .tp-tabs{display:flex;gap:2px;overflow-x:auto;padding:0 8px}
#tpPage .tp-tab{flex:0 0 auto;padding:10px 12px;border:none;background:none;font-size:13px;font-weight:600;color:var(--ash);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
#tpPage .tp-tab.on{color:#1D7A56;border-bottom-color:#1D7A56}
#tpPage .tp-body{padding:16px;max-width:720px;margin:0 auto}
#tpPage .tp-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}
#tpPage .tp-in{padding:10px 12px;border-radius:10px;border:1px solid var(--stone);background:var(--page);color:var(--ink);font-size:14px;outline:none;width:100%;margin-bottom:8px}
#tpPage .tp-row{display:flex;gap:8px}
#tpPage .tp-row>*{min-width:0}
#tpPage .tp-btn{padding:8px 14px;border-radius:10px;border:1px solid var(--stone);background:var(--ivory2);color:var(--ink);font-size:13px;font-weight:600;cursor:pointer}
#tpPage .tp-pri{width:100%;padding:12px;border:none;border-radius:10px;background:#1D7A56;color:#fff;font-size:14px;font-weight:700;cursor:pointer}
#tpPage .tp-pri:disabled{opacity:.6}
#tpPage .tp-del{padding:6px 10px;border-radius:8px;border:1px solid var(--stone);background:transparent;color:#B23B3B;font-size:12px;font-weight:700;cursor:pointer}
#tpPage .tp-chips{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto}
#tpPage .tp-chip{flex:0 0 auto;padding:6px 14px;border-radius:999px;border:1px solid var(--stone);background:#fff;color:var(--ink);font-size:13px;font-weight:600;cursor:pointer}
#tpPage .tp-chip.on{background:#1D7A56;border-color:#1D7A56;color:#fff}
#tpPage .tp-muted{font-size:12px;color:var(--ash);padding:8px 0}
#tpPage .tp-err{font-size:12px;color:#B23B3B;padding:8px 0}
#tpPage .tp-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--g);margin:14px 0 6px}
#tpPage .tp-pa{padding:7px 14px;border-radius:8px;border:1px solid var(--stone);background:transparent;color:var(--ash);font-size:13px;font-weight:700;cursor:pointer}
#tpToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2000;background:#2A2318;color:#fff;padding:10px 18px;border-radius:999px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;display:none;max-width:90%;text-align:center}`;
    document.head.appendChild(s);
  }

  let toastT;
  function toast(m){
    let t = $('tpToast');
    if(!t){ t = document.createElement('div'); t.id = 'tpToast'; document.body.appendChild(t); }
    t.textContent = m; t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(()=>{ t.style.display = 'none'; }, 2600);
  }

  // ── OPEN / CLOSE ──
  function ensureRoot(){
    let p = $('tpPage');
    if(!p){ p = document.createElement('div'); p.id = 'tpPage'; document.body.appendChild(p); }
    return p;
  }

  async function open(staff){
    injectAssets();
    T.staff = staff;
    window.vtStaff = staff;
    T.classes = (staff.classes || []).map(String);
    T.cls = T.classes[0] || '';
    T.tab = 'students';
    T.att = { date: todayStr(), marks:{} };
    T.res = { tests:[], stats:{}, open:null, existing:{} };
    T.loaded = false;
    ensureRoot().style.display = 'block';
    document.body.style.overflow = 'hidden';
    shell();
    await new Promise(r => requestAnimationFrame(r));
    await loadStudents();
    draw();
  }

  function logout(){
    sessionStorage.removeItem('vt_teacher_active');
    window.vtStaff = null;
    sb.auth.signOut();
    const p = $('tpPage'); if(p) p.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── SHELL (header + tabs + class chips) ──
  function visibleTabs(){ return TABS.filter(t => !t.f || on(t.f)); }

  function shell(){
    const tabs = visibleTabs();
    if(!tabs.some(t => t.k === T.tab)) T.tab = tabs[0].k;
    $('tpPage').innerHTML = `
      <div class="tp-top">
        <div class="tp-head">
          <div style="min-width:0;">
            <div class="tp-title">👩‍🏫 Teacher Panel</div>
            <div class="tp-sub">${esc(T.staff.name)} · ${T.classes.length ? 'Class ' + T.classes.map(esc).join(', ') : 'No class'}</div>
          </div>
          <button class="tp-btn" onclick="tp.logout()">Logout</button>
        </div>
        <div class="tp-tabs">${tabs.map(t => `<button class="tp-tab ${t.k===T.tab?'on':''}" onclick="tp.tab('${t.k}')">${t.l}</button>`).join('')}</div>
      </div>
      <div class="tp-body" id="tpBody"></div>`;
  }

  function chips(){
    if(T.classes.length < 2) return '';
    return `<div class="tp-chips">${T.classes.map(c => `<button class="tp-chip ${c===T.cls?'on':''}" onclick="tp.cls('${esc(c)}')">Class ${esc(c)}</button>`).join('')}</div>`;
  }

  function draw(){
    const b = $('tpBody'); if(!b) return;
    if(!T.classes.length){
      b.innerHTML = '<p class="tp-muted">Aapko abhi koi class allot nahi hui hai. Admin se baat karo.</p>';
      return;
    }
    if(T.tab === 'notices'){ drawNotices(); return; }
    b.innerHTML = chips() + '<div id="tpMain"></div>';
    ({ students:drawStudents, attendance:drawAttendance, timetable:drawTimetable, results:drawResults, materials:drawMaterials })[T.tab]();
  }

  const tpTab = k => { T.tab = k; T.res.open = null; shell(); requestAnimationFrame(draw); };
  const tpCls = c => { T.cls = c; T.res.open = null; requestAnimationFrame(draw); };
  const main = () => $('tpMain');
  const clsStudents = () => T.students.filter(s => String(s.cls) === T.cls);

  // ── STUDENTS (read-only) ──
  async function loadStudents(){
    const { data, error } = await sb.from('students').select('id,name,cls,roll,fees').in('cls', T.classes).order('name');
    if(error){ T.loadErr = error.message; T.students = []; } else { T.loadErr = null; T.students = data || []; }
    T.loaded = true;
  }

  function drawStudents(){
    const list = clsStudents();
    if(T.loadErr){ main().innerHTML = `<p class="tp-err">⚠️ Load failed: ${esc(T.loadErr)}</p>`; return; }
    const showFees = on('fees');
    const cur = CAL_TO_AC[new Date().getMonth()];
    main().innerHTML = `<div class="tp-muted">${list.length} students · Class ${esc(T.cls)}</div>` + (list.length ? list.map(s => {
      const f = (s.fees && typeof s.fees === 'object') ? s.fees : {};
      let unpaid = 0; for(let i=0;i<=cur;i++) if(!f[i]) unpaid++;
      const paid = Object.values(f).filter(Boolean).length;
      const due = unpaid * (FEE[s.cls] || 0);
      return `<div class="tp-card" style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;">${esc(s.name)}</div>
          <div style="font-size:11px;color:var(--ash);">${s.roll ? 'Roll ' + esc(s.roll) : ''}</div>
        </div>
        ${showFees ? `<div style="text-align:right;">
          <div style="font-size:12px;font-weight:700;color:${due ? '#B23B3B' : '#1D7A56'};">${due ? 'Due ₹' + due.toLocaleString('en-IN') : 'Clear ✓'}</div>
          <div style="font-size:11px;color:var(--ash);">${paid}/12 paid</div>
        </div>` : ''}
      </div>`;
    }).join('') : '<p class="tp-muted">Is class mein abhi koi student nahi hai.</p>');
  }

  // ── ATTENDANCE ──
  async function drawAttendance(){
    main().innerHTML = `
      <input id="tpAttDate" class="tp-in" type="date" value="${T.att.date}" max="${todayStr()}" onchange="tp.attDate()">
      <div id="tpAttSum" class="tp-muted"></div>
      <div id="tpAttList"><p class="tp-muted">Loading…</p></div>
      <button id="tpAttSave" class="tp-pri" onclick="tp.attSave()" style="margin-top:6px;">💾 Save Attendance</button>`;
    await loadAtt();
  }

  async function loadAtt(){
    const list = clsStudents();
    T.att.marks = {};
    list.forEach(s => { T.att.marks[s.id] = 'present'; });
    if(list.length){
      const { data, error } = await sb.from('attendance').select('student_id,status').eq('date', T.att.date).in('student_id', list.map(s => s.id));
      if(error) toast('⚠️ ' + error.message);
      (data || []).forEach(r => { T.att.marks[r.student_id] = r.status; });
    }
    drawAttList();
  }

  function drawAttList(){
    const w = $('tpAttList'); if(!w) return;
    const list = clsStudents();
    if(!list.length){ w.innerHTML = '<p class="tp-muted">Is class mein koi student nahi hai.</p>'; $('tpAttSum').textContent = ''; return; }
    w.innerHTML = list.map(s => {
      const p = T.att.marks[s.id] === 'present';
      return `<div class="tp-card" style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;">${esc(s.name)}</div>${s.roll ? `<div style="font-size:10px;color:var(--ash);">Roll ${esc(s.roll)}</div>` : ''}</div>
        <button class="tp-pa" onclick="tp.attMark(${s.id},'present')" style="${p ? 'background:#1D7A56;border-color:#1D7A56;color:#fff;' : ''}">P</button>
        <button class="tp-pa" onclick="tp.attMark(${s.id},'absent')" style="${!p ? 'background:#B23B3B;border-color:#B23B3B;color:#fff;' : ''}">A</button>
      </div>`;
    }).join('');
    const ab = list.filter(s => T.att.marks[s.id] === 'absent').length;
    $('tpAttSum').textContent = `Present: ${list.length-ab} · Absent: ${ab} · Total: ${list.length}`;
  }

  async function attSave(){
    const list = clsStudents();
    if(!list.length) return;
    const btn = $('tpAttSave'); btn.disabled = true; btn.textContent = 'Saving…';
    const { error } = await sb.from('attendance').upsert(list.map(s => ({ student_id:s.id, date:T.att.date, status:T.att.marks[s.id] || 'present' })), { onConflict:'student_id,date' });
    btn.disabled = false; btn.textContent = '💾 Save Attendance';
    toast(error ? '⚠️ ' + error.message : '✅ Attendance saved — ' + fmtDate(T.att.date));
  }

  // ── TIMETABLE ──
  async function drawTimetable(){
    main().innerHTML = `
      <div class="tp-card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;">➕ Add a slot</div>
        <select id="tpTtDay" class="tp-in">${DAYS.map(d => `<option>${d}</option>`).join('')}</select>
        <div class="tp-row"><input id="tpTtS" class="tp-in" type="time" aria-label="Start"><input id="tpTtE" class="tp-in" type="time" aria-label="End"></div>
        <input id="tpTtSub" class="tp-in" placeholder="Subject (e.g. Physics)" maxlength="40">
        <input id="tpTtTch" class="tp-in" placeholder="Teacher name (optional)" maxlength="40" value="${esc(T.staff.name)}">
        <button id="tpTtBtn" class="tp-pri" onclick="tp.ttAdd()">Add Slot</button>
      </div>
      <div id="tpTtList"><p class="tp-muted">Loading…</p></div>`;
    await loadTt();
  }

  async function loadTt(){
    const w = $('tpTtList'); if(!w) return;
    const { data, error } = await sb.from('timetable').select('*').eq('cls', T.cls);
    if(error){ w.innerHTML = `<p class="tp-err">Load failed: ${esc(error.message)}</p>`; return; }
    const rows = (data || []).sort((a,b) => slotStart(a.time_slot) - slotStart(b.time_slot));
    if(!rows.length){ w.innerHTML = `<p class="tp-muted">Class ${esc(T.cls)} ka abhi koi slot nahi hai.</p>`; return; }
    w.innerHTML = DAYS.filter(d => rows.some(r => r.day_of_week === d)).map(d => `
      <div class="tp-h">${d}</div>
      ${rows.filter(r => r.day_of_week === d).map(r => `
        <div class="tp-card" style="display:flex;align-items:center;gap:10px;">
          <div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;">${esc(r.subject)}</div>
          <div style="font-size:11px;color:var(--ash);">${esc(r.time_slot)}${r.teacher_name ? ' · ' + esc(r.teacher_name) : ''}</div></div>
          <button class="tp-del" onclick="tp.ttDel(${r.id})" aria-label="Delete slot">✕</button>
        </div>`).join('')}`).join('');
  }

  async function ttAdd(){
    const day = $('tpTtDay').value, st = $('tpTtS').value, en = $('tpTtE').value;
    const subject = $('tpTtSub').value.trim(), teacher = $('tpTtTch').value.trim();
    if(!st || !en || !subject){ toast('Start, end time aur subject zaroori hain.'); return; }
    if(en <= st){ toast('End time start ke baad ka hona chahiye.'); return; }
    const btn = $('tpTtBtn'); btn.disabled = true; btn.textContent = 'Adding…';
    const { error } = await sb.from('timetable').insert({ cls:T.cls, day_of_week:day, time_slot:fmt12(st)+' - '+fmt12(en), subject, teacher_name:teacher || null });
    btn.disabled = false; btn.textContent = 'Add Slot';
    if(error){ toast(error.code === '23505' ? 'Is din aur time pe pehle se slot hai.' : '⚠️ ' + error.message); return; }
    $('tpTtSub').value = '';
    await loadTt();
  }

  async function ttDel(id){
    if(!confirm('Ye slot delete karun?')) return;
    const { error } = await sb.from('timetable').delete().eq('id', id).eq('cls', T.cls);
    if(error){ toast('⚠️ ' + error.message); return; }
    await loadTt();
  }

  // ── RESULTS ──
  async function drawResults(){
    if(T.res.open){ return openTest(T.res.open.id); }
    main().innerHTML = `
      <button class="tp-pri" onclick="tp.resForm()" style="margin-bottom:10px;">＋ New Test</button>
      <div id="tpResForm" class="tp-card" style="display:none;">
        <input id="tpRT" class="tp-in" placeholder="Test name (e.g. Unit Test 1)" maxlength="60">
        <input id="tpRS" class="tp-in" placeholder="Subject (e.g. Maths)" maxlength="40">
        <div class="tp-row"><input id="tpRM" class="tp-in" type="number" inputmode="decimal" min="1" placeholder="Total marks"><input id="tpRD" class="tp-in" type="date" value="${todayStr()}"></div>
        <button id="tpRBtn" class="tp-pri" onclick="tp.resCreate()">Create Test</button>
      </div>
      <div id="tpResList"><p class="tp-muted">Loading…</p></div>`;
    await loadTests();
  }

  async function loadTests(){
    const w = $('tpResList'); if(!w) return;
    const { data, error } = await sb.from('tests').select('*').eq('cls', T.cls).order('test_date', { ascending:false }).order('id', { ascending:false });
    if(error){ w.innerHTML = `<p class="tp-err">Load failed: ${esc(error.message)}</p>`; return; }
    T.res.tests = data || []; T.res.stats = {};
    if(T.res.tests.length){
      const { data: rs } = await sb.from('results').select('test_id,marks_obtained').in('test_id', T.res.tests.map(t => t.id));
      (rs || []).forEach(r => { const st = T.res.stats[r.test_id] || (T.res.stats[r.test_id] = { n:0, sum:0 }); st.n++; st.sum += Number(r.marks_obtained); });
    }
    if(!T.res.tests.length){ w.innerHTML = `<p class="tp-muted">Class ${esc(T.cls)} ka abhi koi test nahi hai.</p>`; return; }
    const n = clsStudents().length;
    w.innerHTML = T.res.tests.map(t => {
      const st = T.res.stats[t.id], avg = st && st.n ? Math.round(st.sum / st.n * 100 / t.total_marks) : null;
      return `<div class="tp-card" onclick="tp.resOpen(${t.id})" style="cursor:pointer;">
        <div style="display:flex;justify-content:space-between;gap:10px;"><div style="font-size:14px;font-weight:700;">${esc(t.title)}</div><div style="font-size:12px;font-weight:600;color:var(--ash);white-space:nowrap;">${fmtN(t.total_marks)} marks</div></div>
        <div style="font-size:11px;color:var(--ash);margin-top:2px;">${esc(t.subject)} · ${fmtDate(t.test_date)}</div>
        <div style="font-size:12px;font-weight:600;margin-top:6px;color:${st ? pctCol(avg) : 'var(--ash)'};">${st ? `${st.n}/${n} marked · Avg ${avg}%` : 'Marks abhi nahi daale'}</div>
      </div>`;
    }).join('');
  }

  async function resCreate(){
    const title = $('tpRT').value.trim(), subject = $('tpRS').value.trim(), total = Number($('tpRM').value), date = $('tpRD').value;
    if(!title || !subject){ toast('Test name aur subject zaroori hain.'); return; }
    if(!isFinite(total) || total <= 0){ toast('Total marks 0 se zyada hone chahiye.'); return; }
    if(!date){ toast('Date chuno.'); return; }
    const btn = $('tpRBtn'); btn.disabled = true; btn.textContent = 'Creating…';
    const { data, error } = await sb.from('tests').insert({ title, subject, cls:T.cls, total_marks:total, test_date:date }).select().single();
    btn.disabled = false; btn.textContent = 'Create Test';
    if(error){ toast('⚠️ ' + error.message); return; }
    T.res.tests.unshift(data);
    await openTest(data.id);
  }

  async function openTest(id){
    let t = T.res.tests.find(x => String(x.id) === String(id));
    if(!t){ const r = await sb.from('tests').select('*').eq('id', id).single(); t = r.data; if(!t) return; }
    T.res.open = t; T.res.existing = {};
    main().innerHTML = '<p class="tp-muted">Loading…</p>';
    const { data, error } = await sb.from('results').select('student_id,marks_obtained').eq('test_id', t.id);
    if(error){ toast('⚠️ ' + error.message); return; }
    (data || []).forEach(r => { T.res.existing[r.student_id] = r.marks_obtained; });
    const list = clsStudents();
    main().innerHTML = `
      <button class="tp-btn" onclick="tp.resBack()" style="margin-bottom:10px;">← Tests</button>
      <div style="font-size:15px;font-weight:700;">${esc(t.title)}</div>
      <div class="tp-muted" style="padding-top:2px;">${esc(t.subject)} · ${fmtDate(t.test_date)} · Total <b>${fmtN(t.total_marks)}</b></div>
      ${list.length ? list.map(s => { const v = T.res.existing[s.id]; return `
        <div class="tp-card" style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:600;">${esc(s.name)}</div>${s.roll ? `<div style="font-size:10px;color:var(--ash);">Roll ${esc(s.roll)}</div>` : ''}</div>
          <input id="tpM_${s.id}" class="tp-in" type="number" inputmode="decimal" min="0" max="${t.total_marks}" step="any" value="${v == null ? '' : fmtN(v)}" placeholder="—" style="width:80px;margin:0;text-align:center;font-weight:700;">
          <span style="font-size:12px;color:var(--ash);">/ ${fmtN(t.total_marks)}</span>
        </div>`; }).join('') + `<button id="tpResSave" class="tp-pri" onclick="tp.resSave()" style="margin-top:6px;">💾 Save Marks</button>` : '<p class="tp-muted">Is class mein koi student nahi hai.</p>'}
      <button class="tp-btn" onclick="tp.resDel()" style="width:100%;margin-top:10px;color:#B23B3B;">🗑️ Delete this test</button>`;
  }

  async function resSave(){
    const t = T.res.open; if(!t) return;
    const rows = [], clear = [], bad = [];
    clsStudents().forEach(s => {
      const el = $('tpM_' + s.id), v = el ? el.value.trim() : '';
      if(v === ''){ if(T.res.existing[s.id] !== undefined) clear.push(s.id); return; }
      const n = Number(v);
      if(!isFinite(n) || n < 0 || n > Number(t.total_marks)){ bad.push(s.name); return; }
      rows.push({ test_id:t.id, student_id:s.id, marks_obtained:n });
    });
    if(bad.length){ alert('Ye marks galat hain (0 se ' + fmtN(t.total_marks) + ' ke beech hone chahiye):\n\n' + bad.join('\n')); return; }
    const btn = $('tpResSave'); btn.disabled = true; btn.textContent = 'Saving…';
    let err = null;
    if(rows.length) err = (await sb.from('results').upsert(rows, { onConflict:'test_id,student_id' })).error;
    if(!err && clear.length) err = (await sb.from('results').delete().eq('test_id', t.id).in('student_id', clear)).error;
    btn.disabled = false; btn.textContent = '💾 Save Marks';
    if(err){ toast('⚠️ ' + err.message); return; }
    T.res.existing = {}; rows.forEach(r => { T.res.existing[r.student_id] = r.marks_obtained; });
    toast('✅ Marks saved (' + rows.length + ' students)');
  }

  async function resDel(){
    const t = T.res.open; if(!t) return;
    if(!confirm('"' + t.title + '" aur uske saare marks delete ho jayenge. Pakka?')) return;
    const { error } = await sb.from('tests').delete().eq('id', t.id);
    if(error){ toast('⚠️ ' + error.message); return; }
    T.res.open = null; draw();
  }

  // ── MATERIALS (Drive / YouTube / any https link) ──
  function normUrl(raw){
    let u = String(raw || '').trim(); if(!u) return null;
    if(!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    try{ const p = new URL(u); return /^https?:$/.test(p.protocol) ? p.href : null; }catch(e){ return null; }
  }
  const kindOf = u => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)/i.test(u) ? 'youtube' : /^https?:\/\/(drive|docs)\.google\.com/i.test(u) ? 'drive' : 'link';
  const KIND = { drive:['📁','Drive'], youtube:['▶️','YouTube'], link:['🔗','Link'] };

  async function drawMaterials(){
    main().innerHTML = `
      <div class="tp-card">
        <input id="tpMtT" class="tp-in" placeholder="Title (e.g. Trigonometry Notes)" maxlength="80">
        <input id="tpMtS" class="tp-in" list="tpMtSubs" placeholder="Subject (e.g. Maths)" maxlength="40">
        <datalist id="tpMtSubs">${SUBJECTS.map(s => `<option value="${s}">`).join('')}</datalist>
        <input id="tpMtU" class="tp-in" type="url" inputmode="url" placeholder="Drive / YouTube link paste karo">
        <p style="font-size:11px;color:var(--g);margin:0 0 10px;">⚠️ Drive link mein <b>"Anyone with the link → Viewer"</b> ON karo, warna students khol nahi payenge.</p>
        <button id="tpMtBtn" class="tp-pri" onclick="tp.matAdd()">＋ Add Material</button>
      </div>
      <div id="tpMtList"><p class="tp-muted">Loading…</p></div>`;
    await loadMat();
  }

  async function loadMat(){
    const w = $('tpMtList'); if(!w) return;
    const { data, error } = await sb.from('study_materials').select('*').eq('cls', T.cls).order('created_at', { ascending:false });
    if(error){ w.innerHTML = `<p class="tp-err">Load failed: ${esc(error.message)}</p>`; return; }
    T.mat = data || [];
    if(!T.mat.length){ w.innerHTML = `<p class="tp-muted">Class ${esc(T.cls)} ka abhi koi material nahi hai.</p>`; return; }
    w.innerHTML = T.mat.map(i => {
      const k = KIND[i.kind] || KIND.link, safe = /^https?:\/\//i.test(i.url) ? i.url : '#';
      return `<div class="tp-card">
        <div style="display:flex;gap:10px;"><div style="font-size:20px;">${k[0]}</div><div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;word-break:break-word;">${esc(i.title)}</div>
          <div style="font-size:11px;color:var(--ash);">${esc(i.subject)} · ${k[1]} · ${new Date(i.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</div></div></div>
        <div class="tp-row" style="margin-top:10px;">
          <a href="${esc(safe)}" target="_blank" rel="noopener noreferrer" class="tp-btn" style="flex:1;text-align:center;text-decoration:none;">Open ↗</a>
          <button class="tp-del" onclick="tp.matDel(${i.id})">🗑️ Delete</button>
        </div></div>`;
    }).join('');
  }

  async function matAdd(){
    const title = $('tpMtT').value.trim(); let subject = $('tpMtS').value.trim().replace(/\s+/g, ' ');
    const url = normUrl($('tpMtU').value);
    if(!title || !subject){ toast('Title aur subject zaroori hain.'); return; }
    if(!url){ toast('Link sahi nahi hai. https:// wala link paste karo.'); return; }
    const same = [...T.mat.map(i => i.subject), ...SUBJECTS].find(s => s.toLowerCase() === subject.toLowerCase());
    if(same) subject = same;
    const btn = $('tpMtBtn'); btn.disabled = true; btn.textContent = 'Saving…';
    const { error } = await sb.from('study_materials').insert({ title, subject, cls:T.cls, kind:kindOf(url), url });
    btn.disabled = false; btn.textContent = '＋ Add Material';
    if(error){ toast('⚠️ ' + error.message); return; }
    ['tpMtT','tpMtU'].forEach(id => { $(id).value = ''; });
    await loadMat();
  }

  async function matDel(id){
    const it = T.mat.find(x => String(x.id) === String(id)); if(!it) return;
    if(!confirm('"' + it.title + '" delete kar dun?')) return;
    const { error } = await sb.from('study_materials').delete().eq('id', it.id);
    if(error){ toast('⚠️ ' + error.message); return; }
    await loadMat();
  }

  // ── NOTICES (sirf dekh sakta hai) ──
  async function drawNotices(){
    const b = $('tpBody');
    b.innerHTML = '<p class="tp-muted">Loading…</p>';
    const { data, error } = await sb.from('notices').select('*').order('id', { ascending:false });
    if(T.tab !== 'notices') return;
    if(error){ b.innerHTML = `<p class="tp-err">Load failed: ${esc(error.message)}</p>`; return; }
    b.innerHTML = (data || []).length ? data.map(n => `
      <div class="tp-card">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:700;background:rgba(var(--g-rgb),.12);color:var(--gold-dark);padding:2px 8px;border-radius:8px;">${esc(n.tag)}</span>
          <span style="font-size:10px;color:var(--ash);">${esc(n.date)}</span>
        </div>
        <div style="font-size:14px;font-weight:600;">${esc(n.title)}</div>
        ${n.body ? `<div style="font-size:12px;color:var(--ash);margin-top:2px;line-height:1.5;">${esc(n.body)}</div>` : ''}
      </div>`).join('') : '<p class="tp-muted">Abhi koi notice nahi hai.</p>';
  }

  // ── PUBLIC API ──
  window.tp = {
    logout, tab:tpTab, cls:tpCls,
    attMark:(id, st) => { T.att.marks[id] = st; drawAttList(); },
    attDate:() => { T.att.date = $('tpAttDate').value || todayStr(); loadAtt(); },
    attSave, ttAdd, ttDel,
    resForm:() => { const f = $('tpResForm'); if(f) f.style.display = f.style.display === 'none' ? '' : 'none'; },
    resCreate, resOpen:openTest, resBack:() => { T.res.open = null; draw(); }, resSave, resDel,
    matAdd, matDel,
  };
  window.vtOpenTeacherPanel = open;

  // admin ne module OFF/ON kiya toh tabs refresh
  document.addEventListener('vt-flags', () => { const p = $('tpPage'); if(p && p.style.display === 'block' && T.staff && !T.res.open){ shell(); draw(); } });
})();
