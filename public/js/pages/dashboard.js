async function renderDashboard(container) {
  const stats = await API.get('/api/dashboard');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Bonjour, ${currentUser.prenom} 👋</div>
        <div class="page-sub">${new Date().toLocaleDateString('fr-MA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
      </div>
    </div>

    <!-- STAT CARDS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-icon" style="background:#dbeafe;"><i class="fas fa-user-graduate" style="color:#2563eb;"></i></div>
        <div>
          <div class="stat-val">${stats.totalEleves}</div>
          <div class="stat-label">Élèves actifs</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#d1fae5;"><i class="fas fa-chalkboard-teacher" style="color:#059669;"></i></div>
        <div>
          <div class="stat-val">${stats.totalProfs}</div>
          <div class="stat-label">Enseignants</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#ede9fe;"><i class="fas fa-school" style="color:#7c3aed;"></i></div>
        <div>
          <div class="stat-val">${stats.totalClasses}</div>
          <div class="stat-label">Classes</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fee2e2;"><i class="fas fa-file-invoice-dollar" style="color:#dc2626;"></i></div>
        <div>
          <div class="stat-val">${stats.facturesImpayees}</div>
          <div class="stat-label">Factures impayées</div>
          <div style="font-size:11px;color:var(--danger);font-weight:600;">${formatMoney(stats.montantImpaye)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef3c7;"><i class="fas fa-user-times" style="color:#d97706;"></i></div>
        <div>
          <div class="stat-val">${stats.absencesToday}</div>
          <div class="stat-label">Absences aujourd'hui</div>
        </div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

      <!-- Annonces -->
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:16px;font-weight:700;color:var(--text);"><i class="fas fa-bullhorn" style="color:var(--accent);margin-right:8px;"></i>Dernières annonces</div>
          <button class="btn btn-outline btn-sm" onclick="showPage('annonces')">Voir tout</button>
        </div>
        ${stats.annonces.length === 0 ? '<div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:28px">📢</div><p>Aucune annonce</p></div>' :
          stats.annonces.map(a => `
          <div style="padding:12px;background:var(--bg);border-radius:8px;margin-bottom:8px;border-left:3px solid var(--accent);">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">${a.titre}</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.5;">${a.contenu.substring(0,100)}...</div>
            <div style="font-size:11px;color:var(--muted);margin-top:6px;"><i class="fas fa-clock"></i> ${formatDate(a.date_publication)}</div>
          </div>`).join('')
        }
      </div>

      <!-- Top Élèves -->
      <div class="card">
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px;"><i class="fas fa-trophy" style="color:#f59e0b;margin-right:8px;"></i>Top Élèves</div>
        ${stats.topEleves.length === 0 ? '<div class="empty-state" style="padding:20px"><p>Aucune note saisie</p></div>' :
          stats.topEleves.map((e, i) => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="width:28px;height:28px;border-radius:50%;background:${i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#b45309':'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:white;">${i+1}</div>
            <div class="avatar" style="width:32px;height:32px;font-size:11px;">${initials(e.nom, e.prenom)}</div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:var(--text);">${e.prenom} ${e.nom}</div>
              <div style="font-size:11px;color:var(--muted);">${e.classe || '—'}</div>
            </div>
            <div style="font-size:16px;font-weight:800;color:${noteColor(e.moyenne)};">${e.moyenne}/20</div>
          </div>`).join('')
        }
      </div>

      <!-- Dernières factures -->
      <div class="card" style="grid-column:1/-1;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:16px;font-weight:700;color:var(--text);"><i class="fas fa-receipt" style="color:var(--success);margin-right:8px;"></i>Dernières factures</div>
          <button class="btn btn-outline btn-sm" onclick="showPage('facturation')">Voir tout</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>N° Facture</th><th>Élève</th><th>Montant</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${stats.recentsFactures.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted)">Aucune facture</td></tr>' :
                stats.recentsFactures.map(f => `
                <tr>
                  <td><code style="font-size:12px;background:var(--bg);padding:2px 8px;border-radius:4px;">${f.numero}</code></td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar" style="width:28px;height:28px;font-size:10px;">${initials(f.nom, f.prenom)}</div>
                      <span>${f.prenom} ${f.nom}</span>
                    </div>
                  </td>
                  <td style="font-weight:700;">${formatMoney(f.montant)}</td>
                  <td>${statutBadge(f.statut)}</td>
                  <td>${formatDate(f.date_emission)}</td>
                  <td><button class="btn btn-outline btn-sm" onclick="showPage('facturation')"><i class="fas fa-eye"></i></button></td>
                </tr>`).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Raccourcis rapides
  if ((currentUser.role === 'admin' || currentUser.role === 'super')) {
    const quickActions = document.createElement('div');
    quickActions.style.cssText = 'display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;';
    quickActions.innerHTML = `
      <button class="btn btn-primary" onclick="showPage('eleves');setTimeout(()=>openAddEleve(),300)"><i class="fas fa-plus"></i> Nouvel élève</button>
      <button class="btn btn-outline" onclick="showPage('facturation');setTimeout(()=>openAddFacture(),300)"><i class="fas fa-file-invoice"></i> Nouvelle facture</button>
      <button class="btn btn-outline" onclick="showPage('annonces');setTimeout(()=>openAddAnnonce(),300)"><i class="fas fa-bullhorn"></i> Publier annonce</button>
    `;
    container.querySelector('.page-header').after(quickActions);
  }
}
