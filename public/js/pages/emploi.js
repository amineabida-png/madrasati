window.renderEmploi = async function() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [classes, profs, matieres] = await Promise.all([
    fetch('/api/classes', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('/api/profs', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('/api/matieres', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
  ]);

  const isAdmin = ['admin','super'].includes(user.role);
  const defaultClass = classes[0]?.id || '';

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">📅 Emploi du temps</div><div class="page-sub">Planning hebdomadaire</div></div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="openAddCours(${JSON.stringify({classes,profs,matieres}).replace(/"/g,'&quot;')})"><i class="fas fa-plus"></i> Ajouter un cours</button>` : ''}
    </div>
    <div class="filter-bar">
      <select id="et-classe" class="form-select" onchange="loadEmploiTable()">
        <option value="">-- Toutes les classes --</option>
        ${classes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
      <select id="et-prof" class="form-select" onchange="loadEmploiTable()">
        <option value="">-- Tous les enseignants --</option>
        ${profs.map(p => `<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
      </select>
      <button class="btn btn-outline btn-sm" onclick="printTimetable()"><i class="fas fa-print"></i> Imprimer</button>
    </div>
    <div id="et-grid-container">
      <div style="display:flex;justify-content:center;padding:40px;"><div class="loader"></div></div>
    </div>`;

  // Auto-load first class
  if (defaultClass) {
    document.getElementById('et-classe').value = defaultClass;
  }
  loadEmploiTable();
};

window.loadEmploiTable = async function() {
  const token = localStorage.getItem('token');
  const classeId = document.getElementById('et-classe')?.value;
  const profId = document.getElementById('et-prof')?.value;
  let url = '/api/emploi?';
  if (classeId) url += 'classe_id=' + classeId + '&';
  if (profId) url += 'prof_id=' + profId + '&';
  const cours = await fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());

  const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  // Collect unique time slots
  const times = [...new Set(cours.map(c => c.heure_debut + '-' + c.heure_fin))].sort();

  const container = document.getElementById('et-grid-container');

  if (!cours.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>Aucun cours programmé</h3><p>Ajoutez des cours en cliquant sur "+ Ajouter un cours"</p></div>';
    return;
  }

  // Build grid map: day -> time -> cours
  const grid = {};
  cours.forEach(c => {
    const key = c.jour + '||' + c.heure_debut + '-' + c.heure_fin;
    if (!grid[key]) grid[key] = [];
    grid[key].push(c);
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['admin','super'].includes(user.role);

  container.innerHTML = `
    <div style="overflow-x:auto;" id="timetable-print">
      <table style="width:100%; border-collapse:collapse; min-width:700px;">
        <thead>
          <tr>
            <th style="background:var(--sidebar); color:white; padding:12px; text-align:center; border-radius:8px 0 0 0; width:90px;">Horaire</th>
            ${jours.map((j,i) => `<th style="background:var(--sidebar); color:white; padding:12px; text-align:center; ${i===5?'border-radius:0 8px 0 0;':''}">${j}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${times.map(time => {
            const [debut, fin] = time.split('-');
            return `<tr>
              <td style="background:var(--bg); border:1px solid var(--border); text-align:center; font-size:11px; font-weight:700; color:var(--muted); padding:8px; white-space:nowrap;">
                ${debut}<br><span style="font-size:10px;">→ ${fin}</span>
              </td>
              ${jours.map(jour => {
                const key = jour + '||' + time;
                const cellCours = grid[key] || [];
                if (!cellCours.length) return `<td style="background:var(--card); border:1px solid var(--border); padding:4px;"></td>`;
                return `<td style="background:var(--card); border:1px solid var(--border); padding:4px;">
                  ${cellCours.map(c => `
                    <div style="background:${c.couleur || '#3b82f6'}; border-radius:6px; padding:8px; color:white; font-size:11px; margin-bottom:2px;">
                      <div style="font-weight:800; margin-bottom:2px;">${c.matiere_nom}</div>
                      <div style="opacity:0.85;">${c.prof_prenom} ${c.prof_nom}</div>
                      ${c.salle ? `<div style="opacity:0.7; font-size:10px;">📍 ${c.salle}</div>` : ''}
                      ${c.classe_nom && !document.getElementById('et-classe')?.value ? `<div style="opacity:0.7; font-size:10px;">🏫 ${c.classe_nom}</div>` : ''}
                      ${isAdmin ? `<button onclick="deleteCours(${c.id})" style="margin-top:4px; background:rgba(0,0,0,0.2); border:none; border-radius:4px; color:white; font-size:10px; padding:2px 6px; cursor:pointer;">✕ Supprimer</button>` : ''}
                    </div>`).join('')}
                </td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
      ${[...new Set(cours.map(c => JSON.stringify({couleur: c.couleur, nom: c.matiere_nom})))].map(j => {
        const m = JSON.parse(j);
        return `<div style="display:flex; align-items:center; gap:6px; font-size:12px;"><div style="width:12px; height:12px; border-radius:3px; background:${m.couleur};"></div>${m.nom}</div>`;
      }).join('')}
    </div>`;
};

window.openAddCours = function(data) {
  const { classes, profs, matieres } = data;
  const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  showModal(`
    <div class="modal-header">
      <span class="modal-title">➕ Ajouter un cours</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Classe *</label>
          <select id="c-classe" class="form-select">
            ${classes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Matière *</label>
          <select id="c-matiere" class="form-select">
            ${matieres.map(m => `<option value="${m.id}">${m.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Enseignant *</label>
          <select id="c-prof" class="form-select">
            ${profs.map(p => `<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Jour *</label>
          <select id="c-jour" class="form-select">
            ${jours.map(j => `<option value="${j}">${j}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Heure début *</label>
          <input id="c-debut" type="time" class="form-input" value="08:00">
        </div>
        <div class="form-group"><label class="form-label">Heure fin *</label>
          <input id="c-fin" type="time" class="form-input" value="10:00">
        </div>
        <div class="form-group"><label class="form-label">Salle</label>
          <input id="c-salle" class="form-input" placeholder="Ex: Salle 1">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Annuler</button>
      <button onclick="saveCours()" class="btn btn-primary"><i class="fas fa-save"></i> Ajouter</button>
    </div>`);
};

window.saveCours = async function() {
  const token = localStorage.getItem('token');
  const body = {
    classe_id: document.getElementById('c-classe').value,
    matiere_id: document.getElementById('c-matiere').value,
    prof_id: document.getElementById('c-prof').value,
    jour: document.getElementById('c-jour').value,
    heure_debut: document.getElementById('c-debut').value,
    heure_fin: document.getElementById('c-fin').value,
    salle: document.getElementById('c-salle').value,
  };
  if (!body.heure_debut || !body.heure_fin) return toast('Horaires requis', 'error');
  if (body.heure_debut >= body.heure_fin) return toast("L'heure de fin doit être après l'heure de début", 'error');
  const r = await fetch('/api/emploi', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) return toast(d.error || 'Erreur', 'error');
  toast('Cours ajouté !', 'success');
  closeModal();
  loadEmploiTable();
};

window.deleteCours = async function(id) {
  if (!confirm('Supprimer ce cours ?')) return;
  const token = localStorage.getItem('token');
  await fetch('/api/emploi/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  toast('Cours supprimé', 'success');
  loadEmploiTable();
};

window.printTimetable = function() {
  const el = document.getElementById('timetable-print');
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Emploi du temps</title>
    <style>body{font-family:sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;font-size:11px;} th{background:#1a2b4a;color:white;}</style>
    </head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.print();
};
