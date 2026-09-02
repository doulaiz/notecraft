(function(){
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ============ Pitch / staff geometry ============ */
  const NATURAL_STEPS = [
    {letter:'C', st:0},{letter:'D', st:2},{letter:'E', st:4},{letter:'F', st:5},
    {letter:'G', st:7},{letter:'A', st:9},{letter:'B', st:11}
  ];
  function buildNaturalScale(minMidi,maxMidi){
    const arr=[];
    for(let oct=-1; oct<=9; oct++){
      for(const s of NATURAL_STEPS){
        const midi=(oct+1)*12+s.st;
        if(midi>=minMidi && midi<=maxMidi) arr.push({midi, name:s.letter+oct});
      }
    }
    return arr;
  }
  const NATURAL_SCALE = buildNaturalScale(24,108);
  function findScaleIndex(midi){ return NATURAL_SCALE.findIndex(n=>n.midi===midi); }
  const TREBLE_BOTTOM_IDX = findScaleIndex(64); // E4
  const BASS_BOTTOM_IDX = findScaleIndex(43);   // G2
  const POS_MIN=-8, POS_MAX=16;

  function getNoteForPosition(clef,posIndex){
    const base = clef==='treble'?TREBLE_BOTTOM_IDX:BASS_BOTTOM_IDX;
    const idx = Math.max(0, Math.min(NATURAL_SCALE.length-1, base+posIndex));
    return NATURAL_SCALE[idx];
  }

  const gap=14, staffTopY=100, staffBottomY=staffTopY+4*gap, SVG_HEIGHT=270;
  const KEYSIG_X=132, KEYSIG_SLOT=10, KEYSIG_MAX=7;
  const STAFF_START_X=KEYSIG_X+KEYSIG_MAX*KEYSIG_SLOT+18, NOTE_SPACING=64;
  function yForPos(pos){ return staffBottomY - pos*(gap/2); }

  /* ============ Key signature ============ */
  const ORDER_SHARPS = ['F','C','G','D','A','E','B'];
  const ORDER_FLATS  = ['B','E','A','D','G','C','F'];
  const SHARP_KEY_NAMES = ['C','G','D','A','E','B','F♯','C♯'];
  const FLAT_KEY_NAMES  = ['C','F','B♭','E♭','A♭','D♭','G♭','C♭'];

  function keySigLetterPos(clef, letter){
    for(let p=0;p<=8;p++){
      if(getNoteForPosition(clef,p).name[0]===letter) return p;
    }
    return 4;
  }
  function isSharpedLetter(letter){
    return state.keySig>0 && ORDER_SHARPS.slice(0,state.keySig).includes(letter);
  }
  function isFlattedLetter(letter){
    return state.keySig<0 && ORDER_FLATS.slice(0,-state.keySig).includes(letter);
  }
  function getEffectiveMidi(clef,note){
    const base = getNoteForPosition(clef,note.posIndex);
    // an accidental drawn directly on the note overrides the key signature
    if(note.accidental===1) return base.midi+1;
    if(note.accidental===-1) return base.midi-1;
    const letter = base.name[0];
    if(isSharpedLetter(letter)) return base.midi+1;
    if(isFlattedLetter(letter)) return base.midi-1;
    return base.midi;
  }

  function getLedgerPositions(pos){
    const out=[];
    if(pos<=-2){
      const pEven = (pos%2===0)?pos:pos-1;
      for(let p=-2;p>=pEven;p-=2) out.push(p);
    } else if(pos>=10){
      const pEven = (pos%2===0)?pos:pos+1;
      for(let p=10;p<=pEven;p+=2) out.push(p);
    }
    return out;
  }

  /* ============ State ============ */
  let state = {
    clef:'treble',
    timeSig:[4,4],
    keySig:0, // positive = number of sharps, negative = number of flats
    bpm:120,
    instrument:'synthlead',
    notes:[] // {id, posIndex, duration}
  };
  let currentTitle = '';
  let uidCounter=1;
  function uid(){ return 'n'+(uidCounter++)+'_'+Date.now().toString(36); }

  const ORDER = ['q','h','w','e','qr','hr'];
  function beatsForDuration(d){
    switch(d){case 'q':return 1;case 'h':return 2;case 'w':return 4;case 'e':return 0.5;
      case 'qr':return 1;case 'hr':return 2; default:return 1;}
  }

  /* ============ DOM refs ============ */
  const svg = document.getElementById('staffSvg');
  const staffScroll = document.getElementById('staffScroll');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  const tempoSlider = document.getElementById('tempoSlider');
  const tempoValue = document.getElementById('tempoValue');
  const instrumentSelect = document.getElementById('instrumentSelect');
  const saveSheetBtn = document.getElementById('saveSheetBtn');
  const mySheetsBtn = document.getElementById('mySheetsBtn');
  const exportMidiBtn = document.getElementById('exportMidiBtn');
  const newSheetBtn = document.getElementById('newSheetBtn');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn = document.getElementById('stopBtn');

  const modalBackdrop = document.getElementById('modalBackdrop');
  const clefModal = document.getElementById('clefModal');
  const timeSigModal = document.getElementById('timeSigModal');
  const keySigModal = document.getElementById('keySigModal');
  const keySigOptions = document.getElementById('keySigOptions');
  const saveModal = document.getElementById('saveModal');
  const sheetsModal = document.getElementById('sheetsModal');
  const saveTitleInput = document.getElementById('saveTitleInput');
  const saveConfirmBtn = document.getElementById('saveConfirmBtn');
  const sheetsList = document.getElementById('sheetsList');

  /* ============ Drawer ============ */
  function openDrawer(){ drawer.classList.add('open'); overlay.classList.remove('hidden'); }
  function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.add('hidden'); }
  hamburgerBtn.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', ()=>{ closeDrawer(); closeAllModals(); });

  /* ============ Modal helpers ============ */
  function openModal(modal){
    modalBackdrop.classList.remove('hidden');
    modal.classList.remove('hidden');
  }
  function closeAllModals(){
    modalBackdrop.classList.add('hidden');
    [clefModal,timeSigModal,keySigModal,saveModal,sheetsModal].forEach(m=>m.classList.add('hidden'));
  }
  modalBackdrop.addEventListener('click', closeAllModals);
  document.querySelectorAll('[data-close]').forEach(btn=>{
    btn.addEventListener('click', closeAllModals);
  });

  clefModal.querySelectorAll('.modal-option').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.clef = btn.dataset.clef;
      closeAllModals();
      renderStaff();
    });
  });
  timeSigModal.querySelectorAll('.modal-option').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [n,d] = btn.dataset.sig.split(',').map(Number);
      state.timeSig=[n,d];
      closeAllModals();
      renderStaff();
    });
  });

  function buildKeySigOptions(){
    const opts = [{label:'No sharps or flats (C / Am)', value:0}];
    for(let s=1;s<=7;s++) opts.push({label: s+' sharp'+(s>1?'s':'')+' — '+SHARP_KEY_NAMES[s]+' major', value:s});
    for(let f=1;f<=7;f++) opts.push({label: f+' flat'+(f>1?'s':'')+' — '+FLAT_KEY_NAMES[f]+' major', value:-f});
    keySigOptions.innerHTML='';
    opts.forEach(opt=>{
      const btn = document.createElement('button');
      btn.className='modal-option';
      btn.textContent = opt.label;
      if(opt.value===state.keySig) btn.style.background='var(--accent)';
      btn.addEventListener('click', ()=>{
        state.keySig = opt.value;
        closeAllModals();
        renderStaff();
      });
      keySigOptions.appendChild(btn);
    });
  }

  /* ============ Tempo / instrument ============ */
  tempoSlider.addEventListener('input', ()=>{
    state.bpm = parseInt(tempoSlider.value,10);
    tempoValue.textContent = state.bpm;
  });
  instrumentSelect.addEventListener('change', ()=>{
    state.instrument = instrumentSelect.value;
  });
  function syncControlsFromState(){
    tempoSlider.value = state.bpm;
    tempoValue.textContent = state.bpm;
    instrumentSelect.value = state.instrument;
  }

  /* ============ Save / Load / Delete ============ */
  const STORAGE_KEY = 'notecraft_sheets_v1';
  function getSheets(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]; }catch(e){ return []; } }
  function setSheets(sheets){ localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets)); }

  saveSheetBtn.addEventListener('click', ()=>{
    saveTitleInput.value = currentTitle || '';
    openModal(saveModal);
    setTimeout(()=>saveTitleInput.focus(), 50);
  });
  saveConfirmBtn.addEventListener('click', ()=>{
    const title = saveTitleInput.value.trim();
    if(!title){ saveTitleInput.focus(); return; }
    const sheets = getSheets();
    const sheet = {
      id: 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      title, clef: state.clef, timeSig: state.timeSig, keySig: state.keySig, bpm: state.bpm,
      instrument: state.instrument,
      notes: state.notes.map(n=>({posIndex:n.posIndex, duration:n.duration, accidental:n.accidental||0})),
      savedAt: new Date().toISOString()
    };
    sheets.unshift(sheet);
    setSheets(sheets);
    currentTitle = title;
    closeAllModals();
    closeDrawer();
  });

  mySheetsBtn.addEventListener('click', ()=>{
    renderSheetsList();
    openModal(sheetsModal);
  });

  function renderSheetsList(){
    const sheets = getSheets();
    sheetsList.innerHTML='';
    if(sheets.length===0){
      sheetsList.innerHTML = '<div class="empty-note">No saved sheets yet.</div>';
      return;
    }
    sheets.forEach(sheet=>{
      const row = document.createElement('div');
      row.className='sheet-item';
      const date = new Date(sheet.savedAt);
      row.innerHTML = `
        <div class="meta">
          <strong>${escapeHtml(sheet.title)}</strong>
          <span>${sheet.clef==='treble'?'Treble':'Bass'} &middot; ${sheet.timeSig[0]}/${sheet.timeSig[1]} &middot; ${sheet.bpm} BPM &middot; ${date.toLocaleDateString()}</span>
        </div>
        <div class="actions">
          <button class="load-btn">Load</button>
          <button class="del-btn">Del</button>
        </div>`;
      row.querySelector('.load-btn').addEventListener('click', ()=>{
        loadSheet(sheet.id);
        closeAllModals();
        closeDrawer();
      });
      row.querySelector('.del-btn').addEventListener('click', ()=>{
        if(confirm('Delete "'+sheet.title+'"?')){
          deleteSheet(sheet.id);
          renderSheetsList();
        }
      });
      sheetsList.appendChild(row);
    });
  }

  function loadSheet(id){
    const sheet = getSheets().find(s=>s.id===id);
    if(!sheet) return;
    stopPlayback();
    state.clef = sheet.clef;
    state.timeSig = sheet.timeSig;
    state.keySig = sheet.keySig || 0;
    state.bpm = sheet.bpm;
    state.instrument = sheet.instrument;
    state.notes = sheet.notes.map(n=>({id:uid(), posIndex:n.posIndex, duration:n.duration, accidental:n.accidental||0}));
    currentTitle = sheet.title;
    syncControlsFromState();
    renderStaff();
  }
  function deleteSheet(id){
    setSheets(getSheets().filter(s=>s.id!==id));
  }

  newSheetBtn.addEventListener('click', ()=>{
    if(state.notes.length===0 || confirm('Start a new sheet? Unsaved changes will be lost.')){
      stopPlayback();
      state.notes=[];
      currentTitle='';
      renderStaff();
      closeDrawer();
    }
  });

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ============ Layout & render ============ */
  function layoutNotes(){
    state.notes.forEach((n,i)=>{ n.x = STAFF_START_X + i*NOTE_SPACING; });
  }

  function renderStaff(){
    layoutNotes();
    const width = Math.max(staffScroll.clientWidth||320, STAFF_START_X + state.notes.length*NOTE_SPACING + 100);
    svg.setAttribute('viewBox', '0 0 '+width+' '+SVG_HEIGHT);
    svg.setAttribute('width', width);
    svg.setAttribute('height', SVG_HEIGHT);
    svg.innerHTML='';

    const bg = document.createElementNS(SVGNS,'rect');
    bg.setAttribute('x',0); bg.setAttribute('y',0);
    bg.setAttribute('width',width); bg.setAttribute('height',SVG_HEIGHT);
    bg.setAttribute('fill','transparent');
    bg.setAttribute('class','staff-bg');
    svg.appendChild(bg);

    for(let i=0;i<5;i++){
      const y = staffTopY + i*gap;
      const line = document.createElementNS(SVGNS,'line');
      line.setAttribute('x1',20); line.setAttribute('x2', width-16);
      line.setAttribute('y1',y); line.setAttribute('y2',y);
      line.setAttribute('class','staff-line');
      svg.appendChild(line);
    }

    // Clef
    const clefG = document.createElementNS(SVGNS,'g');
    clefG.setAttribute('class','clef-hit');
    const clefText = document.createElementNS(SVGNS,'text');
    clefText.setAttribute('x',40);
    clefText.setAttribute('text-anchor','middle');
    clefText.setAttribute('dominant-baseline','central');
    if(state.clef==='treble'){
      // G4 line (2nd from bottom) is where the treble clef's swirl wraps
      clefText.setAttribute('y', staffTopY + gap*3);
      clefText.setAttribute('class','clef-symbol');
    } else {
      // F3 line (2nd from top) is where the bass clef's two dots straddle
      clefText.setAttribute('y', staffTopY + gap);
      clefText.setAttribute('class','clef-symbol bass');
    }
    clefText.textContent = state.clef==='treble' ? '\u{1D11E}' : '\u{1D122}';
    clefG.appendChild(clefText);
    const clefHit = document.createElementNS(SVGNS,'rect');
    clefHit.setAttribute('x',6); clefHit.setAttribute('y', staffTopY-45);
    clefHit.setAttribute('width',70); clefHit.setAttribute('height', gap*4+95);
    clefHit.setAttribute('fill','transparent');
    clefG.appendChild(clefHit);
    svg.appendChild(clefG);

    // Time signature
    const tsG = document.createElementNS(SVGNS,'g');
    tsG.setAttribute('class','timesig-hit');
    const [num,den] = state.timeSig;
    const tsNum = document.createElementNS(SVGNS,'text');
    tsNum.setAttribute('x',100); tsNum.setAttribute('y', staffTopY+gap*2-1);
    tsNum.setAttribute('class','timesig-symbol');
    tsNum.textContent = num;
    const tsDen = document.createElementNS(SVGNS,'text');
    tsDen.setAttribute('x',100); tsDen.setAttribute('y', staffTopY+gap*4+3);
    tsDen.setAttribute('class','timesig-symbol');
    tsDen.textContent = den;
    const tsHit = document.createElementNS(SVGNS,'rect');
    tsHit.setAttribute('x',82); tsHit.setAttribute('y', staffTopY-10);
    tsHit.setAttribute('width',44); tsHit.setAttribute('height', gap*4+20);
    tsHit.setAttribute('fill','transparent');
    tsG.appendChild(tsNum); tsG.appendChild(tsDen); tsG.appendChild(tsHit);
    svg.appendChild(tsG);

    // Key signature (click to add sharps/flats)
    const ksG = document.createElementNS(SVGNS,'g');
    ksG.setAttribute('class','keysig-hit');
    const activeLetters = state.keySig>0 ? ORDER_SHARPS.slice(0,state.keySig)
                        : state.keySig<0 ? ORDER_FLATS.slice(0,-state.keySig)
                        : [];
    const ksSymbol = state.keySig>0 ? '♯' : '♭';
    activeLetters.forEach((letter,i)=>{
      const kp = keySigLetterPos(state.clef, letter);
      const kx = KEYSIG_X + i*KEYSIG_SLOT;
      const ky = yForPos(kp);
      const kt = document.createElementNS(SVGNS,'text');
      kt.setAttribute('x', kx); kt.setAttribute('y', ky);
      kt.setAttribute('text-anchor','middle');
      kt.setAttribute('dominant-baseline','central');
      kt.setAttribute('class','keysig-symbol');
      kt.textContent = ksSymbol;
      ksG.appendChild(kt);
    });
    const ksHit = document.createElementNS(SVGNS,'rect');
    ksHit.setAttribute('x', 128); ksHit.setAttribute('y', staffTopY-20);
    ksHit.setAttribute('width', STAFF_START_X-128-4); ksHit.setAttribute('height', gap*4+40);
    ksHit.setAttribute('fill','transparent');
    ksG.appendChild(ksHit);
    svg.appendChild(ksG);

    // Measure barlines (grouped according to the time signature)
    const measureLenBeats = num * (4/den);
    let cumBeats = 0;
    const EPS = 1e-6;
    state.notes.forEach((note,i)=>{
      cumBeats += beatsForDuration(note.duration);
      while(cumBeats >= measureLenBeats - EPS){
        cumBeats -= measureLenBeats;
        if(i === state.notes.length-1) break; // final barline covers the very end already
        const mbX = note.x + NOTE_SPACING/2;
        const mbar = document.createElementNS(SVGNS,'line');
        mbar.setAttribute('x1', mbX); mbar.setAttribute('x2', mbX);
        mbar.setAttribute('y1', staffTopY); mbar.setAttribute('y2', staffBottomY);
        mbar.setAttribute('class','measure-bar');
        svg.appendChild(mbar);
      }
    });

    // Notes / rests
    state.notes.forEach(note=>{
      svg.appendChild(renderNoteGroup(note));
    });

    // End barline
    const barX = STAFF_START_X + state.notes.length*NOTE_SPACING + 20;
    const bar1 = document.createElementNS(SVGNS,'line');
    bar1.setAttribute('x1',barX); bar1.setAttribute('x2',barX);
    bar1.setAttribute('y1',staffTopY); bar1.setAttribute('y2',staffBottomY);
    bar1.setAttribute('class','end-bar'); bar1.setAttribute('stroke-width','1.4');
    svg.appendChild(bar1);
    const bar2 = document.createElementNS(SVGNS,'line');
    bar2.setAttribute('x1',barX+6); bar2.setAttribute('x2',barX+6);
    bar2.setAttribute('y1',staffTopY); bar2.setAttribute('y2',staffBottomY);
    bar2.setAttribute('class','end-bar'); bar2.setAttribute('stroke-width','3');
    svg.appendChild(bar2);
  }

  function renderNoteGroup(note){
    const isRest = note.duration==='qr'||note.duration==='hr';
    const g = document.createElementNS(SVGNS,'g');
    g.setAttribute('class', isRest?'rest':'note');
    g.setAttribute('data-id', note.id);
    drawNoteVisual(g, note);
    attachNoteEvents(g, note);
    return g;
  }

  function drawNoteVisual(g, note){
    while(g.firstChild) g.removeChild(g.firstChild);
    const isRest = note.duration==='qr'||note.duration==='hr';
    const x = note.x;

    if(isRest){
      const y = yForPos(4); // float at middle line
      if(note.duration==='qr'){
        const p = document.createElementNS(SVGNS,'path');
        const d = `M ${x-3} ${y-10}
                   C ${x+7} ${y-2}, ${x-6} ${y+2}, ${x+4} ${y+8}
                   C ${x-4} ${y+4}, ${x+2} ${y-4}, ${x-3} ${y-10} Z`;
        p.setAttribute('d', d);
        p.setAttribute('class','rest-shape');
        g.appendChild(p);
      } else { // half rest: block sitting on middle line
        const r = document.createElementNS(SVGNS,'rect');
        r.setAttribute('x', x-7); r.setAttribute('y', y-6);
        r.setAttribute('width',14); r.setAttribute('height',6);
        r.setAttribute('class','rest-shape');
        g.appendChild(r);
        const ln = document.createElementNS(SVGNS,'line');
        ln.setAttribute('x1',x-9); ln.setAttribute('x2',x+9);
        ln.setAttribute('y1',y); ln.setAttribute('y2',y);
        ln.setAttribute('class','staff-line');
        g.appendChild(ln);
      }
    } else {
      const pos = note.posIndex;
      const y = yForPos(pos);

      // ledger lines
      getLedgerPositions(pos).forEach(p=>{
        const ly = yForPos(p);
        const ledger = document.createElementNS(SVGNS,'line');
        ledger.setAttribute('x1', x-11); ledger.setAttribute('x2', x+11);
        ledger.setAttribute('y1', ly); ledger.setAttribute('y2', ly);
        ledger.setAttribute('class','ledger-line');
        g.appendChild(ledger);
      });

      if(note.accidental){
        const acc = document.createElementNS(SVGNS,'text');
        acc.setAttribute('x', x-13); acc.setAttribute('y', y);
        acc.setAttribute('text-anchor','middle');
        acc.setAttribute('dominant-baseline','central');
        acc.setAttribute('class','note-accidental');
        acc.textContent = note.accidental===1 ? '♯' : '♭';
        g.appendChild(acc);
      }

      const hollow = (note.duration==='h' || note.duration==='w');
      const head = document.createElementNS(SVGNS,'ellipse');
      head.setAttribute('cx', x); head.setAttribute('cy', y);
      head.setAttribute('rx', 7.5); head.setAttribute('ry', 5.5);
      head.setAttribute('transform', `rotate(-18 ${x} ${y})`);
      head.setAttribute('class', 'note-head'+(hollow?' hollow':''));
      g.appendChild(head);

      if(note.duration!=='w'){
        const stemUp = pos <= 4;
        const stemX = stemUp ? x+7 : x-7;
        const stemY1 = y;
        const stemY2 = stemUp ? y-34 : y+34;
        const stem = document.createElementNS(SVGNS,'line');
        stem.setAttribute('x1', stemX); stem.setAttribute('x2', stemX);
        stem.setAttribute('y1', stemY1); stem.setAttribute('y2', stemY2);
        stem.setAttribute('class','note-stem');
        g.appendChild(stem);

        if(note.duration==='e'){
          const flag = document.createElementNS(SVGNS,'path');
          const fy = stemY2;
          const d = stemUp
            ? `M ${stemX} ${fy} C ${stemX+10} ${fy+4}, ${stemX+12} ${fy+14}, ${stemX+2} ${fy+20} C ${stemX+9} ${fy+12}, ${stemX+7} ${fy+6}, ${stemX} ${fy+8} Z`
            : `M ${stemX} ${fy} C ${stemX+10} ${fy-4}, ${stemX+12} ${fy-14}, ${stemX+2} ${fy-20} C ${stemX+9} ${fy-12}, ${stemX+7} ${fy-6}, ${stemX} ${fy-8} Z`;
          flag.setAttribute('d', d);
          flag.setAttribute('class','note-flag');
          g.appendChild(flag);
        }
      }
    }
  }

  /* ============ Note interaction ============ */
  function cycleNote(id){
    const note = state.notes.find(n=>n.id===id);
    if(!note) return;
    const idx = ORDER.indexOf(note.duration);
    if(idx === ORDER.length-1){
      state.notes = state.notes.filter(n=>n.id!==id);
    } else {
      note.duration = ORDER[idx+1];
    }
    renderStaff();
  }

  const LONG_PRESS_MS = 1000;

  function attachNoteEvents(g, note){
    let dragging=false, moved=false, startClientY=0;
    let longPressTimer=null, chromaMode=false, suppressClick=false;
    const canDrag = note.duration==='q'||note.duration==='h'||note.duration==='w'||note.duration==='e';

    function clearLongPressTimer(){
      if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer=null; }
    }
    function resetInteractionState(){
      clearLongPressTimer();
      g.classList.remove('chroma-active');
      dragging=false; moved=false; chromaMode=false; suppressClick=false;
    }

    g.addEventListener('pointerdown', (e)=>{
      e.stopPropagation();
      try{ g.setPointerCapture(e.pointerId); }catch(err){}
      startClientY = e.clientY;
      moved=false;
      chromaMode=false;
      suppressClick=false;
      dragging = canDrag;
      if(canDrag){
        longPressTimer = setTimeout(()=>{
          longPressTimer=null;
          chromaMode=true;
          suppressClick=true;
          g.classList.add('chroma-active');
        }, LONG_PRESS_MS);
      }
    });
    g.addEventListener('pointermove', (e)=>{
      if(!dragging) return;
      const dy = e.clientY - startClientY;

      if(chromaMode){
        // Held still past the long-press threshold: move up/down a half-step (sharp/flat) instead of a diatonic step
        moved = true;
        let newAcc = 0;
        if(dy <= -6) newAcc = 1;
        else if(dy >= 6) newAcc = -1;
        if(newAcc !== note.accidental){
          note.accidental = newAcc;
          drawNoteVisual(g, note);
          g.classList.add('chroma-active');
        }
        return;
      }

      if(Math.abs(dy) > 4){
        moved = true;
        clearLongPressTimer(); // real movement before the hold elapsed: normal diatonic drag, not a long-press
      }
      if(moved){
        const rect = svg.getBoundingClientRect();
        const scaleY = rect.height ? (SVG_HEIGHT/rect.height) : 1;
        const mouseY = (e.clientY - rect.top) * scaleY;
        let newPos = Math.round((staffBottomY - mouseY)/(gap/2));
        newPos = Math.max(POS_MIN, Math.min(POS_MAX, newPos));
        if(newPos !== note.posIndex){
          note.posIndex = newPos;
          drawNoteVisual(g, note);
        }
      }
    });
    g.addEventListener('pointerup', (e)=>{
      e.stopPropagation();
      try{ g.releasePointerCapture(e.pointerId); }catch(err){}
      clearLongPressTimer();
      g.classList.remove('chroma-active');
      if(chromaMode || (dragging && moved)){
        renderStaff();
      } else if(!moved && !suppressClick){
        cycleNote(note.id);
      }
      dragging=false; moved=false; chromaMode=false; suppressClick=false;
    });
    g.addEventListener('pointercancel', resetInteractionState);
  }

  let bgDown = null;
  let lastBgTap = {time:0,x:0,y:0};
  (function attachBackgroundHandler(){
    svg.addEventListener('pointerdown', (e)=>{
      if(e.target.classList && e.target.classList.contains('staff-bg')){
        bgDown = {x:e.clientX, y:e.clientY};
      } else {
        bgDown = null;
      }
    });
    svg.addEventListener('pointerup', (e)=>{
      if(!(e.target.classList && e.target.classList.contains('staff-bg'))) return;
      if(!bgDown) return;
      const movedDist = Math.hypot(e.clientX-bgDown.x, e.clientY-bgDown.y);
      bgDown = null;
      if(movedDist > 12) return; // was a pan/scroll, not a tap

      const now = Date.now();
      const dx = Math.abs(e.clientX-lastBgTap.x), dy = Math.abs(e.clientY-lastBgTap.y);
      if(now - lastBgTap.time < 420 && dx < 25 && dy < 25){
        placeNoteAtPoint(e);
        lastBgTap = {time:0,x:0,y:0};
      } else {
        lastBgTap = {time:now, x:e.clientX, y:e.clientY};
      }
    });

    svg.addEventListener('click', (e)=>{
      if(e.target.closest && e.target.closest('.clef-hit')){ openModal(clefModal); return; }
      if(e.target.closest && e.target.closest('.timesig-hit')){ openModal(timeSigModal); return; }
      if(e.target.closest && e.target.closest('.keysig-hit')){ buildKeySigOptions(); openModal(keySigModal); return; }
    });
  })();

  function placeNoteAtPoint(e){
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width ? (svg.viewBox.baseVal.width/rect.width) : 1;
    const scaleY = rect.height ? (SVG_HEIGHT/rect.height) : 1;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    if(localX < STAFF_START_X - 20) return;

    let posIndex = Math.round((staffBottomY - localY)/(gap/2));
    posIndex = Math.max(POS_MIN, Math.min(POS_MAX, posIndex));

    layoutNotes();
    let insertAt = state.notes.length;
    for(let i=0;i<state.notes.length;i++){
      if(localX < state.notes[i].x){ insertAt = i; break; }
    }
    const note = {id: uid(), posIndex, duration:'q', accidental:0};
    state.notes.splice(insertAt, 0, note);
    renderStaff();
  }

  window.addEventListener('resize', ()=>{ renderStaff(); });

  /* ============ Audio engine ============ */
  let audioCtx=null;
  function ensureAudio(){
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    return audioCtx;
  }
  function playTone(freq, startTime, duration, instrument){
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    let type='sine';
    if(instrument==='synthlead') type='sawtooth';
    else if(instrument==='piano') type='triangle';
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    let filter=null;
    if(instrument==='synthlead'){
      filter = ctx.createBiquadFilter();
      filter.type='lowpass';
      filter.frequency.setValueAtTime(2400, startTime);
      filter.Q.value = 0.8;
    }
    const peak = 0.26;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peak, startTime+0.012);
    if(instrument==='piano'){
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime+Math.max(0.05,duration*0.98));
    } else {
      const sustainUntil = startTime + Math.max(0.02, duration-0.07);
      gainNode.gain.setValueAtTime(peak, sustainUntil);
      gainNode.gain.linearRampToValueAtTime(0.0001, startTime+duration);
    }
    osc.connect(filter||gainNode);
    if(filter) filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime+duration+0.05);
  }

  /* ============ Playback sequencer ============ */
  let isPlaying=false, seqIndex=0, seqTimeoutId=null;

  function highlightNote(id, on){
    const el = svg.querySelector('[data-id="'+id+'"]');
    if(el) el.classList.toggle('active', on);
  }
  function clearHighlights(){
    svg.querySelectorAll('.active').forEach(el=>el.classList.remove('active'));
  }
  function updateTransportUI(){
    if(isPlaying){
      playPauseBtn.textContent = '⏸';
      playPauseBtn.setAttribute('aria-label','Pause');
      playPauseBtn.classList.add('active');
      stopBtn.classList.remove('hidden');
    } else {
      playPauseBtn.textContent = '▶';
      playPauseBtn.setAttribute('aria-label','Play');
      playPauseBtn.classList.remove('active');
      stopBtn.classList.add('hidden');
    }
  }

  function scheduleNext(){
    if(seqIndex >= state.notes.length){ stopPlayback(); return; }
    const note = state.notes[seqIndex];
    const secPerBeat = 60/state.bpm;
    const beats = beatsForDuration(note.duration);
    const durSec = beats*secPerBeat;
    const isRest = note.duration==='qr'||note.duration==='hr';

    highlightNote(note.id, true);
    if(!isRest){
      const ctx = ensureAudio();
      const midi = getEffectiveMidi(state.clef, note);
      const freq = 440*Math.pow(2,(midi-69)/12);
      playTone(freq, ctx.currentTime, durSec*0.92, state.instrument);
    }
    seqTimeoutId = setTimeout(()=>{
      highlightNote(note.id, false);
      seqIndex++;
      scheduleNext();
    }, Math.max(30, durSec*1000));
  }

  function playPlayback(){
    if(state.notes.length===0) return;
    ensureAudio();
    if(audioCtx.state==='suspended') audioCtx.resume();
    if(isPlaying) return;
    isPlaying=true;
    updateTransportUI();
    scheduleNext();
  }
  function pausePlayback(){
    if(!isPlaying) return;
    isPlaying=false;
    clearTimeout(seqTimeoutId);
    updateTransportUI();
  }
  function stopPlayback(){
    isPlaying=false;
    clearTimeout(seqTimeoutId);
    seqIndex=0;
    clearHighlights();
    updateTransportUI();
  }

  playPauseBtn.addEventListener('click', ()=>{
    if(isPlaying) pausePlayback(); else playPlayback();
  });
  stopBtn.addEventListener('click', stopPlayback);

  /* ============ MIDI export ============ */
  function toVarLength(value){
    let bytes=[value & 0x7f];
    value = Math.floor(value/128);
    while(value>0){
      bytes.unshift((value & 0x7f)|0x80);
      value = Math.floor(value/128);
    }
    return bytes;
  }

  function exportMidi(){
    if(state.notes.length===0){ alert('Add some notes before exporting.'); return; }
    const ticksPerQuarter=480;
    const microsecondsPerQuarter = Math.round(60000000/state.bpm);
    let track=[];
    track.push(0x00,0xFF,0x51,0x03,
      (microsecondsPerQuarter>>16)&0xff, (microsecondsPerQuarter>>8)&0xff, microsecondsPerQuarter&0xff);
    const [num,den]=state.timeSig;
    const denPow = Math.round(Math.log2(den));
    track.push(0x00,0xFF,0x58,0x04, num, denPow, 24, 8);

    let pendingDelta=0;
    state.notes.forEach(note=>{
      const beats = beatsForDuration(note.duration);
      const ticks = Math.round(beats*ticksPerQuarter);
      const isRest = note.duration==='qr'||note.duration==='hr';
      if(isRest){
        pendingDelta += ticks;
      } else {
        const midi = getEffectiveMidi(state.clef, note);
        track.push(...toVarLength(pendingDelta), 0x90, midi&0x7f, 100);
        track.push(...toVarLength(ticks), 0x80, midi&0x7f, 0);
        pendingDelta = 0;
      }
    });
    track.push(...toVarLength(pendingDelta), 0xFF,0x2F,0x00);

    const header = [0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1,
      (ticksPerQuarter>>8)&0xff, ticksPerQuarter&0xff];
    const trackHeader = [0x4D,0x54,0x72,0x6B,
      (track.length>>24)&0xff,(track.length>>16)&0xff,(track.length>>8)&0xff, track.length&0xff];

    const bytes = new Uint8Array([...header, ...trackHeader, ...track]);
    const blob = new Blob([bytes], {type:'audio/midi'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (currentTitle || 'notecraft-composition').replace(/[^a-z0-9\- _]/gi,'_') + '.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
  }
  exportMidiBtn.addEventListener('click', exportMidi);

  /* ============ Init ============ */
  syncControlsFromState();
  renderStaff();
})();
