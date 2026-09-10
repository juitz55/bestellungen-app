/**
 * Bestellungen Handy App - Core Logic
 */

(function () {
  'use strict';

  // --- Initial / Sample Data ---
  const SAMPLE_ORDERS = [
    {
      id: 'ord-101',
      title: 'Brot (Bauernbrot)',
      name: 'Bäckerei Müller',
      date: getRelativeDate(0), // Heute
      amount: 4.50,
      status: 'open',
      notes: 'Frisch geschnitten',
      createdAt: Date.now() - 3600000
    },
    {
      id: 'ord-102',
      title: 'Semmeln & Gebäck',
      name: 'Café Sonnenschein',
      date: getRelativeDate(1),
      amount: 12.80,
      status: 'in_progress',
      notes: '10x Kaisersemmeln',
      createdAt: Date.now() - 86400000
    },
    {
      id: 'ord-103',
      title: 'Kornspitz & Brezen',
      name: 'Familie Weber',
      date: getRelativeDate(-1),
      amount: 6.90,
      status: 'completed',
      notes: 'Abgeholt und bezahlt',
      createdAt: Date.now() - 172800000
    }
  ];

  function getRelativeDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  // --- App State ---
  let orders = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let currentSort = 'date-desc';

  // --- Sync State ---
  let lastServerHash = '';
  let syncIntervalId = null;
  const syncStatusBadgeEl = document.getElementById('syncStatusBadge');
  const syncStatusTextEl = document.getElementById('syncStatusText');

  // --- DOM Elements ---
  const ordersListEl = document.getElementById('ordersList');
  const emptyStateEl = document.getElementById('emptyState');
  const searchInputEl = document.getElementById('searchInput');
  const sortSelectEl = document.getElementById('sortSelect');
  const filterChipsEl = document.getElementById('filterChips');

  // Stats
  const statOpenCountEl = document.getElementById('statOpenCount');
  const statDueTodayCountEl = document.getElementById('statDueTodayCount');
  const statTotalSumEl = document.getElementById('statTotalSum');
  const listCountEl = document.getElementById('listCount');

  // Filter Badges
  const badgeAllEl = document.getElementById('badgeAll');
  const badgeOpenEl = document.getElementById('badgeOpen');
  const badgeDueTodayEl = document.getElementById('badgeDueToday');
  const badgeThisWeekEl = document.getElementById('badgeThisWeek');
  const badgeCompletedEl = document.getElementById('badgeCompleted');

  // Modal: Order
  const orderModalEl = document.getElementById('orderModal');
  const orderFormEl = document.getElementById('orderForm');
  const modalTitleEl = document.getElementById('modalTitle');
  const addOrderBtn = document.getElementById('addOrderBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelFormBtn = document.getElementById('cancelFormBtn');

  // Form Fields
  const orderIdInput = document.getElementById('orderId');
  const orderTitleInput = document.getElementById('orderTitle');
  const orderNameInput = document.getElementById('orderName');
  const orderAmountInput = document.getElementById('orderAmount');
  const dateInput = document.getElementById('entryDate');
  const orderStatusInput = document.getElementById('orderStatus');
  const orderNotesInput = document.getElementById('orderNotes');

  // Modal: Backup / Export
  const backupModalEl = document.getElementById('backupModal');
  const backupModalBtn = document.getElementById('backupModalBtn');
  const closeBackupModalBtn = document.getElementById('closeBackupModalBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const importJsonInput = document.getElementById('importJsonInput');
  const sampleDataBtn = document.getElementById('sampleDataBtn');

  // Modal: Handy Connect & QR
  const connectModalEl = document.getElementById('connectModal');
  const connectPhoneBtn = document.getElementById('connectPhoneBtn');
  const closeConnectModalBtn = document.getElementById('closeConnectModalBtn');
  const qrcodeContainerEl = document.getElementById('qrcodeContainer');
  const phoneUrlDisplayEl = document.getElementById('phoneUrlDisplay');

  // Theme & Toast
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const toastEl = document.getElementById('toast');
  const toastMessageEl = document.getElementById('toastMessage');
  const currentDateDisplayEl = document.getElementById('currentDateDisplay');

  // --- Initialisierung ---
  function init() {
    loadTheme();
    loadOrders();
    setupHeaderDate();
    setupEventListeners();
    render();

    // Sofort ersten Server-Abgleich starten
    fetchOrdersFromServer(true);

    // Automatische Live-Synchronisation alle 3 Sekunden
    if (syncIntervalId) clearInterval(syncIntervalId);
    syncIntervalId = setInterval(() => {
      fetchOrdersFromServer(false);
    }, 3000);
  }

  function setupHeaderDate() {
    const today = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    currentDateDisplayEl.textContent = today.toLocaleDateString('de-DE', options);
  }

  // --- Storage & Live Sync ---
  function loadOrders() {
    const raw = localStorage.getItem('bestellungen_data');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          orders = parsed.map(o => ({
            ...o,
            name: o.name || o.customer || '',
            date: o.date || new Date().toISOString().split('T')[0]
          }));
        } else {
          orders = SAMPLE_ORDERS;
        }
      } catch (e) {
        console.error('Fehler beim Laden der Bestellungen:', e);
        orders = SAMPLE_ORDERS;
      }
    } else {
      orders = SAMPLE_ORDERS;
      saveOrders();
    }
  }

  function saveOrders() {
    localStorage.setItem('bestellungen_data', JSON.stringify(orders));
    pushOrdersToServer();
  }

  function setSyncStatus(state, text) {
    if (!syncStatusBadgeEl) return;
    syncStatusBadgeEl.classList.remove('offline', 'syncing');
    if (state === 'offline') {
      syncStatusBadgeEl.classList.add('offline');
      if (syncStatusTextEl) syncStatusTextEl.textContent = text || 'Offline';
      syncStatusBadgeEl.title = 'Keine Verbindung zum Server (lokal gespeichert)';
    } else if (state === 'syncing') {
      syncStatusBadgeEl.classList.add('syncing');
      if (syncStatusTextEl) syncStatusTextEl.textContent = text || 'Gleiche ab...';
      syncStatusBadgeEl.title = 'Bestellungen werden synchronisiert...';
    } else {
      if (syncStatusTextEl) syncStatusTextEl.textContent = text || 'Synchronisiert';
      syncStatusBadgeEl.title = 'Alle Handys auf demselben Stand. Tippen zum manuellen Abgleich.';
    }
  }

  async function pushOrdersToServer() {
    if (!navigator.onLine) {
      setSyncStatus('offline', 'Offline');
      return;
    }

    try {
      setSyncStatus('syncing', 'Speichern...');
      const payload = JSON.stringify(orders);
      const res = await fetch('./api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (res.ok) {
        lastServerHash = payload;
        setSyncStatus('online', 'Synchronisiert');
      } else {
        setSyncStatus('offline', 'Offline');
      }
    } catch (err) {
      setSyncStatus('offline', 'Offline');
    }
  }

  async function fetchOrdersFromServer(force = false) {
    if (!navigator.onLine) {
      setSyncStatus('offline', 'Offline');
      return;
    }

    const isModalOpen = orderModalEl && orderModalEl.classList.contains('open');

    try {
      const res = await fetch('./api/orders?t=' + Date.now(), {
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const serialized = JSON.stringify(data);
          if (serialized !== lastServerHash || force) {
            lastServerHash = serialized;

            if (data.length === 0 && orders.length > 0) {
              await pushOrdersToServer();
              return;
            }

            if (data.length > 0) {
              orders = data.map(o => ({
                ...o,
                name: o.name || o.customer || '',
                date: o.date || new Date().toISOString().split('T')[0]
              }));
              localStorage.setItem('bestellungen_data', JSON.stringify(orders));
              if (!isModalOpen) {
                render();
              }
            }
          }
          setSyncStatus('online', 'Synchronisiert');
        }
      } else {
        setSyncStatus('offline', 'Offline');
      }
    } catch (err) {
      setSyncStatus('offline', 'Offline');
    }
  }

  // --- Theme Management ---
  function loadTheme() {
    const saved = localStorage.getItem('app_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
    updateThemeIcon();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app_theme', next);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeToggleBtn.innerHTML = isDark
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }

  // --- Filter & Sort ---
  function isDueToday(dateStr) {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  }

  function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const target = new Date(dateStr);
    const now = new Date();
    
    // Start of week (Monday)
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    // End of week (Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return target >= monday && target <= sunday;
  }

  function getFilteredOrders() {
    const today = new Date().toISOString().split('T')[0];

    return orders.filter(item => {
      const itemDate = item.date || '';
      const itemName = item.name || item.customer || '';

      // 1. Text Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchName = itemName.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        const matchDate = itemDate.includes(q);
        if (!matchTitle && !matchName && !matchNotes && !matchDate) {
          return false;
        }
      }

      // 2. Chip Filter
      switch (currentFilter) {
        case 'open':
          return item.status === 'open' || item.status === 'in_progress';
        case 'dueToday':
          return itemDate === today && item.status !== 'completed' && item.status !== 'cancelled';
        case 'thisWeek':
          return isThisWeek(itemDate) && item.status !== 'cancelled';
        case 'completed':
          return item.status === 'completed';
        case 'all':
        default:
          return true;
      }
    });
  }

  function sortOrdersList(list) {
    return list.slice().sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      const nameA = a.name || a.customer || '';
      const nameB = b.name || b.customer || '';

      switch (currentSort) {
        case 'date-desc':
          return dateB.localeCompare(dateA);
        case 'date-asc':
          return dateA.localeCompare(dateB);
        case 'amount-desc':
          return (b.amount || 0) - (a.amount || 0);
        case 'name-asc':
          return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '', 'de', { sensitivity: 'base' });
        default:
          return 0;
      }
    });
  }

  // --- Format Helpers ---
  function formatDate(isoStr) {
    if (!isoStr) return 'Keine Angabe';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return isoStr;
  }

  function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }

  const STATUS_LABELS = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    completed: 'Geliefert',
    cancelled: 'Storniert'
  };

  // --- Render Functions ---
  function render() {
    updateKPIs();
    renderFilterBadges();

    const filtered = getFilteredOrders();
    const sorted = sortOrdersList(filtered);

    listCountEl.textContent = `${sorted.length} ${sorted.length === 1 ? 'Bestellung' : 'Bestellungen'}`;

    if (sorted.length === 0) {
      ordersListEl.innerHTML = '';
      emptyStateEl.style.display = 'block';
      return;
    }

    emptyStateEl.style.display = 'none';

    ordersListEl.innerHTML = sorted.map(item => {
      const itemDate = item.date || '';
      const itemName = item.name || item.customer || '';
      const isUrgent = item.status !== 'completed' && item.status !== 'cancelled' && isOverdue(itemDate);
      const isToday = item.status !== 'completed' && item.status !== 'cancelled' && isDueToday(itemDate);

      let dueBadgeHtml = '';
      if (isToday) {
        dueBadgeHtml = '<span style="color:#2563eb; font-weight:700; background:#dbeafe; padding:2px 8px; border-radius:10px; font-size:0.72rem;">HEUTE</span>';
      } else if (isUrgent) {
        dueBadgeHtml = '<span style="color:#dc2626; font-weight:700; background:#fee2e2; padding:2px 8px; border-radius:10px; font-size:0.72rem;">ÜBERFÄLLIG</span>';
      }

      return `
        <article class="order-card status-${item.status}" data-id="${item.id}">
          <div class="order-top">
            <div class="order-title-group">
              <h3 class="order-title">${escapeHtml(item.title)}</h3>
              ${itemName ? `
                <div class="order-name">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>${escapeHtml(itemName)}</span>
                </div>
              ` : ''}
            </div>
            ${item.amount ? `<div class="order-price">${formatCurrency(item.amount)}</div>` : ''}
          </div>

          <div class="order-dates">
            <div class="date-item">
              <span class="date-lbl">Datum:</span>
              <span class="date-val ${isUrgent || isToday ? 'date-urgent' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${formatDate(itemDate)}
              </span>
            </div>
            <div>
              ${dueBadgeHtml}
            </div>
          </div>

          ${item.notes ? `
            <div class="order-notes">
              ${escapeHtml(item.notes)}
            </div>
          ` : ''}

          <div class="order-footer">
            <span class="status-badge status-${item.status}" onclick="window.appCycleStatus('${item.id}')" title="Klicken, um Status zu wechseln">
              ${STATUS_LABELS[item.status] || item.status}
            </span>

            <div class="card-actions">
              <button class="action-btn" onclick="window.appEditOrder('${item.id}')" title="Bearbeiten">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Ändern
              </button>
              <button class="action-btn btn-delete" onclick="window.appDeleteOrder('${item.id}')" title="Löschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function updateKPIs() {
    const today = new Date().toISOString().split('T')[0];

    const openOrders = orders.filter(o => o.status === 'open' || o.status === 'in_progress');
    const dueTodayOrders = orders.filter(o => o.date === today && o.status !== 'completed' && o.status !== 'cancelled');
    const openSum = openOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

    statOpenCountEl.textContent = openOrders.length;
    statDueTodayCountEl.textContent = dueTodayOrders.length;
    statTotalSumEl.textContent = formatCurrency(openSum);
  }

  function renderFilterBadges() {
    const today = new Date().toISOString().split('T')[0];

    badgeAllEl.textContent = orders.length;
    badgeOpenEl.textContent = orders.filter(o => o.status === 'open' || o.status === 'in_progress').length;
    badgeDueTodayEl.textContent = orders.filter(o => o.date === today && o.status !== 'completed' && o.status !== 'cancelled').length;
    badgeThisWeekEl.textContent = orders.filter(o => isThisWeek(o.date) && o.status !== 'cancelled').length;
    badgeCompletedEl.textContent = orders.filter(o => o.status === 'completed').length;
  }

  // --- Modal Form Actions ---
  function openAddModal() {
    modalTitleEl.textContent = 'Neue Bestellung';
    orderIdInput.value = '';
    orderFormEl.reset();

    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    orderStatusInput.value = 'open';

    orderModalEl.classList.add('open');
    setTimeout(() => orderTitleInput.focus(), 250);
  }

  function openEditModal(id) {
    const item = orders.find(o => o.id === id);
    if (!item) return;

    modalTitleEl.textContent = 'Bestellung bearbeiten';
    orderIdInput.value = item.id;
    orderTitleInput.value = item.title || '';
    orderNameInput.value = item.name || item.customer || '';
    orderAmountInput.value = item.amount !== undefined && item.amount !== null ? item.amount : '';
    dateInput.value = item.date || new Date().toISOString().split('T')[0];
    orderStatusInput.value = item.status || 'open';
    orderNotesInput.value = item.notes || '';

    orderModalEl.classList.add('open');
  }

  function closeModal() {
    orderModalEl.classList.remove('open');
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const id = orderIdInput.value.trim();
    const title = orderTitleInput.value.trim();
    const name = orderNameInput.value.trim();
    const amountVal = orderAmountInput.value.trim();
    const amount = amountVal ? parseFloat(amountVal) : 0;
    const date = dateInput.value;
    const status = orderStatusInput.value;
    const notes = orderNotesInput.value.trim();

    if (!title || !date) {
      showToast('Bitte Titel und Datum angeben!');
      return;
    }

    if (id) {
      // Vorhandene Bestellung aktualisieren
      const index = orders.findIndex(o => o.id === id);
      if (index !== -1) {
        orders[index] = {
          ...orders[index],
          title,
          name,
          amount,
          date,
          status,
          notes,
          updatedAt: Date.now()
        };
        showToast('Bestellung aktualisiert');
      }
    } else {
      // Neue Bestellung anlegen
      const newOrder = {
        id: 'ord-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        title,
        name,
        amount,
        date,
        status,
        notes,
        createdAt: Date.now()
      };
      orders.unshift(newOrder);
      showToast('Bestellung hinzugefügt');
    }

    saveOrders();
    closeModal();
    render();
  }

  // --- Quick Status Cycle ---
  const STATUS_CYCLE = ['open', 'in_progress', 'completed', 'cancelled'];
  window.appCycleStatus = function (id) {
    const item = orders.find(o => o.id === id);
    if (!item) return;

    const curIdx = STATUS_CYCLE.indexOf(item.status);
    const nextIdx = (curIdx + 1) % STATUS_CYCLE.length;
    item.status = STATUS_CYCLE[nextIdx];
    item.updatedAt = Date.now();

    saveOrders();
    render();
    showToast(`Status: ${STATUS_LABELS[item.status]}`);
  };

  // Global Handlers for inline onclick
  window.appEditOrder = function (id) {
    openEditModal(id);
  };

  window.appDeleteOrder = function (id) {
    const item = orders.find(o => o.id === id);
    if (!item) return;

    if (confirm(`Möchtest du die Bestellung "${item.title}" wirklich löschen?`)) {
      orders = orders.filter(o => o.id !== id);
      saveOrders();
      render();
      showToast('Bestellung gelöscht');
    }
  };

  // --- Export & Import ---
  function exportCSV() {
    if (orders.length === 0) {
      showToast('Keine Daten zum Exportieren!');
      return;
    }

    const headers = ['Bestellnummer / Titel', 'Name', 'Datum', 'Betrag EUR', 'Status', 'Notizen'];
    const rows = orders.map(o => [
      `"${(o.title || '').replace(/"/g, '""')}"`,
      `"${(o.name || o.customer || '').replace(/"/g, '""')}"`,
      `"${o.date || ''}"`,
      `"${(o.amount || 0).toFixed(2).replace('.', ',')}"`,
      `"${STATUS_LABELS[o.status] || o.status}"`,
      `"${(o.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bestellungen_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV-Datei heruntergeladen');
  }

  function exportJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(orders, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `Bestellungen_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('JSON-Backup heruntergeladen');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          if (confirm(`Es wurden ${imported.length} Bestellungen gefunden. Bestehende Daten ersetzen?`)) {
            orders = imported;
            saveOrders();
            render();
            backupModalEl.classList.remove('open');
            showToast(`${imported.length} Bestellungen wiederhergestellt`);
          }
        } else {
          showToast('Ungültiges Format (Kein Array)');
        }
      } catch (err) {
        showToast('Fehler beim Lesen der JSON-Datei');
      }
    };
    reader.readAsText(file);
  }

  function loadSampleData() {
    if (confirm('Möchtest du Beispieldaten laden?')) {
      orders = JSON.parse(JSON.stringify(SAMPLE_ORDERS));
      saveOrders();
      render();
      backupModalEl.classList.remove('open');
      showToast('Beispieldaten geladen');
    }
  }

  // --- Handy Verbinden Modal & QR-Code ---
  async function openConnectModal() {
    qrcodeContainerEl.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">QR-Code wird vorbereitet...</span>';
    connectModalEl.classList.add('open');

    let targetUrl = window.location.href;
    const isFileProtocol = window.location.protocol === 'file:';

    if (isFileProtocol) {
      phoneUrlDisplayEl.innerHTML = `
        <span style="color:#ef4444; font-size:0.8rem; display:block; margin-bottom:4px;">⚠️ Lokale Datei geöffnet (file://)</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">Ein Handy kann keine lokalen PC-Dateipfade öffnen. Bitte starte <strong>start_app.bat</strong> oder nutze den kostenlosen Online-Upload!</span>
      `;
      qrcodeContainerEl.innerHTML = `
        <div style="text-align:center; padding:10px; color:var(--text-muted); font-size:0.85rem;">
          <p style="margin-bottom:8px;">💡 <strong>So geht's:</strong></p>
          <p>1. Starte <strong>start_app.bat</strong> per Doppelklick</p>
          <p>2. Oder lade den Ordner kostenlos auf <strong>Netlify Drop</strong> hoch!</p>
        </div>
      `;
      return;
    }

    try {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const resp = await fetch('/api/ip', { cache: 'no-store' });
        if (resp.ok) {
          const info = await resp.json();
          if (info.ip) {
            targetUrl = `http://${info.ip}:${info.port || window.location.port || 8080}/`;
          }
        }
      }
    } catch (e) {
      console.warn('Konnte LAN-IP nicht ermitteln:', e);
    }

    phoneUrlDisplayEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${targetUrl}</span>
        <button id="copyUrlBtn" style="background:var(--primary); color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.75rem; cursor:pointer; flex-shrink:0;">Kopieren</button>
      </div>
    `;

    const copyBtn = document.getElementById('copyUrlBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(targetUrl).then(() => showToast('Adresse kopiert!'));
      });
    }

    qrcodeContainerEl.innerHTML = '';

    let qrSuccess = false;
    // 1. Versuch: Lokale QRCode-Bibliothek
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrcodeContainerEl, {
          text: targetUrl,
          width: 190,
          height: 190,
          colorDark: '#0f172a',
          colorLight: '#ffffff'
        });
        qrSuccess = true;
      }
    } catch (err) {
      console.warn('Lokaler QR-Code Generator Fehler:', err);
    }

    // 2. Fallback: Schneller Online-QR Bilddienst falls lokal fehlschlägt
    if (!qrSuccess || !qrcodeContainerEl.hasChildNodes()) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(targetUrl)}`;
      qrcodeContainerEl.innerHTML = `
        <img src="${qrApiUrl}" alt="QR-Code" width="190" height="190" style="display:block; border-radius:8px;" onerror="this.parentElement.innerHTML='<p style=\\'color:var(--text-muted); font-size:0.85rem;\\'>Konnte QR-Code nicht laden.<br>Bitte Adresse manuell eingeben.</p>'">
      `;
    }
  }

  // --- Toast ---
  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toastMessageEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  // --- Helper: XSS escape ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Theme toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Filter Chips
    filterChipsEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;

      filterChipsEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      render();
    });

    // Search Input
    searchInputEl.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    // Sort Select
    sortSelectEl.addEventListener('change', (e) => {
      currentSort = e.target.value;
      render();
    });

    // Order Modal Open / Close
    addOrderBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelFormBtn.addEventListener('click', closeModal);

    // Modal Sheet Click Outside
    orderModalEl.addEventListener('click', (e) => {
      if (e.target === orderModalEl) {
        closeModal();
      }
    });

    // Form Submit
    orderFormEl.addEventListener('submit', handleFormSubmit);

    // Backup Modal
    backupModalBtn.addEventListener('click', () => backupModalEl.classList.add('open'));
    closeBackupModalBtn.addEventListener('click', () => backupModalEl.classList.remove('open'));
    backupModalEl.addEventListener('click', (e) => {
      if (e.target === backupModalEl) backupModalEl.classList.remove('open');
    });

    // Connect Phone Modal
    connectPhoneBtn.addEventListener('click', openConnectModal);
    closeConnectModalBtn.addEventListener('click', () => connectModalEl.classList.remove('open'));
    connectModalEl.addEventListener('click', (e) => {
      if (e.target === connectModalEl) connectModalEl.classList.remove('open');
    });

    exportCsvBtn.addEventListener('click', exportCSV);
    exportJsonBtn.addEventListener('click', exportJSON);
    sampleDataBtn.addEventListener('click', loadSampleData);
    importJsonInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importJSON(e.target.files[0]);
        e.target.value = '';
      }
    });

    // PWA Installation Banner
    let deferredInstallPrompt = null;
    const pwaInstallBannerEl = document.getElementById('pwaInstallBanner');
    const pwaInstallBtnEl = document.getElementById('pwaInstallBtn');
    const pwaDismissBtnEl = document.getElementById('pwaDismissBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (!isStandalone && pwaInstallBannerEl) {
        pwaInstallBannerEl.style.display = 'flex';
      }
    });

    if (pwaInstallBtnEl) {
      pwaInstallBtnEl.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const choiceResult = await deferredInstallPrompt.userChoice;
          if (choiceResult && choiceResult.outcome === 'accepted') {
            showToast('App wird zum Startbildschirm hinzugefügt...');
          }
          deferredInstallPrompt = null;
          if (pwaInstallBannerEl) pwaInstallBannerEl.style.display = 'none';
        } else {
          showToast('Tippe im Browser-Menü auf "Zum Startbildschirm"');
        }
      });
    }

    if (pwaDismissBtnEl && pwaInstallBannerEl) {
      pwaDismissBtnEl.addEventListener('click', () => {
        pwaInstallBannerEl.style.display = 'none';
      });
    }

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (pwaInstallBannerEl) pwaInstallBannerEl.style.display = 'none';
      showToast('Erfolgreich als App installiert!');
    });

    // Sync beim Wiederöffnen / Sichtbarwerden der App
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchOrdersFromServer(false);
      }
    });

    // Online / Offline Statuswechsel
    window.addEventListener('online', () => {
      setSyncStatus('syncing', 'Verbinde...');
      fetchOrdersFromServer(true);
    });

    window.addEventListener('offline', () => {
      setSyncStatus('offline', 'Offline');
    });

    // Manueller Abgleich beim Tippen auf das Sync-Symbol
    if (syncStatusBadgeEl) {
      syncStatusBadgeEl.addEventListener('click', () => {
        setSyncStatus('syncing', 'Gleiche ab...');
        fetchOrdersFromServer(true).then(() => {
          showToast('Synchronisierung abgeschlossen');
        });
      });
    }
  }

  // App starten
  document.addEventListener('DOMContentLoaded', init);
})();
