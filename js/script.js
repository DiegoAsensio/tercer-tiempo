document.addEventListener('DOMContentLoaded', function(){
  // ==================== Config de jugadores ====================
  const RAW_PLAYERS = [
    { name: 'Barto', photo: 'img/barto.jpg' },
    { name: 'Colo', photo: 'img/colo.jpg' },
    { name: 'Cuca', photo: 'img/cuca.jpg' },
    { name: 'Diego', photo: 'img/diego.jpg' },
    { name: 'Gata', photo: 'img/gata.jpg' },
    { name: 'Joaco', photo: 'img/joaco.jpg' },
    { name: 'Aldrey', photo: 'img/aldrey.jpg' },
    { name: 'Molfi', photo: 'img/molfi.jpg' },
    { name: 'Nacho', photo: 'img/nacho.jpg' },
    { name: 'Nahue', photo: 'img/nahue.jpg' },
    { name: 'Sean', photo: 'img/sean.jpg' },
    { name: 'Tadeo', photo: 'img/tadeo.jpg' },
    { name: 'Tomi', photo: 'img/tomi.jpg' }
  ].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  // ================================================================

  const $ = sel => document.querySelector(sel);
  const today = ()=> new Date().toISOString().slice(0,10);
  const genId = ()=> (window.crypto && typeof window.crypto.randomUUID==='function' ? window.crypto.randomUUID() : Math.random().toString(36).slice(2));
  const formatDateDMY = (date)=>{ const [y,m,d] = date.split('-'); return `${d}-${m}-${y}` };
  
  // API URL
  const API_URL = '/.netlify/functions/api';
  
  // Store con API
  const store = {
    async read() {
      try {
        const response = await fetch(`${API_URL}/data`);
        if (!response.ok) throw new Error('Error al cargar datos');
        return await response.json();
      } catch (error) {
        console.error('Error reading from API:', error);
        try {
          return JSON.parse(localStorage.getItem('3t-data') || '{}');
        } catch (e) {
          return {};
        }
      }
    },
    async write(d) {
      try {
        const response = await fetch(`${API_URL}/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(d)
        });
        if (!response.ok) throw new Error('Error al guardar datos');
        localStorage.setItem('3t-data', JSON.stringify(d));
      } catch (error) {
        console.error('Error writing to API:', error);
        localStorage.setItem('3t-data', JSON.stringify(d));
      }
    }
  };

  // Generar avatar con iniciales (fallback)
  const getAvatar = (name) => {
    const colors = ['FF6B6B','4ECDC4','45B7D1','96CEB4','FFEAA7','DFE6E9','74B9FF','A29BFE','FD79A8','FDCB6E'];
    const initial = name.charAt(0).toUpperCase();
    const colorIndex = name.charCodeAt(0) % colors.length;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&size=200&background=${colors[colorIndex]}&color=fff&bold=true&font-size=0.5`;
  };

  let data = { players: [], matches: [] };
  const current = {A:[],B:[]};
  const teamStates = {};

  // Cargar datos iniciales
  async function loadData() {
    try {
      // Primero cargar desde localStorage (instantáneo)
      const localData = JSON.parse(localStorage.getItem('3t-data') || '{}');
      
      if (localData.players && localData.players.length > 0) {
        // Usar datos locales inmediatamente
        data = localData;
        console.log('Datos cargados desde localStorage');
      } else {
        // Si no hay datos locales, inicializar con RAW_PLAYERS
        data = { 
          players: RAW_PLAYERS.map(p=>({ id: genId(), name: p.name, photo: p.photo })), 
          matches: [] 
        };
        localStorage.setItem('3t-data', JSON.stringify(data));
        console.log('Datos inicializados localmente');
      }
      
      // Actualizar jugadores con RAW_PLAYERS por si hay nuevos
      RAW_PLAYERS.forEach(rawPlayer => {
        const exists = data.players.find(p => p.name === rawPlayer.name);
        if (!exists) {
          data.players.push({
            id: genId(),
            name: rawPlayer.name,
            photo: rawPlayer.photo
          });
        } else {
          exists.photo = rawPlayer.photo;
        }
      });
      
      data.players.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      data.players.forEach(p => teamStates[p.id] = 'none');
      
      // Renderizar inmediatamente con datos locales
      renderLeaderboard();
      renderHistory();
      
      // En segundo plano, intentar sincronizar con Firebase
      syncWithFirebase();
      
    } catch (error) {
      console.error('Error loading data:', error);
      // Fallback: inicializar con RAW_PLAYERS
      data = { 
        players: RAW_PLAYERS.map(p=>({ id: genId(), name: p.name, photo: p.photo })), 
        matches: [] 
      };
      data.players.forEach(p => teamStates[p.id] = 'none');
      renderLeaderboard();
      renderHistory();
    }
  }
  
  // Sincronizar con Firebase en segundo plano
  async function syncWithFirebase() {
    try {
      console.log('Sincronizando con Firebase...');
      const savedData = await store.read();
      
      if (!savedData.players || savedData.players.length === 0) {
        // Firebase vacío, subir datos locales
        console.log('Firebase vacío, subiendo datos locales...');
        await store.write(data);
      } else {
        // Firebase tiene datos, usarlos
        if (JSON.stringify(savedData) !== JSON.stringify(data)) {
          console.log('Datos de Firebase diferentes, actualizando...');
          data = savedData;
          renderLeaderboard();
          renderHistory();
        }
      }
    } catch (error) {
      console.error('Error sincronizando con Firebase:', error);
      // Ignorar error, seguir usando datos locales
    }
  }

  // Auto-refresh cada 5 segundos
  setInterval(async () => {
    const newData = await store.read();
    if (JSON.stringify(newData.matches) !== JSON.stringify(data.matches)) {
      data = newData;
      renderLeaderboard();
      renderHistory();
    }
  }, 5000);

  // ---- DnD y Render del Pool --------------------------------------------
  function getTeamStatus(playerId) {
    if (current.A.includes(playerId)) return 'pechera';
    if (current.B.includes(playerId)) return 'sin-pechera';
    return 'sin-equipo';
  }

  function getTeamStatusText(status) {
    if (status === 'pechera') return 'Pechera';
    if (status === 'sin-pechera') return 'Sin pechera';
    return 'Sin equipo';
  }

  function cycleTeamStatus(playerId, direction) {
    const statuses = ['sin-equipo', 'pechera', 'sin-pechera'];
    const current_status = getTeamStatus(playerId);
    const currentIndex = statuses.indexOf(current_status);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = statuses.length - 1;
    if (newIndex >= statuses.length) newIndex = 0;
    
    const newStatus = statuses[newIndex];
    
    current.A = current.A.filter(x => x !== playerId);
    current.B = current.B.filter(x => x !== playerId);
    
    if (newStatus === 'pechera') {
      current.A.push(playerId);
    } else if (newStatus === 'sin-pechera') {
      current.B.push(playerId);
    }
    
    renderTeams();
    renderPool();
  }

  function makePlayerCard(p){
    const el = document.createElement('div'); 
    el.className='player'; 
    el.draggable = window.innerWidth > 768; 
    el.dataset.id = p.id;
    
    const av = document.createElement('div'); 
    av.className='avatar';
    const img = document.createElement('img');
    img.src = p.photo;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    img.onerror = function() {
      this.style.display = 'none';
      av.textContent = p.name.charAt(0).toUpperCase();
    };
    av.appendChild(img);
    
    const nm = document.createElement('div'); 
    nm.className='name'; 
    nm.textContent = p.name;
    
    const selector = document.createElement('div');
    selector.className = 'team-selector';
    
    const btnPrev = document.createElement('button');
    btnPrev.innerHTML = '◀';
    btnPrev.onclick = (e) => {
      e.stopPropagation();
      cycleTeamStatus(p.id, -1);
    };
    
    const status = document.createElement('div');
    status.className = 'status';
    const currentStatus = getTeamStatus(p.id);
    status.textContent = getTeamStatusText(currentStatus);
    status.classList.add(currentStatus);
    
    const btnNext = document.createElement('button');
    btnNext.innerHTML = '▶';
    btnNext.onclick = (e) => {
      e.stopPropagation();
      cycleTeamStatus(p.id, 1);
    };
    
    selector.appendChild(btnPrev);
    selector.appendChild(status);
    selector.appendChild(btnNext);
    
    el.appendChild(av); 
    el.appendChild(nm);
    el.appendChild(selector);
    
    if (window.innerWidth > 768) {
      el.addEventListener('dragstart', e=>{ 
        el.classList.add('dragging'); 
        e.dataTransfer.setData('text/plain', p.id) 
      });
      el.addEventListener('dragend', ()=> el.classList.remove('dragging'));
    }
    
    return el;
  }

  function renderPool(){
    const pool = $('#pool'); pool.innerHTML='';
    const unassigned = data.players.filter(p=> !current.A.includes(p.id) && !current.B.includes(p.id));
    
    if (window.innerWidth <= 768) {
      data.players.forEach(p=> pool.appendChild(makePlayerCard(p)));
    } else {
      if(!unassigned.length){ 
        pool.innerHTML = `<div class="empty">No quedan jugadores libres. Arrastrá desde las zonas o sacá de un equipo con ✖.</div>`; 
        return 
      }
      unassigned.forEach(p=> pool.appendChild(makePlayerCard(p)));
    }
  }

  function setupDrop(zoneSelector, teamKey){
    const zone = document.querySelector(zoneSelector);
    zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('dragover') });
    zone.addEventListener('dragleave', ()=> zone.classList.remove('dragover'));
    zone.addEventListener('drop', e=>{
      e.preventDefault(); zone.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      if(!id) return;
      current.A = current.A.filter(x=>x!==id);
      current.B = current.B.filter(x=>x!==id);
      if(!current[teamKey].includes(id)) current[teamKey].push(id);
      renderTeams(); renderPool();
    });
  }

  function removeFromTeam(team,id){ 
    current[team] = current[team].filter(x=>x!==id); 
    renderTeams(); 
    renderPool(); 
  }

  function avatarImg(id){ 
    const p=data.players.find(pp=>pp.id===id); 
    return p?.photo || '' 
  }

  function renderTeams(){
    const slotsA = $('#slotsA'), slotsB = $('#slotsB');
    const nameById = id => { const f=data.players.find(p=>p.id===id); return f?f.name:'?' };
    const mkSlot = (team,id)=> {
      const img = avatarImg(id);
      const name = nameById(id);
      return `<div class='slot'><img src='${img}' alt='${name}' title='${name}' style='height:28px;width:28px;border-radius:7px;object-fit:cover' onerror="this.style.display='none';this.nextElementSibling.style.marginLeft='0'"> ${name} <span class='remove' title='Quitar' data-team='${team}' data-id='${id}'>✖</span></div>`
    };
    slotsA.innerHTML = current.A.map(id=> mkSlot('A',id)).join('') || `<div class="muted">Vacío</div>`;
    slotsB.innerHTML = current.B.map(id=> mkSlot('B',id)).join('') || `<div class="muted">Vacío</div>`;
    $('#countA').textContent = current.A.length; 
    $('#countB').textContent = current.B.length;
    ['slotsA','slotsB'].forEach(cid=>{
      const container = document.getElementById(cid);
      container.onclick = (e)=>{
        const rm = e.target.closest('.remove');
        if(!rm) return;
        removeFromTeam(rm.dataset.team, rm.dataset.id);
      };
    });
  }

  // ---- Tabla y Historial -------------------------------------------------
  function computeStats(){
    const stats = new Map(); 
    data.players.forEach(p=> stats.set(p.id,{id:p.id,name:p.name,pj:0,pg:0}));
    data.matches.forEach(m=>{ 
      m.teamA.forEach(id=>{ const s=stats.get(id); if(s) s.pj++; }); 
      m.teamB.forEach(id=>{ const s=stats.get(id); if(s) s.pj++; }); 
      (m.winner==='A'?m.teamA:m.teamB).forEach(id=>{ const s=stats.get(id); if(s) s.pg++; }); 
    });
    return Array.from(stats.values());
  }

  function renderLeaderboard(){
    const tbody=$('#tablaPuntos tbody');
    const rows=computeStats().sort((a,b)=>b.pg-a.pg||a.name.localeCompare(b.name,'es')).map((s,i)=>{
      const img = avatarImg(s.id);
      const name = s.name;
      return `<tr><td>${i+1}</td><td style='display:flex;align-items:center;gap:12px'><img src='${img}' alt='${name}' title='${name}' style='height:48px;width:48px;border-radius:7px;object-fit:cover;border:2px solid var(--line)' onerror="this.style.display='none'">${name}</td><td>${s.pj}</td><td><strong>${s.pg}</strong></td></tr>`;
    }).join('');
    tbody.innerHTML=rows||`<tr><td colspan='4' class='empty'>Sin partidos todavía</td></tr>`;
  }

  function miniTeam(ids){ 
    return ids.map(id=>{
      const player = data.players.find(p=>p.id===id);
      const name = player?.name || '?';
      return `<img src='${avatarImg(id)}' title='${name}' alt='${name}' style='height:28px;width:28px;border-radius:50%;object-fit:cover;border:1px solid #1e2b60;margin-right:-6px' onerror="this.style.display='none'">`
    }).join('') 
  }

  async function eliminarPartido(id){ 
    data.matches = data.matches.filter(m=>m.id!==id); 
    await store.write(data); 
    renderHistory(); 
    renderLeaderboard(); 
  }

  function renderHistory(){
    const wrap = $('#historial');
    if(!data.matches.length){ wrap.innerHTML = `<p class='empty'>Sin registros aún.</p>`; return; }
    wrap.innerHTML = data.matches.slice().sort((a,b)=>a.date<b.date?1:-1).map(m=>{
      const winnerA = m.winner==='A';
      const teamAAv = miniTeam(m.teamA);
      const teamBAv = miniTeam(m.teamB);
      const headerPill = winnerA ? `Ganó Pechera 🏆` : `Ganó Sin pechera 🏆`;
      const deleteBtn = isAdminMode ? `<button class='btn danger eliminar-btn' data-id='${m.id}' style='font-size:0.85rem;padding:8px 12px'>Eliminar</button>` : '';
      return `<div class='card' style='margin-bottom:12px'><div class='content'>
        <div class='row' style='justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px'>
          <div style='display:flex;align-items:center;gap:10px;flex-wrap:wrap'><strong>${formatDateDMY(m.date)}</strong>
            <span class='muted' style='padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:#0a1430;font-size:0.85rem'>${headerPill}</span>
          </div>
          ${deleteBtn}
        </div>
        <div class='row teams' style='flex-wrap:wrap'>
          <div class='teamBox ${winnerA?"win":""}'>
            <div class='badge badgeA'><span class='dot'></span> Pechera ${winnerA?"<span class='trophy'>🏆</span>":""}</div>
            <div class='avatars'>${teamAAv}</div>
          </div>
          <div class='vs'>VS</div>
          <div class='teamBox ${!winnerA?"win":""}'>
            <div class='badge badgeB'><span class='dot'></span> Sin pechera ${!winnerA?"<span class='trophy'>🏆</span>":""}</div>
            <div class='avatars'>${teamBAv}</div>
          </div>
        </div>
      </div></div>`
    }).join('');
    if(isAdminMode) {
      document.querySelectorAll('.eliminar-btn').forEach(btn=> btn.addEventListener('click', ()=> openDeleteModal(btn.dataset.id)));
    }
  }

  async function onGuardarPartido(){
    const date=$('#fecha').value||today();
    if(current.A.length<1||current.B.length<1){alert('Arrastrá jugadores a ambos equipos');return;}
    if(!winner){alert('Seleccioná el ganador');return;}
    data.matches.push({id:genId(),date,teamA:[...current.A],teamB:[...current.B],winner});
    await store.write(data);
    limpiar(); renderHistory(); renderLeaderboard();
  }

  function limpiar(){
    current.A=[]; current.B=[]; winner=null;
    document.querySelectorAll('#segWinner button').forEach(b=> b.classList.remove('active'));
    renderTeams(); renderPool();
  }

  // ---- Init ---------------------------------------------------------------
  function renderAll(){ 
    $('#fecha').value=today(); 
    renderPool(); 
    renderTeams(); 
    renderLeaderboard(); 
    renderHistory(); 
  }
  
  // Admin authentication
  const ADMIN_CODE = 'pelotita';
  const authCard = document.getElementById('auth-card');
  const builderCard = document.getElementById('builder-card');
  const passwordInput = document.getElementById('admin-password');
  const authBtn = document.getElementById('auth-btn');
  const authError = document.getElementById('auth-error');
  
  let isAdminMode = false;
  
  function checkAuth() {
    if (isAdminMode) {
      authCard.style.display = 'none';
      builderCard.style.display = 'block';
    } else {
      authCard.style.display = 'block';
      builderCard.style.display = 'none';
    }
  }
  
  function attemptLogin() {
    const code = passwordInput.value.trim();
    if (code === ADMIN_CODE) {
      isAdminMode = true;
      passwordInput.value = '';
      authError.style.display = 'none';
      checkAuth();
      renderHistory();
      renderAll(); // Renderizar todo cuando hace login
    } else {
      authError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
      setTimeout(() => {
        authError.style.display = 'none';
      }, 3000);
    }
  }
  
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      attemptLogin();
    }
  });
  
  authBtn.addEventListener('click', attemptLogin);
  
  // Cargar datos al iniciar (ANTES de cualquier cosa)
  loadData();
  
  checkAuth();
  
  setupDrop('#zoneA','A'); 
  setupDrop('#zoneB','B');
  document.getElementById('guardarPartido').addEventListener('click', onGuardarPartido);
  document.getElementById('limpiarEquipos').addEventListener('click', limpiar);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderPool();
    }, 250);
  });

  let winner = null;
  const seg = document.getElementById('segWinner');
  seg.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-v]'); if(!btn) return;
    winner = btn.dataset.v;
    seg.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b===btn));
  });

  let pendingDeleteId = null;
  const modal = document.getElementById('deleteModal');
  const btnCancel = document.getElementById('cancelDelete');
  const btnConfirm = document.getElementById('confirmDelete');

  function openDeleteModal(id){ pendingDeleteId = id; modal.classList.add('show'); }
  function closeDeleteModal(){ pendingDeleteId = null; modal.classList.remove('show'); }

  btnCancel.addEventListener('click', closeDeleteModal);
  btnConfirm.addEventListener('click', async ()=>{ if(pendingDeleteId){ await eliminarPartido(pendingDeleteId); } closeDeleteModal(); });
  modal.addEventListener('click', (e)=>{ if(e.target===modal) closeDeleteModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDeleteModal(); });
});