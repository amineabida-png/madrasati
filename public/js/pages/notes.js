async function renderNotes(container) {
  const [classes, matieres, periodes] = await Promise.all([
    API.get('/api/classes'), API.get('/api/matieres'), API.get('/api/periodes')
  ]);
  container.innerHTML = `
    <div class="page-header"><div><div class="page-title">Notes & Bulletins</div><div class="page-sub">Saisie et consultation</div></div></div>
    <div class="tabs">
      <div class="tab active" onclick="switchNotesTab('saisie',this)">📝 Saisie des notes</div>
      <div class="tab" onclick="switchNotesTab('bulletins',this)">📄 Bulletins</div>
    </div>
    <div id="notes-saisie">
      <div class="filter-bar">
        <select id="nt-classe" class="form-select" style="min-width:150px;" onchange="loadNotesClasse()">
          <option value="">Choisir une classe</option>
          ${classes.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
        </select>
        <select id="nt-matiere" class="form-select" style="min-width:150px;" onchange="loadNotesClasse()">
          <option value="">Toutes matières</option>
          ${matieres.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('')}
        </select>
        <select id="nt-periode" class="form-select" style="min-width:150px;" onchange="loadNotesClasse()">
          <option value="">Toutes périodes</option>
          ${periodes.map(p=>`<option value="${p.id}">${p.nom}</option>`).join('')}
        </select>
      </div>
      <div id="notes-liste"><div class="empty-state"><div class="empty-icon">📝</div><h3>Sélectionnez une classe</h3></div></div>
    </div>
    <div id="notes-bulletins" style="display:none;">
      <div class="filter-bar">
        <select id="bul-classe" class="form-select" style="min-width:150px;" onchange="loadElevesForBulletin()">
          <option value="">Classe</option>
          ${classes.map(c=>`<option value="${c.id}">${c.nom}</option>`).join('')}
        </select>
        <select id="bul-eleve" class="form-select" style="min-width:180px;"><option value="">Élève</option></select>
        <select id="bul-periode" class="form-select" style="min-width:150px;">
          ${periodes.map(p=>`<option value="${p.id}">${p.nom}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="genererBulletin()"><i class="fas fa-file-alt"></i> Générer</button>
      </div>
      <div id="bulletin-container"></div>
    </div>`;
  window._notesMatieres = matieres;
  window._notesPeriodes = periodes;
}

function switchNotesTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('notes-saisie').style.display = tab==='saisie'?'block':'none';
  document.getElementById('notes-bulletins').style.display = tab==='bulletins'?'block':'none';
}

async function loadNotesClasse() {
  const classeId = document.getElementById('nt-classe').value;
  const matiereId = document.getElementById('nt-matiere').value;
  const periodeId = document.getElementById('nt-periode').value;
  const container = document.getElementById('notes-liste');
  if (!classeId) return;
  container.innerHTML=`<div class="empty-state"><div class="loader" style="margin:0 auto;"></div></div>`;
  const [eleves, notes, matieres, periodes] = await Promise.all([
    API.get(`/api/eleves?classe_id=${classeId}`),
    API.get(`/api/notes?classe_id=${classeId}${matiereId?`&matiere_id=${matiereId}`:''}${periodeId?`&periode_id=${periodeId}`:''}`) ,
    API.get('/api/matieres'), API.get('/api/periodes')
  ]);
  const noteMap = {};
  notes.forEach(n=>{ if(!noteMap[n.eleve_id]) noteMap[n.eleve_id]={}; if(!noteMap[n.eleve_id][n.matiere_id]) noteMap[n.eleve_id][n.matiere_id]=[]; noteMap[n.eleve_id][n.matiere_id].push(n); });
  const activeMatieres = matiereId ? matieres.filter(m=>m.id==matiereId) : matieres;
  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      ${((currentUser.role==='admin'||currentUser.role==='super')||currentUser.role==='prof')?`<button class="btn btn-primary btn-sm" onclick="openAddNote()"><i class="fas fa-plus"></i> Ajouter une note</button>`:'' }
    </div>
    <div class="card" style="padding:0;overflow-x:auto;">
      <table>
        <thead><tr>
          <th style="min-width:160px;">Élève</th>
          ${activeMatieres.map(m=>`<th style="text-align:center;min-width:80px;border-left:2px solid var(--border);">${m.nom}<br><span style="font-size:10px;font-weight:400;color:var(--muted);">coeff.${m.coefficient}</span></th>`).join('')}
          <th style="text-align:center;min-width:90px;border-left:2px solid var(--accent);">Moyenne</th>
        </tr></thead>
        <tbody>
          ${eleves.map(e=>{
            let tc=0,tm=0;
            const cells=activeMatieres.map(m=>{
              const ns=(noteMap[e.id]||{})[m.id]||[];
              if(!ns.length) return `<td style="text-align:center;border-left:2px solid var(--border);color:var(--muted);">—</td>`;
              const moy=ns.reduce((s,n)=>s+(n.valeur/n.sur*20),0)/ns.length;
              tc+=m.coefficient; tm+=moy*m.coefficient;
              return `<td style="text-align:center;border-left:2px solid var(--border);"><span style="font-weight:800;color:${noteColor(moy)};">${moy.toFixed(2)}</span><div style="font-size:10px;color:var(--muted);">${ns.length}n.</div></td>`;
            }).join('');
            const mg=tc>0?tm/tc:null;
            return `<tr>
              <td><div style="display:flex;align-items:center;gap:8px;"><div class="avatar" style="width:28px;height:28px;font-size:10px;">${initials(e.nom,e.prenom)}</div><span style="font-weight:500;">${e.prenom} ${e.nom}</span></div></td>
              ${cells}
              <td style="text-align:center;border-left:2px solid var(--accent);">${mg!==null?`<span style="font-size:16px;font-weight:900;color:${noteColor(mg)};">${mg.toFixed(2)}</span><div style="font-size:10px;color:var(--muted);">${getMention(mg)}</div>`:'<span style="color:var(--muted);">—</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  window._notesEleves = eleves;
}

async function openAddNote() {
  const [eleves, matieres, periodes] = await Promise.all([
    API.get('/api/eleves' + (document.getElementById('nt-classe').value ? `?classe_id=${document.getElementById('nt-classe').value}`:'')),
    API.get('/api/matieres'), API.get('/api/periodes')
  ]);
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-star-half-alt" style="color:var(--accent);margin-right:8px;"></i>Ajouter une note</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Élève *</label>
          <select id="nt-el" class="form-select">${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Matière *</label>
          <select id="nt-mat" class="form-select">${matieres.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Période *</label>
          <select id="nt-per" class="form-select">${periodes.map(p=>`<option value="${p.id}">${p.nom}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label class="form-label">Type</label>
          <select id="nt-type" class="form-select">
            <option value="devoir">Devoir</option><option value="examen">Examen</option>
            <option value="controle">Contrôle</option><option value="oral">Oral</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Note *</label><input id="nt-val" class="form-input" type="number" min="0" max="20" step="0.25" placeholder="15.5"></div>
        <div class="form-group"><label class="form-label">Sur</label><input id="nt-sur" class="form-input" type="number" value="20"></div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Remarque</label><input id="nt-rem" class="form-input" placeholder="Optionnel"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveNote()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>`);
}

async function saveNote() {
  const data = {
    eleve_id: document.getElementById('nt-el').value,
    matiere_id: document.getElementById('nt-mat').value,
    periode_id: document.getElementById('nt-per').value,
    type_note: document.getElementById('nt-type').value,
    valeur: parseFloat(document.getElementById('nt-val').value),
    sur: parseFloat(document.getElementById('nt-sur').value)||20,
    remarque: document.getElementById('nt-rem').value.trim(),
  };
  if (isNaN(data.valeur)) return toast('Note invalide','error');
  try { loading(true); await API.post('/api/notes',data); loading(false); closeModal(); toast('Note ajoutée'); loadNotesClasse(); }
  catch(err) { loading(false); toast(err.message,'error'); }
}

async function loadElevesForBulletin() {
  const classeId = document.getElementById('bul-classe').value;
  const sel = document.getElementById('bul-eleve');
  sel.innerHTML='<option value="">Choisir un élève</option>';
  if (!classeId) return;
  const eleves = await API.get(`/api/eleves?classe_id=${classeId}`);
  eleves.forEach(e=>{ const o=document.createElement('option'); o.value=e.id; o.textContent=`${e.prenom} ${e.nom}`; sel.appendChild(o); });
}

async function genererBulletin() {
  const eleveId = document.getElementById('bul-eleve').value;
  const periodeId = document.getElementById('bul-periode').value;
  if (!eleveId||!periodeId) return toast('Sélectionnez élève et période','error');
  loading(true);
  const data = await API.get(`/api/bulletin/${eleveId}/${periodeId}`);
  loading(false);
  const {eleve,periode,notes,moyenneGen,presences} = data;
  const presents = presences.find(p=>p.statut==='present')?.total||0;
  const absents = presences.find(p=>p.statut==='absent')?.total||0;
  const container = document.getElementById('bulletin-container');
  container.innerHTML = `
    <div id="bulletin-print" class="card" style="padding:0;max-width:800px;margin:0 auto;">
      <div class="bulletin-header">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div><div style="font-family:'Tajawal',sans-serif;font-size:24px;font-weight:900;">مدرستي · MADRASATI</div>
          <div style="opacity:0.7;font-size:12px;">Bulletin de Notes Scolaires</div></div>
          <div style="text-align:right;"><div style="font-weight:700;">${periode?.nom||'—'}</div><div style="opacity:0.6;font-size:12px;">${periode?.annee_scolaire||'2024-2025'}</div></div>
        </div>
        <div style="margin-top:16px;padding:14px;background:rgba(255,255,255,0.1);border-radius:8px;display:flex;gap:20px;flex-wrap:wrap;">
          <div><div style="font-size:10px;opacity:0.6;text-transform:uppercase;">Élève</div><div style="font-weight:700;">${eleve.prenom} ${eleve.nom}</div></div>
          <div><div style="font-size:10px;opacity:0.6;text-transform:uppercase;">Classe</div><div style="font-weight:700;">${eleve.classe_nom||'—'}</div></div>
          <div><div style="font-size:10px;opacity:0.6;text-transform:uppercase;">Matricule</div><div style="font-weight:700;">${eleve.numero_matricule}</div></div>
        </div>
      </div>
      <div style="padding:24px;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Matière</th><th style="text-align:center;">Coeff.</th><th style="text-align:center;">Moy./20</th><th style="text-align:center;">Points</th><th>Mention</th></tr></thead>
            <tbody>
              ${notes.map(n=>`<tr>
                <td style="font-weight:600;">${n.matiere}</td>
                <td style="text-align:center;">${n.coefficient}</td>
                <td style="text-align:center;font-weight:800;font-size:15px;color:${noteColor(n.moyenne||0)};">${(n.moyenne||0).toFixed(2)}</td>
                <td style="text-align:center;color:var(--muted);">${((n.moyenne||0)*(n.coefficient||1)).toFixed(2)}</td>
                <td>${getMention(n.moyenne||0)}</td>
              </tr>`).join('')}
              ${!notes.length?'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted);">Aucune note pour cette période</td></tr>':''}
            </tbody>
          </table>
        </div>
        <div style="display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;padding:20px;background:${moyenneGen>=10?'#d1fae5':'#fee2e2'};border-radius:10px;text-align:center;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);">Moyenne Générale</div>
            <div style="font-size:36px;font-weight:900;color:${noteColor(moyenneGen)};margin:8px 0;">${moyenneGen}/20</div>
            <div style="font-weight:700;color:${noteColor(moyenneGen)};">${getMention(moyenneGen)}</div>
          </div>
          <div style="flex:1;min-width:180px;padding:20px;background:var(--bg);border-radius:10px;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:12px;">Assiduité</div>
            <div style="display:flex;gap:16px;">
              <div><div style="font-size:22px;font-weight:800;color:var(--success);">${presents}</div><div style="font-size:11px;color:var(--muted);">Présences</div></div>
              <div><div style="font-size:22px;font-weight:800;color:var(--danger);">${absents}</div><div style="font-size:11px;color:var(--muted);">Absences</div></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
          <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> Imprimer</button>
          <button class="btn btn-primary" onclick="exportBulletinPDF('${eleve.prenom}_${eleve.nom}')"><i class="fas fa-file-pdf"></i> PDF</button>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:32px;padding-top:20px;border-top:1px solid var(--border);">
          <div style="text-align:center;"><div style="font-size:11px;color:var(--muted);">Signature du Parent</div><div style="height:48px;border-bottom:1px solid var(--muted);margin-top:40px;width:150px;"></div></div>
          <div style="text-align:center;"><div style="font-size:11px;color:var(--muted);">Cachet & Signature</div><div style="height:48px;border-bottom:1px solid var(--muted);margin-top:40px;width:150px;"></div></div>
        </div>
      </div>
    </div>`;
}

function exportBulletinPDF(nom) {
  const el = document.getElementById('bulletin-print');
  if (!el) return toast('Générez un bulletin d abord', 'error');
  el.classList.add('print-zone');
  window.print();
  setTimeout(() => el.classList.remove('print-zone'), 1000);
}
