(function(){
  /* ── CONFIG ── */
  const FEE = {'10':2000,'11':2500,'12':3000};
  // Academic year Apr–Mar (index 0=Apr, 1=May, ..., 11=Mar)
  const MONTHS = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR'];
  // Map calendar month (0=Jan) to academic index
  const CAL_TO_AC = {0:9,1:10,2:11,3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,11:8};
  const STORE = 'vt_fee_v3';
  const COLORS = [
    ['#1a4b2e','#1D7A56'], // green
    ['#1a2e4b','#24449E'], // blue
    ['#3a1a4b','#3B3168'], // purple
    ['#4b2a1a','#8A6118'], // orange
    ['#4b1a1a','#B23B3B'], // red
    ['#1a3a3a','#00d4c8'], // teal
    ['#3a3a1a','#d4c800'], // yellow
  ];

  let students = JSON.parse(localStorage.getItem(STORE)||'null');
  if(!students){
    students=[
      {id:1,name:'Rohit Sharma', cls:'10',phone:'919876543210',roll:'01',color:0,code:'7276',fees:{}},
      {id:2,name:'Virat Kohli',  cls:'11',phone:'919876543211',roll:'05',color:1,code:'5372',fees:{}},
      {id:3,name:'MS Dhoni',     cls:'12',phone:'919876543212',roll:'07',color:2,code:'7382',fees:{}},
      {id:4,name:'Cristiano Ronaldo',cls:'10',phone:'919876543213',roll:'12',color:3,code:'3728',fees:{}},
      {id:5,name:'Lionel Messi', cls:'12',phone:'919876543214',roll:'10',color:4,code:'5396',fees:{}},
    ];
    // Give some demo data
    const demoFees = [[0,1,3],[0,1,2,3,4],[0,1,2,3,4,5,6,7,8],[0],[0,1,2,3,4,5,6]];
    students.forEach((s,i)=>{ demoFees[i].forEach(m=>s.fees[m]=true); });
    save();
  }

  // Migrate codes for any existing students who don't have one yet (older saved data)
  (function migrateCodesInline(){
    const legacy = {1:'7276', 2:'5372', 3:'7382', 4:'3728', 5:'5396'};
    let changed = false;
    students.forEach(s=>{
      if(!s.code && legacy[s.id]){ s.code = legacy[s.id]; changed = true; }
    });
    if(changed) save();
  })();

  let filterCls = '';
  let activeTab = 'all';
  let expandedId = null;

  // Current academic month index (APR=0 ... MAR=11)
  function curAcMonth(){
    return CAL_TO_AC[new Date().getMonth()];
  }

  // All months BEFORE current month in this academic year
  // e.g. if cur=JUN(2), past months = [APR(0), MAY(1)]
  function pastMonths(){
    const cur = curAcMonth();
    const result = [];
    for(let i = 0; i < cur; i++) result.push(i);
    return result;
  }

  // Defaulter = ANY past month unpaid (not just previous month)
  function isDefaulter(s){
    return pastMonths().some(i => !s.fees[i]);
  }

  // Which past months are unpaid for this student
  function unpaidPastMonths(s){
    return pastMonths().filter(i => !s.fees[i]);
  }

  // MONTHLY stats — only current month
  function monthCollected(){
    const cur = curAcMonth();
    return students.filter(s => s.fees[cur]).reduce((a,s) => a + FEE[s.cls], 0);
  }
  function monthPending(){
    const cur = curAcMonth();
    return students.filter(s => !s.fees[cur]).reduce((a,s) => a + FEE[s.cls], 0);
  }
  function monthPaidCount(){
    const cur = curAcMonth();
    return students.filter(s => s.fees[cur]).length;
  }

  function paidCount(s){ return Object.values(s.fees).filter(Boolean).length; }
  // Due amount = only past + current unpaid months (future months don't count)
  function dueAmt(s){
    const cur = curAcMonth();
    let due = 0;
    for(let i = 0; i <= cur; i++){
      if(!s.fees[i]) due += FEE[s.cls];
    }
    return due;
  }
  function initials(name){ return name.trim().split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join(''); }

  function save(){ localStorage.setItem(STORE,JSON.stringify(students)); }

  window.faSetFilter = function(el, cls){
    filterCls = cls;
    document.querySelectorAll('.fa-filter-btn').forEach(b=>b.classList.remove('active'));
    el.classList.add('active');
    faRender();
  };

  window.faSwitchTab = function(tab){
    activeTab = tab;
    document.getElementById('faAllTab').style.display = tab==='all'?'':'none';
    document.getElementById('faDefTab').style.display = tab==='defaulters'?'':'none';
    document.getElementById('faTopTab').style.display = tab==='toppers'?'':'none';
    document.getElementById('faNoticeTab').style.display = tab==='notice'?'':'none';
    document.getElementById('tabAll').classList.toggle('active', tab==='all');
    document.getElementById('tabDef').classList.toggle('active', tab==='defaulters');
    document.getElementById('tabTop').classList.toggle('active', tab==='toppers');
    document.getElementById('tabNotice').classList.toggle('active', tab==='notice');
    if(tab==='toppers') renderTopperAdmin();
    if(tab==='notice') renderNoticeAdmin();
    faRender();
  };

  // ── NOTICE MANAGER ──
  const NOTICE_KEY = 'vt_notices';

  function getNotices(){
    try{ return JSON.parse(localStorage.getItem(NOTICE_KEY))||[]; }catch(e){ return []; }
  }
  function saveNotices(arr){ localStorage.setItem(NOTICE_KEY, JSON.stringify(arr)); }

  window.addNotice = function(){
    const tag   = document.getElementById('noticeTag').value.trim();
    const title = document.getElementById('noticeTitle').value.trim();
    const body  = document.getElementById('noticeBody').value.trim();
    if(!title){ alert('Title likhna zaroori hai!'); return; }
    const notices = getNotices();
    notices.unshift({ id: Date.now(), tag, title, body, date: new Date().toLocaleDateString('en-IN',{month:'short',year:'numeric'}) });
    saveNotices(notices);
    document.getElementById('noticeTitle').value='';
    document.getElementById('noticeBody').value='';
    renderNoticeAdmin();
  };

  window.deleteNotice = function(id){
    if(!confirm('Delete this notice?')) return;
    saveNotices(getNotices().filter(n=>n.id!==id));
    renderNoticeAdmin();
    renderPublicNotices();
  };

  function renderNoticeAdmin(){
    const notices = getNotices();
    const el = document.getElementById('noticeAdminList');
    if(!notices.length){ el.innerHTML='<p style="text-align:center;color:#aaa;font-size:13px;padding:24px;">Koi notice nahi abhi 😴</p>'; return; }
    el.innerHTML = notices.map(n=>`
      <div style="background:#fff8ea;border:1px solid #E7DCC5;border-radius:12px;padding:14px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;">
        <div style="flex:1;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
            <span style="font-size:10px;font-weight:700;background:rgba(180,135,44,.12);border:1px solid rgba(180,135,44,.2);color:#8a6820;padding:2px 8px;border-radius:8px;">${n.tag}</span>
            <span style="font-size:10px;color:#aaa;">${n.date}</span>
          </div>
          <p style="font-size:13px;font-weight:600;color:#2A2318;margin-bottom:3px;">${n.title}</p>
          <p style="font-size:11px;color:#7A6F5C;line-height:1.5;">${n.body||''}</p>
        </div>
        <button onclick="deleteNotice(${n.id})" style="flex-shrink:0;background:rgba(178,59,59,.08);border:1px solid rgba(178,59,59,.2);color:rgba(178,59,59,.8);border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;">🗑️</button>
      </div>
    `).join('');
    renderPublicNotices();
  }

  // Public notice board refresh
  function renderPublicNotices(){
    const el = document.getElementById('dynamicNoticeBoard');
    if(!el) return;
    const notices = getNotices();
    if(!notices.length){ el.innerHTML='<p style="text-align:center;padding:24px;color:rgba(42,35,24,.3);font-size:13px;">Koi notice nahi abhi.</p>'; return; }
    const tagColors = {
      NEW:'rgba(178,59,59',RESULT:'rgba(36,68,158',TEST:'rgba(180,135,44',
      OFFER:'rgba(29,122,86',HOLIDAY:'rgba(180,135,44',INFO:'rgba(42,35,24'
    };
    el.innerHTML = notices.map(n=>{
      const c = tagColors[n.tag]||'rgba(42,35,24';
      return `
      <div style="padding:18px 24px;border-bottom:1px solid rgba(180,135,44,.06);display:flex;gap:14px;align-items:flex-start;">
        <div style="width:40px;height:40px;border-radius:10px;flex-shrink:0;background:${c},.08);border:1px solid ${c},.15);display:flex;align-items:center;justify-content:center;">
          <i data-lucide="bell" style="width:16px;height:16px;color:${c},.7);"></i>
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-size:10px;font-weight:700;background:${c},.08);border:1px solid ${c},.2);color:${c},.8);padding:2px 8px;border-radius:10px;letter-spacing:.04em;">${n.tag}</span>
            <span style="font-size:10px;color:rgba(42,35,24,.3);">${n.date}</span>
          </div>
          <p style="font-size:13px;font-weight:600;color:var(--ink);margin-bottom:3px;">${n.title}</p>
          ${n.body?`<p style="font-size:11px;color:rgba(42,35,24,.4);line-height:1.5;">${n.body}</p>`:''}
        </div>
      </div>`;
    }).join('');
    if(window.lucide) lucide.createIcons();
  }

  window.faToggleFee = function(id, month){
    const s = students.find(x=>x.id===id);
    if(!s) return;
    s.fees[month] = !s.fees[month];
    save(); faRender();
    // Keep expanded
    expandedId = id;
  };

  window.faMarkAll = function(id){
    const s = students.find(x=>x.id===id);
    if(!s) return;
    MONTHS.forEach((_,i)=>s.fees[i]=true);
    save(); expandedId=id; faRender();
  };

  window.faResetAll = function(id){
    if(!confirm('Reset all months for this student?')) return;
    const s = students.find(x=>x.id===id);
    if(!s) return;
    s.fees={};
    save(); expandedId=id; faRender();
  };

  window.faToggleCard = function(id){
    expandedId = expandedId===id ? null : id;
    faRender();
  };

  window.faSendWA = function(id){
    const s = students.find(x=>x.id===id);
    if(!s) return;
    const unpaid = MONTHS.filter((_,i)=>!s.fees[i]).join(', ');
    const due = dueAmt(s);
    const text = `Namaste ${s.name} ji! 🙏\n\nVrindavan Tutorials - Fee Reminder\n\n📚 Class ${s.cls} | Roll #${s.roll}\n💰 Monthly Fee: ₹${FEE[s.cls]}\n📅 Pending: ${unpaid || 'None'}\n💸 Total Due: ₹${due.toLocaleString('en-IN')}\n\nKripya fee jama karein. Dhanyawad! 🙏`;
    window.open(`https://wa.me/${s.phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  window.faDelete = function(id){
    if(!confirm('Delete this student?')) return;
    students = students.filter(x=>x.id!==id);
    if(expandedId===id) expandedId=null;
    save(); faRender();
  };

  window.faCheckCodeLive = function(){
    const code = document.getElementById('faCode').value.trim();
    const codeErr = document.getElementById('faCodeError');
    if(code.length < 4){ codeErr.textContent=''; return; }
    const isDuplicate = students.some(s => s.code === code);
    codeErr.textContent = isDuplicate ? '🚫 The code is occupied — choose another' : '✅ Code available';
    codeErr.style.color = isDuplicate ? '#B23B3B' : '#1D7A56';
  };

  window.faOpenModal = function(){
    document.getElementById('faName').value='';
    document.getElementById('faPhone').value='';
    document.getElementById('faCls').value='10';
    document.getElementById('faCode').value='';
    document.getElementById('faCodeError').textContent='';
    document.getElementById('faModal').style.display='flex';
    setTimeout(()=>document.getElementById('faName').focus(),100);
  };

  window.faAddStudent = function(){
    const name = document.getElementById('faName').value.trim();
    const cls  = document.getElementById('faCls').value;
    const phone= document.getElementById('faPhone').value.trim();
    const code = document.getElementById('faCode').value.trim();
    const codeErr = document.getElementById('faCodeError');
    codeErr.textContent = '';

    if(!name){ alert('Name required!'); return; }

    if(!code || code.length !== 4){
      codeErr.textContent = '⚠️ Code must be exactly 4 digits';
      return;
    }

    const isDuplicate = students.some(s => s.code === code);
    if(isDuplicate){
      codeErr.textContent = '🚫 The code is occupied — choose another';
      return;
    }

    const maxId = students.length ? Math.max(...students.map(x=>x.id)) : 0;
    const maxRoll = students.filter(x=>x.cls===cls).length;
    const roll = String(maxRoll+1).padStart(2,'0');
    const colorIdx = maxId % COLORS.length;
    students.push({id:maxId+1, name, cls, phone, roll, color:colorIdx, code, fees:{}});
    save();
    document.getElementById('faModal').style.display='none';
    faRender();
  };

  window.faRender = function(){
    const q = document.getElementById('faSearch').value.toLowerCase();
    let list = students.filter(s=>{
      if(filterCls && s.cls!==filterCls) return false;
      if(q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });

    // ── PENDING PAYMENT NOTIFICATIONS ──
    const PENDING_KEY = 'vt_pending_payments';
    let pending = JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
    const pendingBanner = document.getElementById('faPendingBanner');
    if(pendingBanner){
      pendingBanner.innerHTML = pending.length ? pending.map(p=>{
        const s = students.find(x=>x.id===p.studentId);
        if(!s) return '';
        const timeStr = new Date(p.time).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        return `<div style="margin:10px 16px 0;background:rgba(29,122,86,.08);border:1px solid rgba(29,122,86,.3);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">💸</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:#2A2318;">${s.name} says they paid</div>
            <div style="font-size:11px;color:#7A6F5C;">${timeStr} · Please verify in your UPI app</div>
          </div>
          <button onclick="faDismissPending(${p.studentId})" style="padding:5px 10px;border:none;border-radius:6px;background:rgba(255,255,255,.08);color:#7A6F5C;font-size:11px;cursor:pointer;">Dismiss</button>
        </div>`;
      }).join('') : '';
    }

    // ── ALL STUDENTS ──
    const cur = curAcMonth();
    const container = document.getElementById('faList');
    container.innerHTML = list.map(s=>{
      const paid = paidCount(s);
      const def = isDefaulter(s);
      const [bg, fg] = COLORS[s.color % COLORS.length];
      const expanded = expandedId === s.id;
      const progPct = Math.round(paid/12*100);

      const monthsHtml = MONTHS.map((m,i)=>{
        const isPaid = !!s.fees[i];
        const isPast = pastMonths().includes(i);
        let cls2 = isPaid ? 'paid' : (isPast ? 'current-due' : 'unpaid');
        const icon = isPaid ? '✓' : (isPast ? '!' : '✕');
        return `<button class="fa-month-btn ${cls2}" onclick="faToggleFee(${s.id},${i})">
          <span>${m}</span><span class="fa-month-icon">${icon}</span>
        </button>`;
      }).join('');

      return `<div class="fa-card ${def?'defaulter':''}" id="card-${s.id}">
        <div class="fa-card-head" onclick="faToggleCard(${s.id})">
          <div class="fa-avatar" style="background:${bg};color:${fg};">${initials(s.name)}</div>
          <div class="fa-card-info">
            <div class="fa-card-name">${s.name}</div>
            <div class="fa-card-meta">
              <span class="fa-cls-badge" style="background:${bg}22;color:${fg};">Class ${s.cls}</span>
              <span class="fa-roll">Code: ${s.code || '—'}</span>
              <span class="fa-fee-info">₹${FEE[s.cls].toLocaleString()}/mo</span>
            </div>
          </div>
          <div class="fa-card-right">
            <div class="fa-paid-count" style="color:${def?'#B23B3B':'#1D7A56'}">${paid}/12</div>
            <div class="fa-paid-label">months paid</div>
          </div>
          <span class="fa-chevron ${expanded?'open':''}">▾</span>
        </div>
        <div class="fa-progress"><div class="fa-progress-fill" style="width:${progPct}%;background:${def?'linear-gradient(90deg,#B23B3B,#C24A3A)':'linear-gradient(90deg,#1D7A56,#125C3F)'};"></div></div>
        <div class="fa-card-body ${expanded?'open':''}">
          <div class="fa-quick-btns">
            <button class="fa-qbtn fa-qbtn-paid" onclick="faMarkAll(${s.id})">✓ Mark All Paid</button>
            <button class="fa-qbtn fa-qbtn-reset" onclick="faResetAll(${s.id})">⊘ Reset All</button>
          </div>
          <div class="fa-month-grid">${monthsHtml}</div>
          <div class="fa-card-actions">
            <button class="fa-action-btn fa-wa-btn" onclick="faSendWA(${s.id})">📱 WhatsApp Reminder</button>
            <button class="fa-action-btn fa-del-btn" onclick="faDelete(${s.id})">🗑 Delete</button>
          </div>
        </div>
      </div>`;
    }).join('') || '<div style="text-align:center;color:#7A6F5C;padding:40px 0;">No students found 🎉</div>';

    // ── DEFAULTERS TAB ──
    const defList = students.filter(s=>{
      if(filterCls && s.cls!==filterCls) return false;
      return isDefaulter(s);
    });
    const defContainer = document.getElementById('faDefList');
    defContainer.innerHTML = defList.length
      ? `<div class="fa-section-title">⚠️ ${defList.length} student${defList.length>1?'s':''} with past months due</div>`
        + defList.map(s=>{
          const [bg,fg]=COLORS[s.color%COLORS.length];
          const due=dueAmt(s);
          const unpaidNames = unpaidPastMonths(s).map(i=>MONTHS[i]).join(', ');
          return `<div class="fa-def-card">
            <div class="fa-avatar" style="background:${bg};color:${fg};width:40px;height:40px;border-radius:10px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials(s.name)}</div>
            <div class="fa-def-info">
              <div class="fa-def-name">${s.name}</div>
              <div class="fa-def-meta">Class ${s.cls} · Code: ${s.code || '—'}</div>
              <div style="font-size:10px;color:#A66A2E;margin-top:3px;">Unpaid: ${unpaidNames}</div>
            </div>
            <div>
              <div class="fa-def-due">₹${due.toLocaleString('en-IN')}</div>
              <div class="fa-def-due-lbl">total due</div>
            </div>
          </div>`;
        }).join('')
      : '<div style="text-align:center;color:#7A6F5C;padding:40px 0;">🎉 No defaulters!</div>';

    // Update tab label
    document.getElementById('tabDef').textContent = `⚠️ Defaulters (${defList.length})`;

    // ── FOOTER STATS (monthly) ──
    const curIdx = curAcMonth();
    const curMonthName = MONTHS[curIdx];
    const mCollected = monthCollected();
    const mPending   = monthPending();
    const mPaidN     = monthPaidCount();
    const defCount   = students.filter(s => isDefaulter(s)).length;
    document.getElementById('faFooter').innerHTML = `
      <div style="font-size:10px;color:#7A6F5C;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">📅 ${curMonthName} Stats</div>
      <div class="fa-footer-row"><span class="fa-footer-lbl">Total Students</span><span class="fa-footer-val" style="color:#2A2318;">${students.length}</span></div>
      <div class="fa-footer-row"><span class="fa-footer-lbl">${curMonthName} Collected (${mPaidN}/${students.length})</span><span class="fa-footer-val" style="color:#1D7A56;">₹${mCollected.toLocaleString('en-IN')}</span></div>
      <div class="fa-footer-row"><span class="fa-footer-lbl">${curMonthName} Pending (${students.length - mPaidN}/${students.length})</span><span class="fa-footer-val" style="color:#B23B3B;">₹${mPending.toLocaleString('en-IN')}</span></div>
      <div class="fa-footer-row"><span class="fa-footer-lbl">Defaulters (past months due)</span><span class="fa-footer-val" style="color:#B23B3B;">${defCount}</span></div>
    `;
  };

  window.faDismissPending = function(studentId){
    const PENDING_KEY = 'vt_pending_payments';
    let pending = JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
    pending = pending.filter(p => p.studentId !== studentId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    faRender();
  };

  window.openUpiSettings = function(){
    const UPI_STORE = 'vt_upi_id';
    const UPI_NAME_STORE = 'vt_upi_name';
    const TEACHER_PHONE_STORE = 'vt_teacher_phone';
    const DEFAULT_UPI_ID = '7007814025@mbk';
    document.getElementById('upiIdInput').value = localStorage.getItem(UPI_STORE) || DEFAULT_UPI_ID;
    document.getElementById('upiNameInput').value = localStorage.getItem(UPI_NAME_STORE) || 'Vrindavan Tutorials';
    document.getElementById('upiTeacherPhoneInput').value = localStorage.getItem(TEACHER_PHONE_STORE) || '';
    document.getElementById('upiSettingsModal').style.display = 'flex';
  };

  window.closeUpiSettings = function(){
    document.getElementById('upiSettingsModal').style.display = 'none';
  };

  window.saveUpiSettings = function(){
    const upiId = document.getElementById('upiIdInput').value.trim();
    const payeeName = document.getElementById('upiNameInput').value.trim();
    const teacherPhone = document.getElementById('upiTeacherPhoneInput').value.trim().replace(/\D/g,'');
    if(!upiId || !upiId.includes('@')){
      alert('⚠️ Please enter a valid UPI ID (e.g. name@bank)');
      return;
    }
    localStorage.setItem('vt_upi_id', upiId);
    localStorage.setItem('vt_upi_name', payeeName || 'Vrindavan Tutorials');
    if(teacherPhone) localStorage.setItem('vt_teacher_phone', teacherPhone);
    document.getElementById('upiSettingsModal').style.display = 'none';
    alert('✅ Settings saved! All future payments and alerts will use this info.');
  };

  // ─── TALK TO A TOPPER SYSTEM ───
  const TOPPER_STORE = 'vt_toppers';
  const TOPPER_CODES_STORE = 'vt_topper_codes';   // {code: {used:bool, topperId, requestedName, requestedPhone, time}}
  const TOPPER_REQUESTS_STORE = 'vt_topper_requests'; // [{code, studentName, studentPhone, topperId, time}]

  let toppers = JSON.parse(localStorage.getItem(TOPPER_STORE)||'null');
  if(!toppers){
    toppers = [
      {id:1, name:'Akshit', phone:'919336163948', achievement:'School Topper 2024-25 · 96% in Class 12 Boards · Cracked JEE Mains'},
      {id:2, name:'Sarthak', phone:'917007784025', achievement:'Class 10 Topper · 95% Boards · State-level Science Olympiad winner'},
      {id:3, name:'Saket', phone:'918317362815', achievement:'Class 12 Topper · 97% Boards · Selected for NTSE'},
    ];
    localStorage.setItem(TOPPER_STORE, JSON.stringify(toppers));
  }

  function getTopperCodes(){
    return JSON.parse(localStorage.getItem(TOPPER_CODES_STORE)||'{}');
  }
  function saveTopperCodes(codes){
    localStorage.setItem(TOPPER_CODES_STORE, JSON.stringify(codes));
  }
  function getTopperRequests(){
    return JSON.parse(localStorage.getItem(TOPPER_REQUESTS_STORE)||'[]');
  }

  window.faGenerateTopperCode = function(){
    const codes = getTopperCodes();
    let code;
    do {
      code = String(Math.floor(100000 + Math.random()*900000)); // 6-digit
    } while(codes[code]);
    codes[code] = {used:false, topperId:null, time:new Date().toISOString()};
    saveTopperCodes(codes);
    renderTopperAdmin();
  };

  window.faRevokeTopperCode = function(code){
    if(!confirm('Revoke this code? It will stop working immediately.')) return;
    const codes = getTopperCodes();
    delete codes[code];
    saveTopperCodes(codes);
    renderTopperAdmin();
  };

  window.faDismissTopperRequest = function(idx){
    let reqs = getTopperRequests();
    reqs.splice(idx,1);
    localStorage.setItem(TOPPER_REQUESTS_STORE, JSON.stringify(reqs));
    renderTopperAdmin();
  };

  window.renderTopperAdmin = function(){
    const container = document.getElementById('faTopperContent');
    if(!container) return;
    const codes = getTopperCodes();
    const requests = getTopperRequests();

    const codesHtml = Object.keys(codes).length
      ? Object.entries(codes).reverse().map(([code, info])=>{
          const topper = info.topperId ? toppers.find(t=>t.id===info.topperId) : null;
          return `<div style="display:flex;align-items:center;justify-content:between;gap:10px;background:#FFFFFF;border:1px solid #DDD2BC;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
            <div style="flex:1;">
              <div style="font-size:16px;font-weight:800;letter-spacing:2px;color:#C9A227;">${code}</div>
              <div style="font-size:11px;color:#7A6F5C;margin-top:2px;">${info.used ? `Used · Assigned: ${topper?topper.name:'—'}` : 'Not used yet'}</div>
            </div>
            <button onclick="faRevokeTopperCode('${code}')" style="padding:6px 12px;border:none;border-radius:6px;background:rgba(178,59,59,.1);color:#B23B3B;font-size:11px;font-weight:600;cursor:pointer;">Revoke</button>
          </div>`;
        }).join('')
      : '<div style="color:#7A6F5C;font-size:13px;padding:10px 0;">No codes generated yet.</div>';

    const requestsHtml = requests.length
      ? requests.slice().reverse().map((r,revIdx)=>{
          const idx = requests.length - 1 - revIdx;
          const topper = toppers.find(t=>t.id===r.topperId);
          const timeStr = new Date(r.time).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
          const waLink = `https://wa.me/${r.studentPhone.replace(/\D/g,'')}`;
          return `<div style="background:rgba(180,135,44,.05);border:1px solid rgba(180,135,44,.25);border-radius:12px;padding:12px 14px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <div>
                <div style="font-size:13px;font-weight:700;color:#2A2318;">${r.studentName}</div>
                <div style="font-size:11px;color:#7A6F5C;margin-top:2px;">Wants to talk to <b style="color:#C9A227;">${topper?topper.name:'Unknown'}</b></div>
                <div style="font-size:11px;color:#7A6F5C;">📞 ${r.studentPhone} · ${timeStr}</div>
              </div>
              <button onclick="faDismissTopperRequest(${idx})" style="padding:5px 10px;border:none;border-radius:6px;background:rgba(255,255,255,.08);color:#7A6F5C;font-size:11px;cursor:pointer;flex-shrink:0;">Dismiss</button>
            </div>
            <a href="${waLink}" target="_blank" style="display:block;margin-top:8px;text-align:center;padding:8px;border-radius:8px;background:rgba(37,211,102,.12);color:#25d366;font-size:12px;font-weight:600;text-decoration:none;">💬 Message Student on WhatsApp</a>
          </div>`;
        }).join('')
      : '<div style="color:#7A6F5C;font-size:13px;padding:10px 0;">No call requests yet.</div>';

    const toppersListHtml = toppers.length ? toppers.map(t=>`
      <div style="background:#FFFFFF;border:1px solid #DDD2BC;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:#2A2318;margin-bottom:2px;">${t.name}</div>
          <div style="font-size:11px;color:#7A6F5C;">${t.achievement}</div>
          <div style="font-size:11px;color:#DDD2BC;margin-top:3px;">📞 ${t.phone}</div>
        </div>
        <button onclick="faRemoveTopper(${t.id})" style="padding:5px 10px;border:none;border-radius:6px;background:rgba(178,59,59,.1);color:#B23B3B;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;">Remove</button>
      </div>`).join('')
    : '<div style="color:#7A6F5C;font-size:13px;padding:8px 0;">No toppers added yet.</div>';

    container.innerHTML = `
      <div class="fa-section-title" style="padding:0 0 8px;">🔑 Generate Access Code</div>
      <button class="qr-confirm-btn" style="background:linear-gradient(135deg,#C9A227,#8A6118);margin-bottom:14px;" onclick="faGenerateTopperCode()">+ Generate New Code</button>
      <div style="margin-bottom:20px;">${codesHtml}</div>

      <div class="fa-section-title" style="padding:0 0 8px;">📞 Call Requests</div>
      <div style="margin-bottom:20px;">${requestsHtml}</div>

      <div class="fa-section-title" style="padding:0 0 8px;">🏆 Toppers</div>
      <div style="margin-bottom:10px;">${toppersListHtml}</div>
      <button class="qr-confirm-btn" style="background:linear-gradient(135deg,#24449E,#24449E);margin-bottom:6px;" onclick="faOpenAddTopperModal()">+ Add New Topper</button>
    `;
  };

  // ── ADD / REMOVE TOPPER ──
  window.faRemoveTopper = function(id){
    if(!confirm('Remove this topper? Their assigned codes will still exist but topper name will show as Unknown.')) return;
    toppers = toppers.filter(t => t.id !== id);
    localStorage.setItem(TOPPER_STORE, JSON.stringify(toppers));
    renderTopperAdmin();
  };

  window.faOpenAddTopperModal = function(){
    document.getElementById('addTopperModal').style.display = 'flex';
    document.getElementById('atName').value = '';
    document.getElementById('atPhone').value = '';
    document.getElementById('atAchievement').value = '';
  };

  window.faCloseAddTopperModal = function(){
    document.getElementById('addTopperModal').style.display = 'none';
  };

  window.faSaveTopper = function(){
    const name = document.getElementById('atName').value.trim();
    const phone = document.getElementById('atPhone').value.trim().replace(/\D/g,'');
    const achievement = document.getElementById('atAchievement').value.trim();
    if(!name || !phone){ alert('Name and phone are required!'); return; }
    const maxId = toppers.length ? Math.max(...toppers.map(t=>t.id)) : 0;
    toppers.push({id: maxId+1, name, phone: '91'+phone.replace(/^91/,''), achievement: achievement || 'Topper at Vrindavan Tutorials'});
    localStorage.setItem(TOPPER_STORE, JSON.stringify(toppers));
    faCloseAddTopperModal();
    renderTopperAdmin();
  };

  faRender();
})();

