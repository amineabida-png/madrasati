const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES = ['08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];

async function renderEmploi(container) {
  const [classes, profs] = await Promise.all([API.get('/api/classes'), API.get('/api/profs')]);

  let selectedClasse = classes[0]?.id || '';
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Emploi du temps</div>
      ${(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-primary" onclick="openAddCreneaux()"><i class="fas fa-plus"></i> Ajouter créneau</button>`:''}
    </div>
    <div class="filter-bar">
      <select id="edt-classe" class="form-select" onchange="loadEmploi()" style="min-width:180px;">
        <option value="">Toutes les classes</option>
        ${classes.map(c=>`<option value="${c.id}" ${c.id==selectedClasse?'selected':''}>${c.nom}</option>`).join('')}
      </select>
      <select id="edt-prof" class="form-select" onchange="loadEmploi()" style="min-width:180px;">
        <option value="">Tous les professeurs</option>
        ${profs.map(p=>`<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
      </select>
    </div>
    <div id="timetable-container"></div>
  `;

  window._emploiClasses = classes;
  window._emploiProfs = profs;
  await loadEmploi();
}

async function loadEmploi() {
  const classeId = document.getElementById('edt-classe').value;
  const profId = document.getElementById('edt-prof').value;
  const [matieres] = await Promise.all([API.get('/api/matieres')]);

  let url = '/api/emploi-du-temps?';
  if (classeId) url += `classe_id=${classeId}&`;
  if (profId) url += `prof_id=${profId}&`;
  const slots = await API.get(url);

  const container = document.getElementById('timetable-container');
  if (!slots.length) {
    container.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">📅</div><h3>Aucun créneau défini</h3><p>Sélectionnez une classe ou ajoutez des créneaux</p></div></div>`;
    return;
  }

  // Build grid
  const slotMap = {};
  slots.forEach(s => {
    const key = `${s.jour}__${s.heure_debut}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(s);
  });

  let html = `
    <div class="card" style="padding:16px;overflow-x:auto;">
      <div class="timetable-grid">
        <div class="timetable-time" style="background:var(--sidebar);color:white;font-weight:700;">Heure</div>
        ${JOURS.map(j=>`<div class="timetable-header">${j}</div>`).join('')}
  `;

  HEURES.forEach((h, hi) => {
    if (hi >= HEURES.length-1) return;
    const hEnd = HEURES[hi+1];
    html += `<div class="timetable-time">${h}<br><span style="font-size:9px;opacity:0.6;">${hEnd}</span></div>`;
    JOURS.forEach(jour => {
      const key = `${jour}__${h}`;
      const s = slotMap[key];
      if (s && s.length) {
        html += `<div style="padding:4px;">` + s.map(slot => `
          <div class="timetable-lesson" style="background:${slot.couleur || '#3b82f6'};margin-bottom:2px;">
            <div style="font-weight:700;">${slot.matiere_nom}</div>
            <div style="opacity:0.85;font-size:10px;">${slot.prof_prenom} ${slot.prof_nom}</div>
            ${slot.salle?`<div style="opacity:0.7;font-size:10px;"><i class="fas fa-door-open"></i> ${slot.salle}</div>`:''}
            ${(currentUser.role==='admin'||currentUser.role==='super')?`<button onclick="deleteCreneaux(${slot.id})" style="background:rgba(0,0,0,0.3);border:none;color:white;padding:1px 6px;border-radius:3px;font-size:10px;cursor:pointer;margin-top:2px;">×</button>`:''}
          </div>`).join('') + '</div>';
      } else {
        html += `<div class="timetable-cell" style="background:var(--bg);opacity:0.4;"></div>`;
      }
    });
  });

  html += '</div></div>';
  container.innerHTML = html;
}

async function openAddCreneaux() {
  const [classes, profs, matieres] = await Promise.all([
    API.get('/api/classes'), API.get('/api/profs'), API.get('/api/matieres')
  ]);
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-calendar-plus" style="color:var(--accent);margin-right:8px;"></i>Ajouter un créneau</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Classe *</label>
          <select id="edt-cl" class="form-select">
            ${classes.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Matière *</label>
          <select id="edt-mat" class="form-select">
            ${matieres.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Professeur *</label>
          <select id="edt-pr" class="form-select">
            ${profs.map(p=>`<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Jour *</label>
          <select id="edt-jour" class="form-select">
            ${JOURS.map(j=>`<option value="${j}">${j}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Heure début *</label>
          <select id="edt-hdeb" class="form-select">
            ${HEURES.map(h=>`<option value="${h}">${h}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Heure fin *</label>
          <select id="edt-hfin" class="form-select">
            ${HEURES.map((h,i)=>`<option value="${h}" ${i===1?'selected':''}>${h}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Salle</label><input id="edt-salle" class="form-input" placeholder="Salle 1"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveCreneaux()"><i class="fas fa-save"></i> Ajouter</button>
    </div>
  `);
}

async function saveCreneaux() {
  const data = {
    classe_id: document.getElementById('edt-cl').value,
    matiere_id: document.getElementById('edt-mat').value,
    prof_id: document.getElementById('edt-pr').value,
    jour: document.getElementById('edt-jour').value,
    heure_debut: document.getElementById('edt-hdeb').value,
    heure_fin: document.getElementById('edt-hfin').value,
    salle: document.getElementById('edt-salle').value.trim(),
  };
  try {
    loading(true);
    await API.post('/api/emploi-du-temps', data);
    loading(false);
    closeModal();
    toast('Créneau ajouté');
    await loadEmploi();
  } catch (err) { loading(false); toast(err.message, 'error'); }
}

async function deleteCreneaux(id) {
  confirm('Supprimer ce créneau ?', async () => {
    await API.delete(`/api/emploi-du-temps/${id}`);
    toast('Créneau supprimé');
    await loadEmploi();
  });
}
