async function renderFacturation(container) {
  const stats = await API.get('/api/factures/stats/summary');
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Facturation & Paiements</div><div class="page-sub">Suivi financier</div></div>
      ${(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-primary" onclick="openAddFacture()"><i class="fas fa-plus"></i> Nouvelle facture</button>`:''}
    </div>
    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
      <div class="stat-card"><div class="stat-icon" style="background:#dbeafe;"><i class="fas fa-coins" style="color:#2563eb;"></i></div>
        <div><div class="stat-val" style="font-size:18px;">${formatMoney(stats.total_emis||0)}</div><div class="stat-label">Total émis</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#d1fae5;"><i class="fas fa-check-circle" style="color:var(--success);"></i></div>
        <div><div class="stat-val" style="font-size:18px;">${formatMoney(stats.total_paye||0)}</div><div class="stat-label">Total encaissé</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fee2e2;"><i class="fas fa-exclamation-circle" style="color:var(--danger);"></i></div>
        <div><div class="stat-val" style="font-size:18px;">${formatMoney(stats.total_impaye||0)}</div><div class="stat-label">Impayé</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:#fef3c7;"><i class="fas fa-file-invoice" style="color:var(--warning);"></i></div>
        <div><div class="stat-val">${stats.nb_impayees||0}</div><div class="stat-label">Factures impayées</div></div></div>
    </div>
    <!-- Filters -->
    <div class="filter-bar">
      <div style="position:relative;flex:1;min-width:200px;">
        <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:12px;"></i>
        <input type="text" class="form-input" placeholder="Rechercher..." style="padding-left:32px;" oninput="filterFactures(this.value,document.getElementById('fac-statut').value)">
      </div>
      <select id="fac-statut" class="form-select" onchange="filterFactures(document.querySelector('.filter-bar input').value,this.value)" style="min-width:150px;">
        <option value="">Tous les statuts</option>
        <option value="impayee">Impayées</option>
        <option value="partielle">Partielles</option>
        <option value="payee">Payées</option>
      </select>
    </div>
    <div id="factures-list"></div>`;
  await loadFactures();
}

let _facturesData = [];

async function loadFactures(statut='', search='') {
  let url = '/api/factures?';
  if (statut) url+=`statut=${statut}&`;
  if (search) url+=`search=${encodeURIComponent(search)}&`;
  const factures = await API.get(url);
  _facturesData = factures;
  renderFacturesList(factures);
}

function filterFactures(search, statut) {
  let f = _facturesData;
  if (statut) f=f.filter(x=>x.statut===statut);
  if (search.trim()) { const s=search.toLowerCase(); f=f.filter(x=>`${x.nom} ${x.prenom} ${x.numero}`.toLowerCase().includes(s)); }
  renderFacturesList(f);
}

function renderFacturesList(factures) {
  const container = document.getElementById('factures-list');
  if (!factures.length) { container.innerHTML=`<div class="empty-state"><div class="empty-icon">💰</div><h3>Aucune facture</h3></div>`; return; }
  container.innerHTML=`
    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead><tr><th>N° Facture</th><th>Élève</th><th>Description</th><th>Montant</th><th>Payé</th><th>Reste</th><th>Statut</th><th>Échéance</th><th>Actions</th></tr></thead>
          <tbody>
            ${factures.map(f=>`
              <tr>
                <td><code style="font-size:12px;background:var(--bg);padding:2px 8px;border-radius:4px;">${f.numero}</code></td>
                <td><div style="display:flex;align-items:center;gap:8px;">
                  <div class="avatar" style="width:28px;height:28px;font-size:10px;">${initials(f.nom,f.prenom)}</div>
                  <div><div style="font-weight:600;">${f.prenom} ${f.nom}</div><div style="font-size:11px;color:var(--muted);">${f.classe_nom||''}</div></div>
                </div></td>
                <td style="max-width:180px;font-size:13px;color:var(--muted);">${f.description||'—'}</td>
                <td style="font-weight:700;">${formatMoney(f.montant)}</td>
                <td style="color:var(--success);font-weight:600;">${formatMoney(f.montant_paye)}</td>
                <td style="color:${f.montant-f.montant_paye>0?'var(--danger)':'var(--muted)'};font-weight:600;">${formatMoney(Math.max(0,f.montant-f.montant_paye))}</td>
                <td>${statutBadge(f.statut)}</td>
                <td style="font-size:13px;color:${new Date(f.date_echeance)<new Date()&&f.statut!=='payee'?'var(--danger)':'var(--muted)'};">${formatDate(f.date_echeance)}</td>
                <td>
                  <div style="display:flex;gap:5px;">
                    <button class="btn btn-outline btn-sm btn-icon" title="Voir détail" onclick="viewFacture(${f.id})"><i class="fas fa-eye"></i></button>
                    ${f.statut!=='payee'&&(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-success btn-sm" onclick="openPaiement(${f.id},'${f.numero}',${f.montant-f.montant_paye})"><i class="fas fa-cash-register"></i> Payer</button>`:''}
                    <button class="btn btn-outline btn-sm btn-icon" title="Imprimer" onclick="imprimerFacture(${f.id})"><i class="fas fa-print"></i></button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function openAddFacture() {
  const eleves = await API.get('/api/eleves');
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now()+30*864e5).toISOString().split('T')[0];
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-file-invoice-dollar" style="color:var(--accent);margin-right:8px;"></i>Nouvelle facture</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Élève *</label>
          <select id="fac-el" class="form-select">
            <option value="">Sélectionner un élève</option>
            ${eleves.map(e=>`<option value="${e.id}">${e.prenom} ${e.nom} – ${e.classe_nom||'Sans classe'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Description *</label>
          <input id="fac-desc" class="form-input" placeholder="Ex: Frais de scolarité - 1er Trimestre 2024-2025">
        </div>
        <div class="form-group"><label class="form-label">Montant (MAD) *</label><input id="fac-mnt" class="form-input" type="number" min="0" step="0.01" placeholder="3500"></div>
        <div class="form-group"><label class="form-label">Date d'échéance</label><input id="fac-ech" class="form-input" type="date" value="${nextMonth}"></div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Notes internes</label><textarea id="fac-notes" class="form-textarea" placeholder="Optionnel..."></textarea></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveFacture()"><i class="fas fa-save"></i> Créer la facture</button>
    </div>`);
}

async function saveFacture() {
  const data = {
    eleve_id: document.getElementById('fac-el').value,
    description: document.getElementById('fac-desc').value.trim(),
    montant: parseFloat(document.getElementById('fac-mnt').value),
    date_echeance: document.getElementById('fac-ech').value,
    notes: document.getElementById('fac-notes').value.trim(),
  };
  if (!data.eleve_id) return toast('Sélectionnez un élève','error');
  if (!data.description) return toast('Description requise','error');
  if (isNaN(data.montant)||data.montant<=0) return toast('Montant invalide','error');
  try { loading(true); const r=await API.post('/api/factures',data); loading(false); closeModal(); toast(`Facture ${r.numero} créée`); showPage('facturation'); }
  catch(err) { loading(false); toast(err.message,'error'); }
}

function openPaiement(id, numero, reste) {
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-cash-register" style="color:var(--success);margin-right:8px;"></i>Enregistrer un paiement</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="padding:12px;background:#d1fae5;border-radius:8px;margin-bottom:16px;font-size:13px;">
        <i class="fas fa-info-circle" style="color:var(--success);"></i> Facture <strong>${numero}</strong> · Reste à payer : <strong>${formatMoney(reste)}</strong>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Montant payé (MAD) *</label>
          <input id="pay-mnt" class="form-input" type="number" min="0" step="0.01" value="${reste}" placeholder="${reste}">
        </div>
        <div class="form-group"><label class="form-label">Mode de paiement</label>
          <select id="pay-mode" class="form-select">
            <option value="especes">💵 Espèces</option>
            <option value="cheque">📄 Chèque</option>
            <option value="virement">🏦 Virement bancaire</option>
            <option value="carte">💳 Carte bancaire</option>
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Référence / N° reçu</label>
          <input id="pay-ref" class="form-input" placeholder="Ex: CHQ-12345 ou VIR-2025-001">
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Notes</label>
          <input id="pay-notes" class="form-input" placeholder="Optionnel">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-success" onclick="savePaiement(${id})"><i class="fas fa-check"></i> Confirmer le paiement</button>
    </div>`);
}

async function savePaiement(id) {
  const data = {
    montant: parseFloat(document.getElementById('pay-mnt').value),
    mode: document.getElementById('pay-mode').value,
    reference: document.getElementById('pay-ref').value.trim(),
    notes: document.getElementById('pay-notes').value.trim(),
  };
  if (isNaN(data.montant)||data.montant<=0) return toast('Montant invalide','error');
  try {
    loading(true);
    const r = await API.post(`/api/factures/${id}/paiement`, data);
    loading(false); closeModal();
    toast(r.statut==='payee'?'Facture soldée intégralement ✓':'Paiement partiel enregistré');
    showPage('facturation');
  } catch(err) { loading(false); toast(err.message,'error'); }
}

async function viewFacture(id) {
  const f = await API.get(`/api/factures/${id}`);
  modal(`
    <div class="modal-header">
      <div class="modal-title">Facture ${f.numero}</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="padding:16px;background:var(--bg);border-radius:8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:13px;font-weight:600;">${f.prenom} ${f.nom}</div>
            <div style="font-size:12px;color:var(--muted);">${f.classe_nom||''} · ${f.numero_matricule}</div>
            <div style="font-size:12px;color:var(--muted);">${f.telephone||''}</div>
          </div>
          <div style="text-align:right;">
            <div>${statutBadge(f.statut)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px;">Émise: ${formatDate(f.date_emission)}</div>
            <div style="font-size:12px;color:var(--muted);">Échéance: ${formatDate(f.date_echeance)}</div>
          </div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px;">Description</div>
        <div style="font-size:14px;">${f.description||'—'}</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <div style="flex:1;padding:14px;background:var(--bg);border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Montant</div>
          <div style="font-size:20px;font-weight:800;">${formatMoney(f.montant)}</div>
        </div>
        <div style="flex:1;padding:14px;background:#d1fae5;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Payé</div>
          <div style="font-size:20px;font-weight:800;color:var(--success);">${formatMoney(f.montant_paye)}</div>
        </div>
        <div style="flex:1;padding:14px;background:${f.montant-f.montant_paye>0?'#fee2e2':'#d1fae5'};border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;">Reste</div>
          <div style="font-size:20px;font-weight:800;color:${f.montant-f.montant_paye>0?'var(--danger)':'var(--success)'};">${formatMoney(Math.max(0,f.montant-f.montant_paye))}</div>
        </div>
      </div>
      ${f.paiements&&f.paiements.length?`
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">Historique des paiements</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th></tr></thead>
          <tbody>${f.paiements.map(p=>`<tr>
            <td>${formatDate(p.date_paiement)}</td>
            <td style="font-weight:700;color:var(--success);">${formatMoney(p.montant)}</td>
            <td>${{especes:'💵 Espèces',cheque:'📄 Chèque',virement:'🏦 Virement',carte:'💳 Carte'}[p.mode]||p.mode}</td>
            <td><code style="font-size:11px;">${p.reference||'—'}</code></td>
          </tr>`).join('')}</tbody>
        </table></div>`:''
      }
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
      <button class="btn btn-outline" onclick="imprimerFacture(${f.id});closeModal()"><i class="fas fa-print"></i> Imprimer</button>
      ${f.statut!=='payee'&&(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-success" onclick="closeModal();openPaiement(${f.id},'${f.numero}',${f.montant-f.montant_paye})"><i class="fas fa-cash-register"></i> Payer</button>`:''}
    </div>`,`max-w-2xl`);
}

async function imprimerFacture(id) {
  const f = await API.get(`/api/factures/${id}`);
  const w = window.open('','_blank','width=800,height=600');
  w.document.write(`<!DOCTYPE html><html><head><title>Facture ${f.numero}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #2563eb;}
    .logo{font-size:24px;font-weight:900;color:#0f1b35;}
    .logo-sub{font-size:12px;color:#64748b;margin-top:4px;}
    .badge-payee{background:#d1fae5;color:#065f46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;}
    .badge-impayee{background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;}
    .badge-partielle{background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;}
    table{width:100%;border-collapse:collapse;margin:20px 0;}
    th{background:#f8fafc;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;}
    td{padding:12px 10px;border-bottom:1px solid #f1f5f9;}
    .total-row td{font-weight:700;font-size:15px;background:#f8fafc;}
    .footer{margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;}
    @media print{body{padding:20px;}}
  </style></head><body>
  <div class="header">
    <div><div class="logo">مدرستي · MADRASATI</div><div class="logo-sub">Système de Gestion Scolaire</div></div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:800;color:#2563eb;">${f.numero}</div>
      <div class="badge-${f.statut}">${{payee:'✓ Payée',impayee:'✗ Impayée',partielle:'~ Partielle'}[f.statut]||f.statut}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px;">
    <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Facturé à</div>
      <div style="font-weight:700;font-size:15px;">${f.prenom} ${f.nom}</div>
      <div style="color:#64748b;font-size:13px;">${f.classe_nom||''}</div>
      <div style="color:#64748b;font-size:13px;">${f.telephone||''}</div>
      <div style="color:#64748b;font-size:13px;">${f.adresse||'Maroc'}</div>
    </div>
    <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Détails</div>
      <div style="font-size:13px;"><strong>Date émission:</strong> ${new Date(f.date_emission).toLocaleDateString('fr-MA')}</div>
      <div style="font-size:13px;"><strong>Date échéance:</strong> ${f.date_echeance?new Date(f.date_echeance).toLocaleDateString('fr-MA'):'—'}</div>
      <div style="font-size:13px;"><strong>Matricule:</strong> ${f.numero_matricule}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right;">Montant (MAD)</th></tr></thead>
    <tbody>
      <tr><td>${f.description||'Prestation scolaire'}</td><td style="text-align:right;font-weight:600;">${parseFloat(f.montant).toLocaleString('fr-MA',{minimumFractionDigits:2})}</td></tr>
      <tr class="total-row"><td>Total</td><td style="text-align:right;">${parseFloat(f.montant).toLocaleString('fr-MA',{minimumFractionDigits:2})} MAD</td></tr>
      ${f.montant_paye>0?`<tr><td style="color:#059669;">Montant payé</td><td style="text-align:right;color:#059669;">- ${parseFloat(f.montant_paye).toLocaleString('fr-MA',{minimumFractionDigits:2})} MAD</td></tr>`:''}
      ${f.montant-f.montant_paye>0?`<tr class="total-row"><td style="color:#dc2626;">Reste à payer</td><td style="text-align:right;color:#dc2626;">${parseFloat(Math.max(0,f.montant-f.montant_paye)).toLocaleString('fr-MA',{minimumFractionDigits:2})} MAD</td></tr>`:''}
    </tbody>
  </table>
  ${f.notes?`<div style="padding:12px;background:#f8fafc;border-radius:6px;font-size:13px;color:#64748b;margin-top:8px;"><strong>Notes:</strong> ${f.notes}</div>`:''}
  <div style="display:flex;justify-content:space-between;margin-top:48px;padding-top:20px;border-top:1px solid #e2e8f0;">
    <div style="text-align:center;"><div style="font-size:11px;color:#94a3b8;">Signature du Parent</div><div style="height:48px;border-bottom:1px solid #94a3b8;margin-top:40px;width:140px;"></div></div>
    <div style="text-align:center;"><div style="font-size:11px;color:#94a3b8;">Cachet & Signature</div><div style="height:48px;border-bottom:1px solid #94a3b8;margin-top:40px;width:140px;"></div></div>
  </div>
  <div class="footer">Madrasati · Système de Gestion Scolaire · ${new Date().getFullYear()} · Document généré le ${new Date().toLocaleDateString('fr-MA')}</div>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 500);
}