// ==== next block ====
document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();
    gsap.registerPlugin(ScrollTrigger);
    // Load saved notices into public board
    if(typeof renderPublicNotices === 'function') renderPublicNotices();

    // ── SCROLL-DRIVEN SVG STROKE (About Section) ──
    const vtStroke = document.getElementById('vtMainStroke');
    if(vtStroke){
      const totalLen = vtStroke.getTotalLength();
      vtStroke.style.strokeDasharray  = totalLen;
      vtStroke.style.strokeDashoffset = totalLen;
      gsap.to(vtStroke, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '#about',
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: 1.5,
        }
      });
    }

    // ─── LENIS SMOOTH SCROLL ───
    let lenis;
    if(typeof Lenis !== 'undefined'){
        lenis = new Lenis({
            duration: 1.25,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10*t)),
            smooth: true,
            smoothTouch: false,
        });
        window._lenis = lenis; // expose for Three.js background layer
        window._lenis = lenis;
        function lenisRaf(time){ lenis.raf(time); requestAnimationFrame(lenisRaf); }
        requestAnimationFrame(lenisRaf);
        // Sync ScrollTrigger with Lenis
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.lagSmoothing(0);
    }

    // ── SCROLL STROKE PATH ANIMATION ──
    (function(){
        const path = document.getElementById('stroke-path');
        if(!path) return;
        const total = path.getTotalLength();
        // init: hidden
        path.style.strokeDasharray = total;
        path.style.strokeDashoffset = total;
        path.style.transition = 'stroke-dashoffset .08s linear';

        function updateStroke(){
            const scrolled = window.scrollY;
            const maxScroll = document.body.scrollHeight - window.innerHeight;
            const progress = Math.min(scrolled / maxScroll, 1);
            path.style.strokeDashoffset = total * (1 - progress);
        }

        // Use lenis if available
        if(window._lenis){
            window._lenis.on('scroll', updateStroke);
        } else {
            window.addEventListener('scroll', updateStroke, { passive:true });
        }
        updateStroke();
    })();

    // ─── PHONE DETECTION ───
    const isPhone = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── CUSTOM CURSOR (desktop only) ───
    const cur = document.getElementById('cur');
    const cur2 = document.getElementById('cur2');
    let mx=0,my=0,cx=0,cy=0;
    if(!isPhone){
        document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;gsap.to(cur,{x:mx,y:my,duration:.05});});
        function trackCur(){cx+=(mx-cx)*.12;cy+=(my-cy)*.12;gsap.set(cur2,{x:cx,y:cy});requestAnimationFrame(trackCur);}
        trackCur();
        document.addEventListener('mousedown',()=>{cur.classList.add('click');cur2.classList.add('click');});
        document.addEventListener('mouseup',()=>{cur.classList.remove('click');cur2.classList.remove('click');});
        document.querySelectorAll('a,button,.mbtn,.cab,.tag,.fc,.fac,.tc,.yt-card').forEach(el=>{
            el.addEventListener('mouseenter',()=>{cur.classList.add('hover');cur2.classList.add('hover');});
            el.addEventListener('mouseleave',()=>{cur.classList.remove('hover');cur2.classList.remove('hover');});
        });
    }

    // ─── SCROLL PROGRESS BAR ───
    window.addEventListener('scroll',()=>{
        const pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
        document.getElementById('sprog').style.width=pct+'%';
    });

    // ══════════════════════════════════════════════════════
    // ─── DOUBLE LAYER ARCHITECTURE: THREE.JS BACKGROUND ───
    // Layer 1: Fullscreen living 3D world (fixed, always alive)
    // Layer 2: Floating UI panels on top (z-index 10+)
    // ══════════════════════════════════════════════════════
    (function(){
        const canvas = document.getElementById('hero-canvas');
        if (!canvas || typeof THREE === 'undefined') return;

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isPhone });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPhone ? 1 : 1.5));
        renderer.setSize(window.innerWidth, window.innerHeight);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
        camera.position.set(0, 0, 18);

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        });

        // ── PALETTE (light warm ivory theme) ──
        const C_GOLD  = new THREE.Color(0xB4872C);
        const C_BLUE  = new THREE.Color(0x24449E);
        const C_TEAL  = new THREE.Color(0x1D7A56);
        const C_IVORY = new THREE.Color(0xF0E8D8);
        const C_CREAM = new THREE.Color(0xE8E0D0);

        // ── 1. AMBIENT PARTICLE DUST (large field) ──
        const DUST_COUNT = isPhone ? 180 : 250;
        const dustPos = new Float32Array(DUST_COUNT * 3);
        const dustColors = new Float32Array(DUST_COUNT * 3);
        const palette = [C_GOLD, C_BLUE, C_TEAL, C_IVORY, C_CREAM];
        for (let i = 0; i < DUST_COUNT; i++) {
            dustPos[i*3]   = (Math.random() - 0.5) * 60;
            dustPos[i*3+1] = (Math.random() - 0.5) * 40;
            dustPos[i*3+2] = (Math.random() - 0.5) * 30;
            const c = palette[Math.floor(Math.random() * palette.length)];
            dustColors[i*3]   = c.r;
            dustColors[i*3+1] = c.g;
            dustColors[i*3+2] = c.b;
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        dustGeo.setAttribute('color',    new THREE.BufferAttribute(dustColors, 3));
        const dustMat = new THREE.PointsMaterial({
            size: isPhone ? 0.06 : 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.28,
            sizeAttenuation: true
        });
        const dust = new THREE.Points(dustGeo, dustMat);
        scene.add(dust);

        // ── 2. MID-LAYER GLOW ORBS (large soft spheres) ──
        const orbs = [];
        const orbDefs = [
            { pos: [-12, 6, -8],  r: 3.5, color: 0xB4872C, op: 0.055 },
            { pos: [14, -4, -12], r: 4.0, color: 0x24449E, op: 0.045 },
            { pos: [-4, -10, -6],  r: 2.8, color: 0x1D7A56, op: 0.04  },
            { pos: [8, 10, -10],  r: 3.2, color: 0xC9A96E, op: 0.05  },
            { pos: [-16, 0, -14], r: 5.0, color: 0xE8E0D0, op: 0.025 },
            { pos: [0, -14, -10], r: 3.0, color: 0xB4872C, op: 0.035 },
        ];
        orbDefs.forEach(d => {
            const g = new THREE.SphereGeometry(d.r, 16, 16);
            const m = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: d.op });
            const mesh = new THREE.Mesh(g, m);
            mesh.position.set(...d.pos);
            scene.add(mesh);
            orbs.push({ mesh, baseY: d.pos[1], speed: 0.3 + Math.random() * 0.4, phase: Math.random() * Math.PI * 2 });
        });

        // ── 3. FLOATING GEOMETRIC SHARDS ──
        const shards = [];
        const shardDefs = isPhone ? [
            { type:'ico', pos:[ 6, 3,-4],  s:1.0, color:0xB4872C, op:0.06, wx:0.3, wy:0.4 },
            { type:'oct', pos:[-5,-2,-5],  s:0.7, color:0x24449E, op:0.05, wx:-0.4, wy:0.3 },
            { type:'tor', pos:[ 2,-5,-3],  s:0.5, color:0x1D7A56, op:0.04, wx:0.5, wy:-0.3 },
        ] : [
            { type:'ico', pos:[ 9,  4, -3],  s:1.4, color:0xB4872C, op:0.065, wx:0.25, wy:0.35 },
            { type:'ico', pos:[-10, -3, -5], s:1.1, color:0xC9A96E, op:0.05,  wx:-0.3,  wy:0.2  },
            { type:'oct', pos:[ 6, -7, -4],  s:0.9, color:0x24449E, op:0.055, wx:0.4,  wy:-0.3 },
            { type:'oct', pos:[-7,  7, -6],  s:0.7, color:0x3B3168, op:0.045, wx:-0.35, wy:0.4  },
            { type:'tor', pos:[ 3,  8, -4],  s:0.6, color:0x1D7A56, op:0.05,  wx:0.5,  wy:0.3  },
            { type:'tor', pos:[-4, -8, -3],  s:0.5, color:0x24449E, op:0.04,  wx:-0.45, wy:-0.35},
            { type:'ico', pos:[12,  0, -8],  s:1.8, color:0xE8E0D0, op:0.03,  wx:0.18, wy:0.22 },
            { type:'oct', pos:[-12, 5, -9], s:1.3, color:0xB4872C, op:0.035, wx:0.28, wy:-0.2  },
        ];
        shardDefs.forEach(d => {
            let g;
            if (d.type === 'ico') g = new THREE.IcosahedronGeometry(d.s, 1);
            else if (d.type === 'oct') g = new THREE.OctahedronGeometry(d.s, 0);
            else g = new THREE.TorusGeometry(d.s, d.s * 0.28, 8, 18);
            const m = new THREE.MeshBasicMaterial({ color: d.color, wireframe: true, transparent: true, opacity: d.op });
            const mesh = new THREE.Mesh(g, m);
            mesh.position.set(...d.pos);
            scene.add(mesh);
            shards.push({ mesh, wx: d.wx, wy: d.wy, baseY: d.pos[1], phase: Math.random() * Math.PI * 2 });
        });

        // ── 4. SUBTLE GRID PLANE (depth cue, very faint) ──
        if (!isPhone) {
            const gridHelper = new THREE.GridHelper(80, 40, 0xB4872C, 0xB4872C);
            gridHelper.position.y = -14;
            gridHelper.rotation.x = 0.15;
            gridHelper.material.transparent = true;
            gridHelper.material.opacity = 0.018;
            scene.add(gridHelper);
        }

        // ── MOUSE + SCROLL STATE ──
        let mouseX = 0, mouseY = 0;
        let camTargetX = 0, camTargetY = 0;
        let scrollProgress = 0;

        if (!isPhone) {
            document.addEventListener('mousemove', e => {
                mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
                mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
            });
        }

        // Lenis scroll integration for smooth camera drift
        if (typeof Lenis !== 'undefined' && window._lenis) {
            window._lenis.on('scroll', ({ progress }) => { scrollProgress = progress; });
        } else {
            window.addEventListener('scroll', () => {
                scrollProgress = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
            });
        }

        // ── ANIMATION LOOP ──
        let lastTime = 0;
        function animate(time) {
            requestAnimationFrame(animate);
            if (document.hidden) return; // pause work when tab isn't visible
            const t = time * 0.001; // seconds
            const dt = Math.min(t - lastTime, 0.05);
            lastTime = t;

            // Dust field slow rotation
            dust.rotation.y = t * 0.018;
            dust.rotation.x = t * 0.008;

            // Orbs gentle breathing float
            orbs.forEach(o => {
                o.mesh.position.y = o.baseY + Math.sin(t * o.speed + o.phase) * 1.8;
                o.mesh.rotation.y = t * 0.06;
            });

            // Shards rotate on their axes + gentle float
            shards.forEach(s => {
                s.mesh.rotation.x += s.wx * dt * 0.4;
                s.mesh.rotation.y += s.wy * dt * 0.4;
                s.mesh.position.y = s.baseY + Math.sin(t * 0.35 + s.phase) * 0.9;
            });

            // Camera parallax: mouse + scroll-based cinematic drift
            if (!isPhone) {
                camTargetX = mouseX * 1.6 - scrollProgress * 2.5;
                camTargetY = -mouseY * 1.0 + scrollProgress * 1.2;
            } else {
                camTargetY = scrollProgress * 1.5;
            }
            camera.position.x += (camTargetX - camera.position.x) * 0.03;
            camera.position.y += (camTargetY - camera.position.y) * 0.03;
            // Slow ambient z drift (breathing)
            camera.position.z = 18 + Math.sin(t * 0.12) * 0.6 + scrollProgress * 3;
            camera.lookAt(0, scrollProgress * 2, 0);

            renderer.render(scene, camera);
        }
        animate(0);

        console.log('[VT] Double Layer Architecture: Three.js fullscreen background active ✓');
    })();

    // ─── HERO FLOATING ICONS ───
    const floatIcons=document.querySelectorAll('.hero-float-icon');
    gsap.to(floatIcons,{opacity: isPhone ? .4 : .55, duration:1,stagger:.2,delay:2,ease:'power2.out'});
    floatIcons.forEach((el,j)=>{
        gsap.to(el,{y:`${(j%2===0?-16:16)}px`,x:`${(j%3===0?7:-7)}px`,duration:2.8+j*.5,repeat:-1,yoyo:true,ease:'sine.inOut',delay:j*.35});
    });

    // ─── HERO TEXT ENTRANCE ───
    gsap.from('.ht',{scale:.92,duration:1.8,ease:'expo.out',delay:.3});

    // ─── MAGNETIC BUTTONS (desktop only) ───
    if(!isPhone){
        document.querySelectorAll('.mbtn,.cab').forEach(btn=>{
            btn.classList.add('mag');
            btn.addEventListener('mousemove',e=>{const r=btn.getBoundingClientRect();gsap.to(btn,{x:(e.clientX-r.left-r.width/2)*.25,y:(e.clientY-r.top-r.height/2)*.25,duration:.3,ease:'power2.out'});});
            btn.addEventListener('mouseleave',()=>gsap.to(btn,{x:0,y:0,duration:.5,ease:'elastic.out(1,.4)'}));
        });
    }

    // ─── TYPEWRITER ───
    const addr="Sector 16B 368, Vrindavan Yojna, Lucknow near Shiv Mandir";
    const tw=document.getElementById('twt'),mb=document.getElementById('mbtn');
    let i=0;
    function twr(){if(i<addr.length){tw.textContent+=addr.charAt(i);i++;setTimeout(twr,45);}else{setTimeout(()=>mb.classList.add('vis'),400);}}
    setTimeout(twr,2200);

    // ═══════════════════════════════════════════════
    // ─── UNIVERSAL SCROLL REVEAL HELPER ───
    // Works perfectly on both phone & desktop
    // Uses IntersectionObserver as fallback-safe base
    // ═══════════════════════════════════════════════
    function revealOnScroll(selector, animProps, options={}){
        const els = document.querySelectorAll(selector);
        if(!els.length) return;
        els.forEach((el,idx)=>{
            const delay = options.staggerDelay ? idx * options.staggerDelay : 0;
            gsap.set(el, animProps.from);
            const trigger = options.trigger || el;
            gsap.to(el,{
                ...animProps.to,
                delay,
                scrollTrigger:{
                    trigger: trigger===el ? el : trigger,
                    start: options.start || 'top 88%',
                    toggleActions:'play none none none',
                    once:true,
                    // phone-friendly: larger margin so triggers earlier
                    rootMargin: isPhone ? '0px 0px -20px 0px' : '0px 0px -40px 0px'
                }
            });
        });
    }

    // ═══════════════════════════════
    // ── SECTION: WHAT WE TEACH ──
    // ═══════════════════════════════

    // Section label fade+scale
    revealOnScroll('#teach .text-xs.font-semibold',
        {from:{opacity:0,y:20,scale:.8},to:{opacity:.5,y:0,scale:1,duration:.6,ease:'back.out(1.7)'}});

    // Section heading sweep up
    revealOnScroll('#teach h2',
        {from:{opacity:0,y:70,skewY:3},to:{opacity:1,y:0,skewY:0,duration:1,ease:'expo.out'}});

    // BOARDS tags — pop in with stagger
    (function(){
        const boardTags = document.querySelectorAll('#teach .tag.tl');
        boardTags.forEach((tag,idx)=>{
            gsap.set(tag,{scale:0,opacity:0,rotation:-8});
            gsap.to(tag,{scale:1,opacity:1,rotation:0,duration:.5,ease:'back.out(2)',delay:.1+idx*.12,
                scrollTrigger:{trigger:tag,start:'top 90%',toggleActions:'play none none none',once:true}});
        });
    })();

    // ALL tags stagger
    (function(){
        const allTags = document.querySelectorAll('#teach .tag:not(.tl)');
        allTags.forEach((tag,idx)=>{
            gsap.set(tag,{scale:.7,opacity:0,y:15});
            gsap.to(tag,{scale:1,opacity:1,y:0,duration:.45,ease:'back.out(1.8)',delay:idx*.05,
                scrollTrigger:{trigger:tag,start:'top 92%',toggleActions:'play none none none',once:true}});
        });
    })();

    // YouTube label sweep
    revealOnScroll('#teach .yl',
        {from:{opacity:0,x:-30},to:{opacity:1,x:0,duration:.7,ease:'power3.out'}});

    // YT Cards — stagger fly up from bottom
    (function(){
        const ytCards = document.querySelectorAll('.yt-card');
        // IntersectionObserver for class .rev
        const ob=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){const d=e.target.style.animationDelay||'0s';setTimeout(()=>e.target.classList.add('rev'),parseFloat(d)*1000);ob.unobserve(e.target);}});},{threshold:.1});
        ytCards.forEach(el=>ob.observe(el));
        // Extra GSAP scale entrance
        ytCards.forEach((card,idx)=>{
            gsap.set(card,{transformOrigin:'bottom center'});
            gsap.from(card,{scale:.88,duration:.8,ease:'expo.out',delay:.2+idx*.12,
                scrollTrigger:{trigger:card,start:'top 92%',toggleActions:'play none none none',once:true}});
        });
    })();

    // ═══════════════════════════════════════
    // ── SECTION: WHY VRINDAVAN TUTORIALS ──
    // ═══════════════════════════════════════

    revealOnScroll('#why .text-xs.font-semibold',
        {from:{opacity:0,y:15},to:{opacity:.5,y:0,duration:.6,ease:'power2.out'}});
    revealOnScroll('#why h2',
        {from:{opacity:0,y:60,skewY:2},to:{opacity:1,y:0,skewY:0,duration:1,ease:'expo.out'}});

    // Why-cards: alternating left/right on desktop, bottom on phone
    (function(){
        const facCards = document.querySelectorAll('.fac');
        const ob=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){const d=e.target.style.animationDelay||'0s';setTimeout(()=>e.target.classList.add('rev'),parseFloat(d)*1000);ob.unobserve(e.target);}});},{threshold:.1});
        facCards.forEach((card,idx)=>{
            ob.observe(card);
            const xDir = isPhone ? 0 : (idx%2===0 ? -50 : 50);
            gsap.from(card,{
                x:xDir, y: isPhone ? 40 : 0, opacity:0, scale:.94,
                duration:.7, ease:'power3.out', delay: isPhone ? idx*.1 : idx*.08,
                scrollTrigger:{trigger:card,start:'top 90%',toggleActions:'play none none none',once:true}
            });
        });
        // Icon spin on scroll-in
        document.querySelectorAll('.fac .fic').forEach((icon,idx)=>{
            gsap.from(icon,{rotate:-180,scale:0,duration:.6,ease:'back.out(1.7)',delay:.15+idx*.08,
                scrollTrigger:{trigger:icon,start:'top 90%',toggleActions:'play none none none',once:true}});
        });
    })();

    // Stats section counter + cascade
    (function(){
        let statsDone=false;
        const statsOb=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting&&!statsDone){statsDone=true;
            document.querySelectorAll('.stat-card').forEach((card,idx)=>{
                const target=parseInt(card.dataset.target);
                const suffix=card.dataset.suffix;
                const numEl=card.querySelector('.stat-num');
                setTimeout(()=>{
                    card.classList.add('counted');
                    // GSAP number count-up
                    let val={n:0};
                    gsap.to(val,{n:target,duration:2,ease:'power2.out',
                        onUpdate:()=>{numEl.textContent=Math.round(val.n)+suffix;}});
                    // Card pop
                    gsap.from(card,{scale:.8,y:30,duration:.6,ease:'back.out(1.7)',delay:idx*.1});
                },idx*160);
            });
        }});},{threshold:.25});
        const firstStat=document.querySelector('.stat-card');
        if(firstStat) statsOb.observe(firstStat);

        // 3D tilt on stat cards — desktop only
        if(!isPhone){
            document.querySelectorAll('.stat-card').forEach(card=>{
                card.addEventListener('mousemove',e=>{const r=card.getBoundingClientRect();gsap.to(card,{rotateX:((e.clientY-r.top)/r.height-.5)*-10,rotateY:((e.clientX-r.left)/r.width-.5)*10,transformPerspective:600,scale:1.04,duration:.25,ease:'power2.out'});});
                card.addEventListener('mouseleave',()=>gsap.to(card,{rotateX:0,rotateY:0,scale:1,duration:.5,ease:'elastic.out(1,.4)'}));
            });
        }
    })();

    // ════════════════════════
    // ── SECTION: TOPPERS ──
    // ════════════════════════

    revealOnScroll('#toppers .text-xs.font-semibold',
        {from:{opacity:0,y:15},to:{opacity:.5,y:0,duration:.6,ease:'power2.out'}});
    revealOnScroll('#toppers h2',
        {from:{opacity:0,y:60},to:{opacity:1,y:0,duration:1,ease:'expo.out'}});

    (function(){
        const tcards = document.querySelectorAll('.tc');
        const ob=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){const d=e.target.style.animationDelay||'0s';setTimeout(()=>e.target.classList.add('rev'),parseFloat(d)*1000);ob.unobserve(e.target);}});},{threshold:.08});
        tcards.forEach((card,idx)=>{
            ob.observe(card);
            // Phone: bottom-up, Desktop: scattered entrance
            const xJitter = isPhone ? 0 : (Math.random()-.5)*30;
            gsap.from(card,{x:xJitter,y:isPhone?50:30,scale:.85,opacity:0,duration:.8,ease:'expo.out',delay:idx*.1,
                scrollTrigger:{trigger:card,start:'top 92%',toggleActions:'play none none none',once:true}});
        });

        // Avatar ring pulse on reveal
        document.querySelectorAll('.pr').forEach((pr,idx)=>{
            gsap.from(pr,{scale:0,opacity:0,rotation:180,duration:.7,ease:'back.out(2)',delay:.2+idx*.1,
                scrollTrigger:{trigger:pr,start:'top 90%',toggleActions:'play none none none',once:true}});
        });

        // Particle burst on hover (desktop only)
        if(!isPhone){
            tcards.forEach(card=>{
                card.addEventListener('mouseenter',()=>{
                    for(let p=0;p<8;p++){
                        const dot=document.createElement('div');
                        dot.style.cssText=`position:absolute;width:5px;height:5px;border-radius:50%;background:var(--g);pointer-events:none;z-index:20;left:50%;top:50%;`;
                        card.appendChild(dot);
                        const angle=Math.random()*Math.PI*2;
                        const dist=45+Math.random()*55;
                        gsap.to(dot,{x:Math.cos(angle)*dist,y:Math.sin(angle)*dist,opacity:0,scale:.2,duration:.7+Math.random()*.3,ease:'power2.out',onComplete:()=>dot.remove()});
                    }
                });
            });
        }

        // Touch-friendly: scale bounce on tap (phone)
        if(isPhone){
            tcards.forEach(card=>{
                card.addEventListener('touchstart',()=>gsap.to(card,{scale:.97,duration:.1,ease:'power2.in'}),{passive:true});
                card.addEventListener('touchend',()=>gsap.to(card,{scale:1,duration:.4,ease:'elastic.out(1,.5)'}),{passive:true});
            });
        }
    })();

    // ════════════════════════
    // ── SECTION: FACULTY ──
    // ════════════════════════

    revealOnScroll('#faculty .text-xs.font-semibold',
        {from:{opacity:0,y:15},to:{opacity:.5,y:0,duration:.6,ease:'power2.out'}});
    revealOnScroll('#faculty h2',
        {from:{opacity:0,y:60},to:{opacity:1,y:0,duration:1,ease:'expo.out'}});

    (function(){
        const fcards = document.querySelectorAll('.fc');
        const ob=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){const d=e.target.style.animationDelay||'0s';setTimeout(()=>e.target.classList.add('rev'),parseFloat(d)*1000);ob.unobserve(e.target);}});},{threshold:.1});
        fcards.forEach((card,idx)=>{
            ob.observe(card);
            // Phone: simple bottom-up; Desktop: alternating left/right + scale
            gsap.from(card,{
                x: isPhone ? 0 : (idx%2===0 ? -40 : 40),
                y: isPhone ? 50 : 20,
                opacity:0, scale:.9,
                duration:.75, ease:'power3.out', delay:idx*.09,
                scrollTrigger:{trigger:card,start:'top 91%',toggleActions:'play none none none',once:true}
            });
        });

        // Icon container spin-in
        document.querySelectorAll('.fii').forEach((icon,idx)=>{
            gsap.from(icon,{rotateY:90,scale:0,duration:.6,ease:'back.out(2)',delay:.15+idx*.1,
                scrollTrigger:{trigger:icon,start:'top 90%',toggleActions:'play none none none',once:true}});
        });

        // Skill badges slide in from left
        document.querySelectorAll('.fc .flex.flex-wrap span').forEach((badge,idx)=>{
            gsap.from(badge,{x:-20,opacity:0,duration:.4,ease:'power2.out',delay:.3+idx*.07,
                scrollTrigger:{trigger:badge,start:'top 93%',toggleActions:'play none none none',once:true}});
        });

        // 3D tilt — desktop only
        if(!isPhone){
            fcards.forEach(card=>{
                card.addEventListener('mousemove',e=>{
                    const r=card.getBoundingClientRect();
                    gsap.to(card,{rotateX:((e.clientY-r.top)/r.height-.5)*-12,rotateY:((e.clientX-r.left)/r.width-.5)*12,transformPerspective:700,duration:.3,ease:'power2.out'});
                    card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
                    card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
                });
                card.addEventListener('mouseleave',()=>gsap.to(card,{rotateX:0,rotateY:0,duration:.6,ease:'elastic.out(1,.4)'}));
            });
        }

        // Phone tap bounce
        if(isPhone){
            fcards.forEach(card=>{
                card.addEventListener('touchstart',()=>gsap.to(card,{scale:.97,duration:.1}),{passive:true});
                card.addEventListener('touchend',()=>gsap.to(card,{scale:1,duration:.4,ease:'elastic.out(1,.5)'}),{passive:true});
            });
        }
    })();

    // ═══════════════════════════════════════
    // ── SECTION: CONTACT & ENQUIRY FORM ──
    // ═══════════════════════════════════════

    revealOnScroll('#contact .text-xs.font-semibold',
        {from:{opacity:0,y:15},to:{opacity:.5,y:0,duration:.6,ease:'power2.out'}});
    revealOnScroll('#contact h2',
        {from:{opacity:0,y:60},to:{opacity:1,y:0,duration:1,ease:'expo.out'}});

    // Contact info box — slide from left
    (function(){
        const ccBox = document.querySelectorAll('.cc');
        gsap.from(ccBox[0],{x: isPhone ? 0 : -60, y: isPhone ? 40 : 0, opacity:0, duration:.9, ease:'power3.out',
            scrollTrigger:{trigger:ccBox[0],start:'top 85%',toggleActions:'play none none none',once:true}});

        // Contact info rows stagger
        document.querySelectorAll('.ci').forEach((el,i)=>{
            gsap.from(el,{x:-35,opacity:0,duration:.55,ease:'power3.out',delay:i*.12,
                scrollTrigger:{trigger:el,start:'top 90%',toggleActions:'play none none none',once:true}});
        });

        // Enquiry form box — slide from right
        if(ccBox[1]){
            gsap.from(ccBox[1],{x: isPhone ? 0 : 60, y: isPhone ? 40 : 0, opacity:0, duration:.9, ease:'power3.out',
                scrollTrigger:{trigger:ccBox[1],start:'top 85%',toggleActions:'play none none none',once:true}});
        }

        // Form inputs cascade down
        // Floating label — textarea has-val handler
        document.querySelectorAll('.fl-wrap textarea.form-input').forEach(ta=>{
            ta.addEventListener('input',()=>{
                ta.classList.toggle('has-val', ta.value.trim().length > 0);
            });
        });
        document.querySelectorAll('.form-input').forEach((inp,i)=>{
            gsap.from(inp,{y:25,opacity:0,duration:.5,ease:'power2.out',delay:.1+i*.1,
                scrollTrigger:{trigger:inp,start:'top 92%',toggleActions:'play none none none',once:true}});
            // Focus scale
            inp.addEventListener('focus',()=>gsap.to(inp,{scale:1.015,duration:.2,ease:'power2.out'}));
            inp.addEventListener('blur',()=>gsap.to(inp,{scale:1,duration:.3,ease:'power2.out'}));
        });

        // Submit button entrance
        const submitBtn=document.querySelector('.form-submit');
        if(submitBtn){
            gsap.from(submitBtn,{y:30,opacity:0,scale:.9,duration:.6,ease:'back.out(1.7)',delay:.5,
                scrollTrigger:{trigger:submitBtn,start:'top 93%',toggleActions:'play none none none',once:true}});

            // Ripple on click
            submitBtn.addEventListener('click',function(e){
                const ripple=document.createElement('div');
                const r=this.getBoundingClientRect();
                ripple.style.cssText=`position:absolute;border-radius:50%;background:rgba(42,35,24,.25);width:10px;height:10px;left:${e.clientX-r.left}px;top:${e.clientY-r.top}px;transform:translate(-50%,-50%);pointer-events:none;`;
                this.style.position='relative';this.style.overflow='hidden';
                this.appendChild(ripple);
                gsap.to(ripple,{scale:30,opacity:0,duration:.7,ease:'power2.out',onComplete:()=>ripple.remove()});
            });

            // Touch pulse on phone
            if(isPhone){
                submitBtn.addEventListener('touchstart',()=>gsap.to(submitBtn,{scale:.97,duration:.1}),{passive:true});
                submitBtn.addEventListener('touchend',()=>gsap.to(submitBtn,{scale:1,duration:.4,ease:'elastic.out(1,.5)'}),{passive:true});
            }
        }

        // Call + WA buttons entrance
        document.querySelectorAll('.cab,.cc .mbtn').forEach((btn,i)=>{
            gsap.from(btn,{y:20,opacity:0,scale:.9,duration:.5,ease:'back.out(1.7)',delay:.4+i*.15,
                scrollTrigger:{trigger:btn,start:'top 92%',toggleActions:'play none none none',once:true}});
        });
    })();

    // ─── FOOTER ───
    (function(){
        const footerEls = document.querySelectorAll('section:last-of-type .text-center p');
        footerEls.forEach((el,i)=>{
            gsap.from(el,{opacity:0,y:20,duration:.8,ease:'power2.out',delay:i*.2,
                scrollTrigger:{trigger:el,start:'top 95%',toggleActions:'play none none none',once:true}});
        });
    })();

    // ═══════════════════════════════
    // ── HORIZONTAL WAVE PARALLAX ──
    // (reduced on phone for perf)
    // ═══════════════════════════════
    if(!prefersReducedMotion){
        document.querySelectorAll('.wd').forEach(wd=>{
            gsap.to(wd,{
                scrollTrigger:{trigger:wd,start:'top bottom',end:'bottom top',scrub: isPhone ? 0.5 : 1.5},
                x: isPhone ? -10 : -30, ease:'none'
            });
        });
    }

    // ─── NAVBAR SCROLL ───
    window.addEventListener('scroll',()=>{
        const nb=document.getElementById('navbar');
        if(window.scrollY>80) nb.classList.add('scrolled'); else nb.classList.remove('scrolled');
        const bt=document.getElementById('btt');
        if(window.scrollY>600) bt.classList.add('show'); else bt.classList.remove('show');
    },{passive:true});

    // ─── SCROLL PROGRESS BAR ───
    window.addEventListener('scroll',()=>{
        const pct=(window.scrollY/(document.body.scrollHeight-window.innerHeight))*100;
        document.getElementById('sprog').style.width=pct+'%';
    },{passive:true});

    // ─── NAV LOGO GLITCH DATA ───
    const logo=document.querySelector('.nav-logo');
    if(logo) logo.setAttribute('data-text',logo.textContent);

    // ═══════════════════════════════════════════════
    // ─── SPLITTYPE — PREMIUM WORD-BY-WORD REVEALS ───
    // Replaces the plain gsap y-translate on h2 headings
    // ═══════════════════════════════════════════════
    // SplitType breaks gradient text so animating whole h2 instead
    if(!prefersReducedMotion){
        const splitHeadings = document.querySelectorAll('#teach h2, #why h2, #toppers h2, #faculty h2, #notice h2, #contact h2');
        splitHeadings.forEach(h2 => {
            if(h2.dataset.split) return;
            h2.dataset.split = '1';
            gsap.fromTo(h2,
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: .9, ease: 'expo.out',
                  scrollTrigger: { trigger: h2, start: 'top 88%', toggleActions: 'play none none none', once: true }
                }
            );
        });
    }

    // ═════════════════════════════════════════
    // ─── AMBIENT FLOATING DUST PARTICLES ────
    // One canvas per section, very subtle
    // ═════════════════════════════════════════
    (function(){
        const sectionIds = ['#teach','#why','#toppers','#faculty','#contact'];
        sectionIds.forEach(id => {
            const sec = document.querySelector(id);
            if(!sec) return;
            const c = document.createElement('canvas');
            c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.55;';
            sec.style.position = 'relative';
            sec.insertBefore(c, sec.firstChild);
            const ctx = c.getContext('2d');
            let w, h, particles = [];
            function resize(){ w = c.width = sec.offsetWidth; h = c.height = sec.offsetHeight; }
            resize();
            window.addEventListener('resize', resize, {passive:true});
            const COLORS = ['180,135,44','36,68,158','29,122,86'];
            for(let i=0;i<(isPhone?18:38);i++){
                particles.push({
                    x: Math.random()*1000, y: Math.random()*1000,
                    r: .8+Math.random()*2.2,
                    a: Math.random()*Math.PI*2,
                    sp: .12+Math.random()*.18,
                    col: COLORS[Math.floor(Math.random()*COLORS.length)],
                    op: .08+Math.random()*.18
                });
            }
            let raf, visible = false;
            const io = new IntersectionObserver(en => {
                visible = en[0].isIntersecting;
                if(visible && !raf) tick();
            }, {threshold:.01});
            io.observe(sec);
            function tick(){
                raf = requestAnimationFrame(tick);
                if(!visible){ raf=null; return; }
                ctx.clearRect(0,0,w,h);
                particles.forEach(p => {
                    p.y -= p.sp;
                    p.x += Math.sin(p.a)*0.25;
                    p.a += 0.006;
                    if(p.y < -10){ p.y = h+10; p.x = Math.random()*w; }
                    ctx.beginPath();
                    ctx.arc(p.x%w, p.y, p.r, 0, Math.PI*2);
                    ctx.fillStyle = `rgba(${p.col},${p.op})`;
                    ctx.fill();
                });
            }
        });
    })();

    // ═══════════════════════════════════
    // ─── SHEEN SWEEP ON CARD HOVER ───
    // Injects a traveling light-refraction
    // stripe across each card on mouseenter
    // ═══════════════════════════════════
    if(!isPhone){
        document.querySelectorAll('.fc,.fac,.tc,.yt-card,.cc').forEach(card => {
            let sheen = null;
            card.addEventListener('mouseenter', () => {
                if(sheen) return;
                sheen = document.createElement('div');
                sheen.style.cssText = `
                    position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:10;
                    overflow:hidden;
                `;
                const stripe = document.createElement('div');
                stripe.style.cssText = `
                    position:absolute;top:0;left:0;width:35%;height:100%;
                    background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.22) 50%,transparent 70%);
                    transform:translateX(-120%) skewX(-15deg);will-change:transform;
                `;
                sheen.appendChild(stripe);
                card.appendChild(sheen);
                gsap.to(stripe, {
                    x: '370%', duration: .65, ease: 'power2.inOut',
                    onComplete: () => { sheen && sheen.remove(); sheen = null; }
                });
            });
            card.addEventListener('mouseleave', () => { sheen && sheen.remove(); sheen = null; });
        });
    }

    // ─── CARDS: 3D TILT (desktop only, for yt-card & .cc) ───
    if(!isPhone){
        document.querySelectorAll('.yt-card,.cc').forEach(card=>{
            card.addEventListener('mousemove',e=>{
                const r=card.getBoundingClientRect();
                gsap.to(card,{rotateX:((e.clientY-r.top)/r.height-.5)*-12,rotateY:((e.clientX-r.left)/r.width-.5)*12,transformPerspective:700,duration:.3,ease:'power2.out'});
                card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
                card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
            });
            card.addEventListener('mouseleave',()=>gsap.to(card,{rotateX:0,rotateY:0,duration:.6,ease:'elastic.out(1,.4)'}));
        });
    }

    // ─── WHATSAPP FLOAT BUTTON BOUNCE ───
    gsap.set('.wa-float',{scale:0,opacity:0});
    gsap.to('.wa-float',{scale:1,opacity:1,duration:.6,ease:'back.out(2)',delay:3});
    gsap.to('.wa-float',{y:-6,duration:1.8,repeat:-1,yoyo:true,ease:'sine.inOut',delay:4,overwrite:false});

    gsap.set('.topper-float',{scale:0,opacity:0});
    gsap.to('.topper-float',{scale:1,opacity:1,duration:.6,ease:'back.out(2)',delay:3.3});
    gsap.to('.topper-float',{y:-6,duration:1.8,repeat:-1,yoyo:true,ease:'sine.inOut',delay:4.3,overwrite:false});

    // ─── FORM SUBMIT -> WHATSAPP ───
    const submitBtn2 = document.querySelector('.form-submit');
    document.getElementById('enquiryForm').addEventListener('submit',function(e){
        e.preventDefault();
        if(submitBtn2) gsap.fromTo(submitBtn2,{x:0},{x:[-4,4,-3,3,0],duration:.4,ease:'power1.inOut'});
        const name=this.elements[0].value;
        const phone=this.elements[1].value;
        const cls=this.elements[2].value;
        const msg=this.elements[3].value;
        let text=`Hi, I'm ${name}. I want to enquire about admission at Vrindavan Tutorials.\n\nClass: ${cls}\nPhone: ${phone}`;
        if(msg.trim()) text+=`\nMessage: ${msg}`;
        setTimeout(()=>window.open('https://wa.me/918707605144?text='+encodeURIComponent(text),'_blank'),350);
    });

    // ─── SUPABASE CONNECTION ───
    const SUPABASE_URL = 'https://ubhwmhiqmrhnuksjrqye.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_iTQYSDgtuFSi87sB1lnA-A_LxlSQYwj';
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ─── TEACHER AUTH (Supabase) ───
    function openTeacherAuth(){
        const modal=document.getElementById('teacherAuthModal');
        modal.style.display='flex';
        document.getElementById('teacherEmailInput').value='';
        document.getElementById('teacherCodeInput').value='';
        document.getElementById('teacherCodeError').textContent='';
        setTimeout(()=>document.getElementById('teacherEmailInput').focus(),100);
    }
    function closeTeacherAuth(){
        document.getElementById('teacherAuthModal').style.display='none';
    }
    async function verifyTeacherCode(){
        const email=document.getElementById('teacherEmailInput').value.trim();
        const password=document.getElementById('teacherCodeInput').value;
        const err=document.getElementById('teacherCodeError');
        const btn=document.getElementById('teacherLoginBtn');
        if(!email||!password){
            err.textContent='❌ Email aur password dono bharein';
            return;
        }
        btn.textContent='Logging in...';
        btn.disabled=true;
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        btn.textContent='Login →';
        btn.disabled=false;
        if(error){
            err.textContent='❌ '+error.message;
            const input=document.getElementById('teacherCodeInput');
            input.style.borderColor='rgba(178,59,59,.5)';
            input.style.animation='shake .4s ease';
            setTimeout(()=>{input.style.animation='';input.style.borderColor='rgba(59,49,104,.22)';},500);
        } else {
            document.getElementById('teacherAuthModal').style.display='none';
            document.getElementById('teacherPage').style.display='block';
            document.body.style.overflow='hidden';
        }
    }
    function closeTeacherPage(){
        document.getElementById('teacherPage').style.display='none';
        document.body.style.overflow='';
    }
    window.openTeacherAuth=openTeacherAuth;
    window.closeTeacherAuth=closeTeacherAuth;
    window.verifyTeacherCode=verifyTeacherCode;
    window.closeTeacherPage=closeTeacherPage;

    // ─── STUDENT AUTH ───

    const FEE_MAP = {'10':2000,'11':2500,'12':3000};
    const AC_MONTHS = ['APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','JAN','FEB','MAR'];
    const CAL_TO_AC_S = {0:9,1:10,2:11,3:0,4:1,5:2,6:3,7:4,8:5,9:6,10:7,11:8};
    const AVATAR_COLORS = [
        ['#1a4b2e','#1D7A56'],['#1a2e4b','#24449E'],['#3a1a4b','#3B3168'],
        ['#4b2a1a','#8A6118'],['#4b1a1a','#B23B3B'],
    ];

    function openStudentAuth(){
        document.getElementById('studentCodeInput').value='';
        document.getElementById('studentCodeError').textContent='';
        document.getElementById('studentAuthModal').style.display='flex';
        setTimeout(()=>document.getElementById('studentCodeInput').focus(),100);
    }

    function verifyStudentCode(){
        const code = document.getElementById('studentCodeInput').value.trim();
        const STORE = 'vt_fee_v3';
        const students = JSON.parse(localStorage.getItem(STORE)||'[]');
        const matched = students.find(s => s.code === code);
        if(!matched){
            const err = document.getElementById('studentCodeError');
            err.textContent = '🚫 You are not a student';
            document.getElementById('studentCodeInput').style.borderColor='rgba(178,59,59,.5)';
            setTimeout(()=>{
                document.getElementById('studentCodeInput').style.borderColor='rgba(36,68,158,.2)';
            },1000);
            return;
        }
        document.getElementById('studentAuthModal').style.display='none';
        openStudentDashboard(matched.id);
    }

    function openStudentDashboard(studentId){
        // Load student from localStorage
        const STORE = 'vt_fee_v3';
        const students = JSON.parse(localStorage.getItem(STORE)||'[]');
        const s = students.find(x=>x.id===studentId);
        if(!s){ alert('Student data not found!'); return; }

        const curAc = CAL_TO_AC_S[new Date().getMonth()];
        const fee = FEE_MAP[s.cls];
        const [bg,fg] = AVATAR_COLORS[(studentId-1) % AVATAR_COLORS.length];
        const initials = s.name.trim().split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join('');

        const paidMonths = AC_MONTHS.filter((_,i)=>s.fees[i]===true);
        const paidCount = paidMonths.length;
        // Due = only past + current unpaid
        let dueAmt = 0;
        for(let i=0;i<=curAc;i++){ if(!s.fees[i]) dueAmt += fee; }
        const totalPaid = paidCount * fee;

        // Warning if any past month unpaid
        const pastUnpaid = [];
        for(let i=0;i<curAc;i++){ if(!s.fees[i]) pastUnpaid.push(AC_MONTHS[i]); }

        const warningHtml = pastUnpaid.length ? `
        <div class="sp-warning">
            <div style="font-size:20px;">⚠️</div>
            <div>
                <div style="font-size:13px;font-weight:700;color:#B23B3B;margin-bottom:3px;">Fee Due!</div>
                <div style="font-size:12px;color:rgba(42,35,24,.5);">Months pending: <span style="color:#A66A2E;font-weight:600;">${pastUnpaid.join(', ')}</span></div>
            </div>
        </div>` : '';

        const monthRowsHtml = AC_MONTHS.map((m,i)=>{
            const paid = !!s.fees[i];
            const isFuture = i > curAc;
            let chipCls = paid ? 'sp-paid' : (isFuture ? 'sp-future' : 'sp-unpaid');
            let chipTxt = paid ? '✓ Paid' : (isFuture ? 'Upcoming' : '✕ Due');
            return `<div class="sp-month-row">
                <div>
                    <div class="sp-month-name">${m}</div>
                    <div class="sp-month-date">₹${fee.toLocaleString('en-IN')}</div>
                </div>
                <span class="sp-paid-chip ${chipCls}">${chipTxt}</span>
            </div>`;
        }).join('');

        document.getElementById('spBody').innerHTML = `
            <div class="sp-profile">
                <div class="sp-avatar" style="background:${bg};color:${fg};">${initials}</div>
                <div>
                    <div class="sp-name">${s.name}</div>
                    <div class="sp-meta">Class ${s.cls} &nbsp;·&nbsp; Roll #${s.roll} &nbsp;·&nbsp; ₹${fee.toLocaleString('en-IN')}/month</div>
                </div>
            </div>
            ${warningHtml}
            <div class="sp-stats">
                <div class="sp-stat">
                    <div class="sp-stat-val" style="color:#1D7A56;">₹${totalPaid.toLocaleString('en-IN')}</div>
                    <div class="sp-stat-lbl">Total Paid</div>
                </div>
                <div class="sp-stat">
                    <div class="sp-stat-val" style="color:${dueAmt>0?'#B23B3B':'#1D7A56'};">₹${dueAmt.toLocaleString('en-IN')}</div>
                    <div class="sp-stat-lbl">Total Due</div>
                </div>
                <div class="sp-stat">
                    <div class="sp-stat-val" style="color:#C9A227;">${paidCount}/12</div>
                    <div class="sp-stat-lbl">Months Paid</div>
                </div>
                <div class="sp-stat">
                    <div class="sp-stat-val" style="color:#24449E;">${12-paidCount}</div>
                    <div class="sp-stat-lbl">Months Left</div>
                </div>
            </div>
            <div class="sp-section-title">Fee History — 2025-26</div>
            <div class="sp-month-list">${monthRowsHtml}</div>
            ${dueAmt > 0
              ? `<button class="sp-pay-btn" id="spPayBtn" onclick="openPayModal(${studentId}, ${dueAmt})">💳 Pay Now — ₹${dueAmt.toLocaleString('en-IN')}</button>`
              : `<button class="sp-pay-btn" disabled>✅ All Fees Cleared</button>`
            }
            <button class="sp-receipt-btn" onclick="printReceipt(${studentId})">🧾 Download Fee Receipt</button>
        `;

        document.getElementById('studentPage').style.display='block';
        document.body.style.overflow='hidden';
        // Store current student id for receipt
        window._currentStudentId = studentId;
    }

    function closeStudentPage(){
        document.getElementById('studentPage').style.display='none';
        document.body.style.overflow='';
    }

    function printReceipt(studentId){
        const STORE = 'vt_fee_v3';
        const students = JSON.parse(localStorage.getItem(STORE)||'[]');
        const s = students.find(x=>x.id===studentId);
        if(!s) return;
        const fee = FEE_MAP[s.cls];
        const curAc = CAL_TO_AC_S[new Date().getMonth()];
        const paidList = AC_MONTHS.filter((_,i)=>s.fees[i]===true);
        const totalPaid = paidList.length * fee;
        let dueAmt = 0;
        for(let i=0;i<=curAc;i++){ if(!s.fees[i]) dueAmt += fee; }
        const today = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

        const receiptHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Fee Receipt - ${s.name}</title>
        <style>
            *{margin:0;padding:0;box-sizing:border-box;}
            body{font-family:'Arial',sans-serif;background:#fff;color:#000;padding:30px;}
            .receipt{max-width:500px;margin:0 auto;border:2px solid #000;border-radius:8px;overflow:hidden;}
            .r-header{background:#0a2a1a;color:var(--ink);padding:20px 24px;text-align:center;}
            .r-logo{font-size:24px;font-weight:900;color:#1D7A56;letter-spacing:1px;}
            .r-subtitle{font-size:12px;color:rgba(42,35,24,.6);margin-top:4px;}
            .r-title{background:#f0f9f4;border-bottom:1px solid #d0e8da;padding:12px 24px;text-align:center;font-size:16px;font-weight:700;color:#0a2a1a;letter-spacing:.05em;}
            .r-body{padding:20px 24px;}
            .r-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;}
            .r-row:last-child{border-bottom:none;}
            .r-label{color:#666;}
            .r-value{font-weight:700;color:#000;}
            .r-months{padding:12px 0;}
            .r-month-title{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#888;margin-bottom:8px;}
            .r-chips{display:flex;flex-wrap:wrap;gap:6px;}
            .r-chip{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#e8f8ee;color:#00854a;border:1px solid #b0dfc0;}
            .r-divider{border:none;border-top:2px dashed #ddd;margin:12px 0;}
            .r-total{display:flex;justify-content:space-between;font-size:15px;font-weight:900;padding:10px 0;}
            .r-due{display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding:6px 0;color:#cc2200;}
            .r-footer{background:#f9f9f9;border-top:1px solid #eee;padding:14px 24px;text-align:center;font-size:11px;color:#888;}
            .r-stamp{display:inline-block;border:2px solid #00854a;border-radius:6px;padding:4px 16px;color:#00854a;font-weight:900;font-size:12px;transform:rotate(-3deg);margin-top:8px;}
        </style></head><body>
        <div class="receipt">
            <div class="r-header">
                <div class="r-logo">🌿 Vrindavan Tutorials</div>
                <div class="r-subtitle">A New Era of Learning — Lucknow</div>
            </div>
            <div class="r-title">FEE RECEIPT</div>
            <div class="r-body">
                <div class="r-row"><span class="r-label">Receipt Date</span><span class="r-value">${today}</span></div>
                <div class="r-row"><span class="r-label">Student Name</span><span class="r-value">${s.name}</span></div>
                <div class="r-row"><span class="r-label">Class</span><span class="r-value">Class ${s.cls}</span></div>
                <div class="r-row"><span class="r-label">Roll Number</span><span class="r-value">#${s.roll}</span></div>
                <div class="r-row"><span class="r-label">Monthly Fee</span><span class="r-value">₹${fee.toLocaleString('en-IN')}</span></div>
                <hr class="r-divider">
                <div class="r-months">
                    <div class="r-month-title">Months Paid (${paidList.length}/12)</div>
                    <div class="r-chips">${paidList.map(m=>`<span class="r-chip">${m}</span>`).join('') || '<span style="color:#999;font-size:12px;">No payments yet</span>'}</div>
                </div>
                <hr class="r-divider">
                <div class="r-total"><span>Total Paid</span><span style="color:#00854a;">₹${totalPaid.toLocaleString('en-IN')}</span></div>
                <div class="r-due"><span>Balance Due</span><span>₹${dueAmt.toLocaleString('en-IN')}</span></div>
                ${dueAmt===0?'<div style="text-align:center;margin-top:10px;"><span class="r-stamp">✓ ALL CLEAR</span></div>':''}
            </div>
            <div class="r-footer">
                Vrindavan Tutorials · Lucknow · Contact: 8707605144<br>
                <span style="font-size:10px;">This is a computer-generated receipt.</span>
            </div>
        </div>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>`;

        const w = window.open('','_blank');
        w.document.write(receiptHTML);
        w.document.close();
    }

    // ─── UPI PAYMENT ───
    // ⚠️ IMPORTANT: Yeh default UPI ID hai jo Arpit ne diya — ise jaldi se apni asli
    // active UPI ID se update kar lo Teacher Dashboard ke "⚙️ UPI Settings" se,
    // ya neeche DEFAULT_UPI_ID variable seedha edit kar ke.
    const DEFAULT_UPI_ID = '7007814025@mbk';
    const UPI_STORE = 'vt_upi_id';
    const UPI_NAME_STORE = 'vt_upi_name';

    function getUpiId(){
        return localStorage.getItem(UPI_STORE) || DEFAULT_UPI_ID;
    }
    function getPayeeName(){
        return localStorage.getItem(UPI_NAME_STORE) || 'Vrindavan Tutorials';
    }

    function openPayModal(studentId, amount){
        if(amount <= 0){ return; }
        const upiId = getUpiId();
        const payeeName = getPayeeName();
        const txnNote = `Fee Payment - Student ID ${studentId}`;
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(txnNote)}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;

        document.getElementById('qrAmount').textContent = `₹${amount.toLocaleString('en-IN')}`;
        document.getElementById('qrImage').src = qrApiUrl;
        document.getElementById('qrUpiId').textContent = `UPI ID: ${upiId}`;
        document.getElementById('qrModal').style.display = 'flex';
        window._payingStudentId = studentId;
        window._payingAmount = amount;
    }

    function closeQrModal(){
        document.getElementById('qrModal').style.display = 'none';
    }

    function notifyTeacherPaid(){
        const STORE = 'vt_fee_v3';
        const students = JSON.parse(localStorage.getItem(STORE)||'[]');
        const s = students.find(x=>x.id === window._payingStudentId);
        if(!s) return;

        // Keep a local pending record too (works if teacher uses same device)
        const PENDING_KEY = 'vt_pending_payments';
        let pending = JSON.parse(localStorage.getItem(PENDING_KEY)||'[]');
        pending = pending.filter(p => p.studentId !== s.id);
        pending.push({studentId: s.id, name: s.name, time: new Date().toISOString()});
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

        const teacherPhone = localStorage.getItem('vt_teacher_phone');
        if(!teacherPhone){
            closeQrModal();
            alert('⚠️ Teacher has not set up their WhatsApp number yet. Please inform them directly about your payment.');
            return;
        }

        const amount = window._payingAmount || 0;
        const text = `Hi! 🙏\n\nI just paid my tuition fee via UPI.\n\n👤 Name: ${s.name}\n📚 Class: ${s.cls}\n💰 Amount Paid: ₹${amount.toLocaleString('en-IN')}\n\nPlease verify and update my fee status. Thank you! 🙏\n\n— Vrindavan Tutorials Fee System`;
        const waUrl = `https://wa.me/${teacherPhone}?text=${encodeURIComponent(text)}`;

        closeQrModal();
        window.open(waUrl, '_blank');
    }


    // ─── TALK TO A TOPPER (public flow) ───
    const TOPPER_STORE_2 = 'vt_toppers';
    const TOPPER_CODES_STORE_2 = 'vt_topper_codes';
    const TOPPER_REQUESTS_STORE_2 = 'vt_topper_requests';

    function openTopperCodeModal(){
        document.getElementById('topperCodeInput').value = '';
        document.getElementById('topperCodeError').textContent = '';
        document.getElementById('topperCodeModal').style.display = 'flex';
        setTimeout(()=>document.getElementById('topperCodeInput').focus(),100);
    }

    function closeTopperCodeModal(){
        document.getElementById('topperCodeModal').style.display = 'none';
    }

    function verifyTopperCode(){
        const code = document.getElementById('topperCodeInput').value.trim();
        const codes = JSON.parse(localStorage.getItem(TOPPER_CODES_STORE_2)||'{}');
        const entry = codes[code];
        const err = document.getElementById('topperCodeError');

        if(!entry){
            err.textContent = '🚫 Invalid code. Please check and try again.';
            return;
        }
        if(entry.used){
            err.textContent = '⚠️ This code has already been used.';
            return;
        }

        // Assign a random topper
        const toppers = JSON.parse(localStorage.getItem(TOPPER_STORE_2)||'[]');
        if(!toppers.length){
            err.textContent = '⚠️ No toppers available right now. Please contact us directly.';
            return;
        }
        const topper = toppers[Math.floor(Math.random()*toppers.length)];

        // Mark code as used + assigned
        entry.used = true;
        entry.topperId = topper.id;
        codes[code] = entry;
        localStorage.setItem(TOPPER_CODES_STORE_2, JSON.stringify(codes));

        closeTopperCodeModal();
        showAssignedTopper(topper, code);
    }

    function showAssignedTopper(topper, code){
        const initials = topper.name.trim().split(' ').slice(0,2).map(w=>w[0].toUpperCase()).join('');
        document.getElementById('tpBody').innerHTML = `
            <div class="tp-badge">✨ Topper Assigned</div>
            <div class="tp-avatar" style="background:rgba(180,135,44,.12);color:#C9A227;">${initials}</div>
            <div class="tp-name">${topper.name}</div>
            <div class="tp-meta">Your assigned topper for a 1-on-1 conversation</div>
            <div class="tp-achievement">
                <div class="tp-achievement-title">Achievement</div>
                <div class="tp-achievement-text">🏆 ${topper.achievement}</div>
            </div>
            <div class="tp-form" id="tpRequestForm">
                <h4>📞 Request a Call</h4>
                <input class="tp-input" id="tpReqName" placeholder="Your Full Name">
                <input class="tp-input" id="tpReqPhone" placeholder="Your Phone Number" type="tel">
                <button class="tp-submit-btn" onclick="submitTopperRequest(${topper.id}, '${code}')">Request Call from ${topper.name}</button>
                <div class="tp-note">🔒 For privacy, the topper's number is not shared directly. Submit your request and they'll reach out to you personally.</div>
            </div>
            <div class="tp-success" id="tpSuccessBox">
                <div style="font-size:32px;margin-bottom:10px;">✅</div>
                <div style="font-size:15px;font-weight:700;color:#1D7A56;margin-bottom:6px;">Request Sent!</div>
                <div style="font-size:13px;color:#7A6F5C;">${topper.name} will call you soon. Thank you!</div>
            </div>
        `;
        document.getElementById('topperAssignedPage').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function submitTopperRequest(topperId, code){
        const name = document.getElementById('tpReqName').value.trim();
        const phone = document.getElementById('tpReqPhone').value.trim();
        if(!name || !phone){
            alert('Please fill in your name and phone number.');
            return;
        }
        let requests = JSON.parse(localStorage.getItem(TOPPER_REQUESTS_STORE_2)||'[]');
        requests.push({code, studentName: name, studentPhone: phone, topperId, time: new Date().toISOString()});
        localStorage.setItem(TOPPER_REQUESTS_STORE_2, JSON.stringify(requests));

        document.getElementById('tpRequestForm').style.display = 'none';
        document.getElementById('tpSuccessBox').style.display = 'block';
    }

    function closeTopperAssignedPage(){
        document.getElementById('topperAssignedPage').style.display = 'none';
        document.body.style.overflow = '';
    }

    window.openTopperCodeModal = openTopperCodeModal;
    window.closeTopperCodeModal = closeTopperCodeModal;
    window.verifyTopperCode = verifyTopperCode;
    window.submitTopperRequest = submitTopperRequest;
    window.closeTopperAssignedPage = closeTopperAssignedPage;

    window.openStudentAuth = openStudentAuth;
    window.verifyStudentCode = verifyStudentCode;
    window.closeStudentPage = closeStudentPage;
    window.printReceipt = printReceipt;
    window.openPayModal = openPayModal;
    window.closeQrModal = closeQrModal;
    window.notifyTeacherPaid = notifyTeacherPaid;

}); // end DOMContentLoaded
