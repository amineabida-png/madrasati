async function renderPresences(container) {
  const [classes, matieres] = await Promise.all([
    API.get('/api/classes'),
    API.get('/api/matieres')
  ]);
  const today = new Date().toISOString().split('T')[0];
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Présences</div><div class="page-sub">Suivi de l'assiduité</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="switchPresenceTab('saisie',this)">📝 Saisie du jour</div>
      <div class="tab" onclick="switchPresenceTab('historique',this)">📋 Historique</div>
    </div>
    <div id="presence-saisie">
      <div class="filter-bar">
        <select id="pr-classe" class="form-select" style="min-width:160px;">
          <option value="">Choisir une classe</option>
          ${classes.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
        </select>
        <select id="pr-matiere" class="form-select" style="min-width:160px;">
          <option value="">Toutes matières</option>
          ${matieres.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('')}
        </select>
        <input type="date" id="pr-date" class="form-input" value="${today}">
        <button class="btn btn-outline" onclick="loadPresenceSaisie()"><i class="fas fa-sync"></i> Charger</button>
      </div>
      <div id="presence-liste"><div class="empty-state"><div class="empty-icon">👆</div><h3>Sélectionnez une classe</h3></div></div>
    </div>
    <div id="presence-historique" style="display:none;">
      <div class="filter-bar">
        <select id="hist-classe" class="form-select" style="min-width:160px;">
          <option value="">Toutes les classes</option>
          ${classes.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
        </select>
        <input type="date" id="hist-date" class="form-input" value="${today}">
        <button class="btn btn-primary" onclick="loadHistorique()"><i class="fas fa-search"></i> Rechercher</button>
      </div>
      <div id="historique-liste"></div>
    </div>`;
}

function switchPresenceTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('presence-saisie').style.display = tab==='saisie'?'block':'none';
  document.getElementById('presence-historique').style.display = tab==='historique'?'block':'none';
  if (tab==='historique') loadHistorique();
}

async function loadPresenceSaisie() {
  const classeId = document.getElementById('pr-classe').value;
  const date = document.getElementById('pr-date').value;
  const container = document.getElementById('presence-liste');
  if (!classeId) { container.innerHTML=`<div class="empty-state"><div class="empty-icon">👆</div><h3>Sélectionnez une classe</h3></div>`; return; }
  container.innerHTML=`<div class="empty-state"><div class="loader" style="margin:0 auto;"></div></div>`;
  const [eleves, existantes] = await Promise.all([
    API.get(`/api/eleves?classe_id=${classeId}`),
    API.get(`/api/presences?classe_id=${classeId}&date=${date}`)
  ]);
  if (!eleves.length) { container.innerHTML=`<div class="empty-state"><div class="empty-icon">😶</div><h3>Aucun élève</h3></div>`; return; }
  const presMap = {};
  existantes.forEach(p=>{ presMap[p.eleve_id]=p.statut; });
  const statuts = {};
  eleves.forEach(e=>{ statuts[e.id]=presMap[e.id]||'present'; });
  window._presenceStatuts = statuts;
  window._presenceEleves = eleves;
  container.innerHTML=`
    <div class="card" style="padding:0;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div><span style="font-weight:700;font-size:15px;">${eleves.length} élèves</span>
          <span style="color:var(--muted);font-size:13px;margin-left:8px;">· ${new Date(date).toLocaleDateString('fr-MA',{weekday:'long',day:'numeric',month:'long'})}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="setAllPresence('present')"><i class="fas fa-check" style="color:var(--success);"></i> Tous présents</button>
          <button class="btn btn-outline btn-sm" onclick="setAllPresence('absent')"><i class="fas fa-times" style="color:var(--danger);"></i> Tous absents</button>
          <button class="btn btn-primary btn-sm" onclick="savePresences()"><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>
      <div id="presence-rows">${renderPresenceRows(eleves,statuts)}</div>
    </div>`;
}

function renderPresenceRows(eleves, statuts) {
  return eleves.map((e,i)=>`
    <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);background:${i%2===0?'var(--bg)':''}" id="row-${e.id}">
      <div style="width:24px;color:var(--muted);font-size:13px;text-align:right;">${i+1}</div>
      <div class="avatar" style="width:34px;height:34px;font-size:12px;">${initials(e.nom,e.prenom)}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;">${e.prenom} ${e.nom}</div><div style="font-size:12px;color:var(--muted);">${e.numero_matricule}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${['present','absent','retard','excuse'].map(s=>`
          <button class="presence-btn ${s} ${statuts[e.id]===s?'active-btn':''}" id="btn-${e.id}-${s}" onclick="setPresence(${e.id},'${s}')">
            ${{present:'✓ Présent',absent:'✗ Absent',retard:'⏰ Retard',excuse:'📄 Excusé'}[s]}
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function setPresence(eleveId, statut) {
  window._presenceStatuts[eleveId] = statut;
  ['present','absent','retard','excuse'].forEach(s=>{
    const btn=document.getElementById(`btn-${eleveId}-${s}`);
    if(btn) btn.classList.toggle('active-btn', s===statut);
  });
}

function setAllPresence(statut) {
  if(!window._presenceEleves) return;
  window._presenceEleves.forEach(e=>setPresence(e.id,statut));
}

async function savePresences() {
  const date = document.getElementById('pr-date').value;
  const matiereId = document.getElementById('pr-matiere').value;
  if(!window._presenceStatuts) return;
  const presences = Object.entries(window._presenceStatuts).map(([eleve_id,statut])=>({
    eleve_id:parseInt(eleve_id), statut, date, matiere_id:matiereId||null, remarque:''
  }));
  try {
    loading(true);
    await API.post('/api/presences',{presences});
    loading(false);
    toast(`${presences.length} présences enregistrées`);
  } catch(err) { loading(false); toast(err.message,'error'); }
}

async function loadHistorique() {
  const classeId = document.getElementById('hist-classe').value;
  const date = document.getElementById('hist-date').value;
  const container = document.getElementById('historique-liste');
  container.innerHTML=`<div class="empty-state"><div class="loader" style="margin:0 auto;"></div></div>`;
  let url='/api/presences?';
  if(classeId) url+=`classe_id=${classeId}&`;
  if(date) url+=`date=${date}&`;
  const rows = await API.get(url);
  if(!rows.length) { container.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><h3>Aucune donnée</h3></div>`; return; }
  const counts={present:0,absent:0,retard:0,excuse:0};
  rows.forEach(r=>counts[r.statut]=(counts[r.statut]||0)+1);
  container.innerHTML=`
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      ${[['present','✓','#d1fae5','var(--success)'],['absent','✗','#fee2e2','var(--danger)'],['retard','⏰','#fef3c7','var(--warning)'],['excuse','📄','#ede9fe','#7c3aed']].map(([s,ic,bg,c])=>`
      <div class="stat-card" style="flex:1;min-width:110px;padding:14px;">
        <div class="stat-icon" style="background:${bg};width:36px;height:36px;font-size:16px;">${ic}</div>
        <div><div class="stat-val" style="font-size:22px;color:${c};">${counts[s]}</div><div class="stat-label">${{present:'Présents',absent:'Absents',retard:'Retards',excuse:'Excusés'}[s]}</div></div>
      </div>`).join('')}
    </div>
    <div class="card" style="padding:0;"><div class="table-wrap"><table>
      <thead><tr><th>Élève</th><th>Classe</th><th>Date</th><th>Matière</th><th>Statut</th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr>
          <td><div style="display:flex;align-items:center;gap:8px;"><div class="avatar" style="width:28px;height:28px;font-size:10px;">${initials(r.nom,r.prenom)}</div><span>${r.prenom} ${r.nom}</span></div></td>
          <td>${r.classe_nom||'—'}</td><td>${formatDate(r.date)}</td><td>${r.matiere_nom||'—'}</td><td>${statutBadge(r.statut)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div></div>`;
}
