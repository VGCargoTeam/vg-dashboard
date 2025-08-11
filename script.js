// Charter Dashboard Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzo-FgxA6TMJYK4xwLbrsRnNTAU_AN-FEJJoZH6w7aJ3BlcsaB751LjdUJ9nieGtu1P/exec'; // <<< AKTUALISIERT: NEUER LINK VOM BENUTZER

let currentUser = null; // Speichert den aktuell angemeldeten Benutzer
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

// Globale Variablen für Chart-Instanzen, um sie bei Bedarf zu zerstören
let tonnagePerMonthChartInstance = null;
let tonnagePerCustomerChartInstance = null;

// Variable zum Speichern der aktuell im Modal angezeigten Daten
let currentModalData = null;
let currentInvoiceRef = null;

// NEU: Variablen für Benutzerverwaltung
let allUsers = [];
let editingUsername = null;

// NEU: Variablen für Kundenverwaltung (CRM)
let allCustomers = [];
let editingCustomerID = null;


// === AUTHENTIFIZIERUNG UND BENUTZERVERWALTUNG ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    updateUIBasedOnUserRole();
    fetchData(); // Daten laden, wenn angemeldet
    if (currentUser.role === 'admin') {
        fetchCustomers(); // CRM-Daten nur für Admins laden
    }
  } else {
    // Wenn nicht angemeldet, zur Login-Seite umleiten
    window.location.href = 'login.html';
  }
}

function updateUIBasedOnUserRole() {
  const adminElements = document.querySelectorAll(".admin-only");
  const loggedInUsernameSpan = document.getElementById('loggedInUsername');
  const loggedInUserRoleSpan = document.getElementById('loggedInUserRole');

  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;

    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = "inline-block"); // Oder 'block', je nach Element
    } else {
      adminElements.forEach(el => el.style.display = "none");
    }
  } else {
    adminElements.forEach(el => el.style.display = "none");
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'N/A';
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = 'N/A';
  }
}

function openProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) { // Sicherstellen, dass das Modal existiert
    profileModal.style.display = 'flex'; // Modal anzeigen
    // Initialwerte setzen
    const newPassInput = document.getElementById('newPasswordInput');
    const confirmPassInput = document.getElementById('confirmPasswordInput');
    const passwordChangeMessage = document.getElementById('passwordChangeMessage');
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
    if (passwordChangeMessage) passwordChangeMessage.textContent = '';
  } else {
    console.warn("Profil-Modal (id='profileModal') nicht gefunden.");
  }
}

function closeProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.style.display = 'none'; // Modal schließen
  }
}

async function changePassword() {
  const oldPass = prompt("Please enter your current password to confirm the change:"); // For security, ask for current password
  if (oldPass === null) { // User cancelled
      return;
  }

  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;
  const messageElem = document.getElementById('passwordChangeMessage');

  if (!messageElem) {
    console.error("Passwortänderungs-Nachrichtenelement nicht gefunden.");
    return;
  }

  if (newPass === '' || confirmPass === '') {
    messageElem.textContent = 'Bitte beide Passwortfelder ausfüllen.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'Neue Passwörter stimmen nicht überein.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) { // Beispiel: Mindestlänge
      messageElem.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.';
      messageElem.style.color = 'red';
      return;
  }
  if (currentUser.username === undefined) {
      messageElem.textContent = 'Benutzername für Passwortänderung nicht verfügbar.';
      messageElem.style.color = 'red';
      return;
  }

  const payload = {
      mode: 'updatePassword',
      username: currentUser.username, // Der Benutzer, dessen Passwort geändert werden soll
      oldPassword: oldPass, // Aktuelles Passwort zur Verifizierung
      newPassword: newPass, // Neues Passwort
      user: currentUser.name // Für Audit-Log
  };

  try {
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
          messageElem.textContent = 'Passwort erfolgreich geändert! Bitte melden Sie sich neu an.';
          messageElem.style.color = 'green';
          // Leere die Felder nach erfolgreicher Änderung
          const newPassInput = document.getElementById('newPasswordInput');
          const confirmPassInput = document.getElementById('confirmPasswordInput');
          if (newPassInput) newPassInput.value = '';
          if (confirmPassInput) confirmPassInput.value = '';

          // Optional: Automatische Abmeldung nach erfolgreicher Passwortänderung
          setTimeout(() => {
              logoutUser();
          }, 2000);

      } else {
          messageElem.textContent = result.message || 'Fehler beim Ändern des Passworts.';
          messageElem.style.color = 'red';
      }
  } catch (error) {
      console.error('Passwortänderungsfehler:', error);
      messageElem.textContent = 'Ein Fehler ist beim Ändern des Passworts aufgetreten. Bitte versuchen Sie es später erneut.';
      messageElem.style.color = 'red';
  }
}

function logoutUser() {
  localStorage.removeItem('currentUser'); // Sitzung beenden
  currentUser = null;
  window.location.href = 'login.html'; // Zur Login-Seite umleiten
}

// === DATENABRUF UND TABELLEN-RENDERUNG ===
function fetchData() {
  fetch(API_URL + "?mode=read")
    .then(r => {
      if (!r.ok) {
        throw new Error(`HTTP-Fehler! Status: ${r.status}`);
      }
      return r.json();
    })
    .then(d => {
      requestData = d.data; // Speichert das Array der Daten
      console.log("Rohdaten von API:", JSON.parse(JSON.stringify(d.data))); // Zum Debuggen
      filterTable(); // Ruft filterTable auf, um sowohl Tabelle als auch Kalender zu aktualisieren
    })
    .catch((error) => {
      console.error("Fehler beim Laden der Daten:", error);
      showSaveFeedback("Fehler beim Laden der Daten!", false);
    });
}

// GEÄNDERT: Funktion zum Rendern beider Tabellen
function renderRequestTables(dataToRender = requestData) {
    const unconfirmedTbody = document.querySelector("#unconfirmedTable tbody");
    const confirmedTbody = document.querySelector("#confirmedTable tbody");

    if (!unconfirmedTbody || !confirmedTbody) {
        console.error("Tabellen für bestätigte oder unbestätigte Anfragen nicht gefunden.");
        return;
    }

    unconfirmedTbody.innerHTML = "";
    confirmedTbody.innerHTML = "";

    let unconfirmedFlights = 0;
    let unconfirmedWeight = 0;
    let confirmedFlights = 0;
    let confirmedWeight = 0;

    // Hilfsfunktion zum Erstellen einer Zeile
    const createRowHTML = (r) => {
        const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);

        let displayFlightDate = r['Flight Date'] || "-";
        if (displayFlightDate !== "-" && displayFlightDate.includes('-')) {
            try {
                const dateParts = displayFlightDate.split('-');
                const dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                displayFlightDate = dateObj.toLocaleDateString('de-DE', { timeZone: 'UTC' });
            } catch (e) {
                 console.error("Fehler bei der Datumskonvertierung für die Anzeige in Tabelle:", displayFlightDate, e);
            }
        }

        const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';
        const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';
        
        const isInvoiced = String(r.RechnungErstellt || '').toLowerCase() === 'ja';
        const invoiceStatusHTML = isInvoiced 
            ? `<a href="javascript:void(0);" onclick="openInvoiceModal('${r.Ref}', true)" class="text-green-600 font-bold underline">${r.Rechnungsnummer || 'Ansehen'}</a>` 
            : '<span class="text-red-600">Offen</span>';

        // Status Indikator Logik
        const status = r.Status || 'Angefragt';
        let statusColorClass = '';
        switch (status) {
            case 'Angefragt': statusColorClass = 'bg-blue-500'; break;
            case 'Bestätigt': statusColorClass = 'bg-green-500'; break;
            case 'Abgerechnet': statusColorClass = 'bg-yellow-500'; break;
            case 'Archiviert': statusColorClass = 'bg-gray-800'; break;
            case 'Storniert': statusColorClass = 'bg-red-500'; break;
            default: statusColorClass = 'bg-gray-400';
        }
        const statusIndicatorHTML = `<span class="status-indicator ${statusColorClass}">${status}</span>`;

        const row = document.createElement("tr");
        row.innerHTML = `
          <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
          <td>${statusIndicatorHTML}</td>
          <td>${displayFlightDate}</td>
          <td>${r.Airline || "-"}</td>
          <td>${ton.toLocaleString('de-DE')}</td>
          <td>${invoiceStatusHTML}</td>
          <td>
            <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button>
            ${deleteButtonHTML}
          </td>
        `;
        return { row, ton, isConfirmed };
    };

    dataToRender.forEach(r => {
        const { row, ton, isConfirmed } = createRowHTML(r);
        if (isConfirmed) {
            confirmedTbody.appendChild(row);
            confirmedFlights++;
            confirmedWeight += ton;
        } else {
            unconfirmedTbody.appendChild(row);
            unconfirmedFlights++;
            unconfirmedWeight += ton;
        }
    });

    document.getElementById("unconfirmedSummaryInfo").textContent =
        `Total Flights: ${unconfirmedFlights} | Total Tonnage: ${unconfirmedWeight.toLocaleString('de-DE')} kg`;
    document.getElementById("confirmedSummaryInfo").textContent =
        `Total Flights: ${confirmedFlights} | Total Tonnage: ${confirmedWeight.toLocaleString('de-DE')} kg`;

    updateUIBasedOnUserRole();
}


function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearch = (document.getElementById("flightNumberSearch")?.value || '').toLowerCase();
  const invoiceNumberSearch = (document.getElementById("invoiceNumberSearch")?.value || '').toLowerCase();
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false;

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch);
    const matchesInvoiceNumber = (r.Rechnungsnummer || '').toLowerCase().includes(invoiceNumberSearch);

    let flightDateObj = null;
    if (r['Flight Date'] && typeof r['Flight Date'] === 'string' && r['Flight Date'].includes('-')) {
        const parts = r['Flight Date'].split('-');
        flightDateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }

    let matchesDateRange = true;
    if (fromDateInput || toDateInput) {
        if (!flightDateObj) {
            matchesDateRange = false;
        } else {
            if (fromDateInput) {
                const fromDateObj = new Date(Date.UTC.apply(null, fromDateInput.split('-').map((n, i) => i === 1 ? n - 1 : n)));
                if (flightDateObj < fromDateObj) matchesDateRange = false;
            }
            if (toDateInput) {
                const toDateObj = new Date(Date.UTC.apply(null, toDateInput.split('-').map((n, i) => i === 1 ? n - 1 : n)));
                if (flightDateObj > toDateObj) matchesDateRange = false;
            }
        }
    }
    
    // GEÄNDERTE LOGIK: Standardmäßig nur aktuelle und zukünftige Flüge anzeigen.
    // Vergangene Flüge gelten als "Archiv" und werden nur angezeigt, wenn die Checkbox aktiviert ist.
    let passesArchiveFilter = true;
    if (!showArchive) { // Wenn "Archiv anzeigen" NICHT aktiviert ist
        if (!flightDateObj || flightDateObj < today) {
            passesArchiveFilter = false; // Verstecke Flüge, die in der Vergangenheit liegen oder kein Datum haben
        }
    }

    return matchesRef && matchesAirline && matchesFlightNumber && matchesInvoiceNumber && matchesDateRange && passesArchiveFilter;
  });
  renderRequestTables(filtered);
  renderCalendars();
}

// === MODAL FUNKTIONEN ===
function openModal(originalIndex) {
  if (!currentUser) {
      console.error("Versuch, Modal ohne angemeldeten Benutzer zu öffnen. Weiterleitung zum Login.");
      showSaveFeedback("Bitte melden Sie sich an, um diese Funktion zu nutzen.", false);
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      return;
  }

  const isNewRequest = originalIndex === -1;
  const r = isNewRequest ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'),
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein",
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Ja",
    'Service Description Accepted': "Ja",
    'Accepted By Name': "",
    'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein",
    'Flight Type Import': "Nein",
    'Flight Type Export': "Nein",
    'Origin': '',
    'Destination': '',
    'Status': 'Angefragt' // Standardstatus für neue Anfragen
  } : requestData[originalIndex];

  currentModalData = r;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  const section = (title, contentHTML, colorClass = '') => {
    const wrap = document.createElement("div");
    wrap.className = `modal-section ${colorClass}`;
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type, content, options }) => {
      if (content) {
          return content;
      }
        
      let value = r[key];
      if (value === undefined || value === null) value = "";

      const isAlwaysReadOnlyField = [
          "Ref", "Created At", "Acceptance Timestamp", "Email Request", "Accepted By Name", "Final Confirmation Sent"
      ].includes(key);

      let readOnlyAttr = '';
      let styleAttr = '';

      if (isAlwaysReadOnlyField) {
          readOnlyAttr = 'readonly';
          styleAttr = 'background-color:#eee; cursor: not-allowed;';
      }

      const isPriceRelatedOrZusatzkostenField = [
        'Rate', 'Security charges', 'Dangerous Goods',
        '10ft consumables', '20ft consumables', 'Zusatzkosten'
      ].includes(key);

      if (isPriceRelatedOrZusatzkostenField && currentUser.role === 'viewer') {
          return '';
      }
      
      if (key === "Rechnungsnummer") {
        if (r.RechnungErstellt === 'Ja' && r.Rechnungsnummer) {
          return `<label>${label}:</label><p><a href="javascript:void(0);" onclick="openInvoiceModal('${r.Ref}', true)" class="text-blue-600 font-bold underline">${r.Rechnungsnummer}</a></p>`;
        } else {
          return `<label>${label}:</label><p>Noch nicht erstellt</p>`;
        }
      }

      if (key === "Status") {
        const statusOptions = ['Angefragt', 'Bestätigt', 'Abgerechnet', 'Archiviert', 'Storniert'];
        let optionsHTML = statusOptions.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
        return `<label>${label}:</label><select name="${key}">${optionsHTML}</select>`;
      }


      if (key === "Flight Date") {
        let dateValue = "";
        if (value) {
            try {
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    dateValue = value;
                } else if (value instanceof Date) {
                    dateValue = value.toISOString().split('T')[0];
                }
            } catch (e) {
                console.error("Fehler beim Parsen des Flugdatums für Modal-Input:", value, e);
            }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${dateValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "Abflugzeit") {
        let timeValue = "";
        if (value) {
            if (typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)) {
                timeValue = value;
            } else if (value instanceof Date) {
                timeValue = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            }
        }
        return `<label>${label}:</label><input type="time" name="${key}" value="${timeValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") {
          const icon = '&#10004;';
          const color = 'green';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if (key === "Vorfeldbegleitung" && type === "checkbox") {
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (['Tonnage'].includes(key)) {
          const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
          return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (key === "Email Request") {
          return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      } else if (key === "Flight Type Import") {
          const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
          const originInput = (String(r['Flight Type Import']).toLowerCase() === 'ja') ? `<label>Origin:</label><input type="text" name="Origin" value="${r.Origin || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
          return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Origin')"> ${label}</label>${originInput}`;
      } else if (key === "Flight Type Export") {
          const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
          const destinationInput = (String(r['Flight Type Export']).toLowerCase() === 'ja') ? `<label>Destination:</label><input type="text" name="Destination" value="${r.Destination || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
          return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Destination')"> ${label}</label>${destinationInput}`;
      } else if (key === "Final Confirmation Sent") {
          const statusText = String(value).toLowerCase() === 'ja' ? 'Ja (Gesendet)' : 'Nein (Nicht gesendet)';
          const statusColor = String(value).toLowerCase() === 'ja' ? 'green' : 'red';
          return `<label>${label}: <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></label>`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}" />`;
    }).join("");
  };

  // ===== CRM Integration =====
  let customerFields;
  if (isNewRequest && currentUser.role === 'admin' && allCustomers.length > 0) {
      let options = '<option value="">-- Bestandskunden auswählen --</option>';
      allCustomers.sort((a,b) => a['Billing Company'].localeCompare(b['Billing Company'])).forEach(c => {
          options += `<option value="${c.KundenID}">${c['Billing Company']}</option>`;
      });

      customerFields = [
          { label: "Ref", key: "Ref" },
          { label: "Status", key: "Status" },
          { label: "Created At", key: "Created At" },
          {
              label: "Kunde aus CRM auswählen",
              key: "customerSelector",
              content: `
                  <label for="customerSelector">Kunde aus CRM auswählen</label>
                  <select id="customerSelector" onchange="populateCustomerFields(this.value)">
                      ${options}
                  </select>
              `
          },
          { label: "Billing Company", key: "Billing Company" },
          { label: "Billing Address", key: "Billing Address" },
          { label: "Tax Number", key: "Tax Number" },
          { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
          { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" },
          { label: "AGB Accepted", key: "AGB Accepted" },
          { label: "Service Description Accepted", key: "Service Description Accepted" },
          { label: "Accepted By Name", key: "Accepted By Name" },
          { label: "Acceptance Timestamp", key: "Acceptance Timestamp" },
          { label: "Final Confirmation Sent", key: "Final Confirmation Sent" },
          { label: "Rechnungsnummer", key: "Rechnungsnummer" }
      ];
  } else {
      // Standard-Ansicht für bestehende Einträge oder wenn kein Admin/keine Kunden
      customerFields = [
          { label: "Ref", key: "Ref" },
          { label: "Status", key: "Status" },
          { label: "Created At", key: "Created At" },
          { label: "Billing Company", key: "Billing Company" },
          { label: "Billing Address", key: "Billing Address" },
          { label: "Tax Number", key: "Tax Number" },
          { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
          { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" },
          { label: "AGB Accepted", key: "AGB Accepted" },
          { label: "Service Description Accepted", key: "Service Description Accepted" },
          { label: "Accepted By Name", key: "Accepted By Name" },
          { label: "Acceptance Timestamp", key: "Acceptance Timestamp" },
          { label: "Final Confirmation Sent", key: "Final Confirmation Sent" },
          { label: "Rechnungsnummer", key: "Rechnungsnummer" }
      ];
  }

  const flightFields = [
    { label: "Airline", key: "Airline" },
    { label: "Aircraft Type", key: "Aircraft Type" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Flight Date", key: "Flight Date" },
    { label: "Abflugzeit", key: "Abflugzeit" },
    { label: "Tonnage", key: "Tonnage" },
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" },
    { label: "Flight Type Import", key: "Flight Type Import", type: "checkbox" }, // NEU
    { label: "Flight Type Export", key: "Flight Type Export", type: "checkbox" }, // NEU
    { label: "E-Mail Request", key: "Email Request" }
  ];

  // Preisbezogene Felder, die nur für Admins sichtbar sind
  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea" } // Zusatzkosten als Textarea
  ];

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields), 'bg-green-50'));

  if (currentUser && currentUser.role === 'admin') {
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
        let value = r[key] || "";
        if (key === "Zusatzkosten") {
            return `<label>${label}:</label><textarea name="${key}" placeholder="Labeln, Fotos" style="height:80px">${value}</textarea>`;
        } else if (key === "Dangerous Goods") {
            const options = ["Ja", "Nein", "N/A"];
            return `<label>${label}:</label>
                    <select name="${key}">
                        ${options.map(opt => `<option value="${opt}" ${String(value).toLowerCase() === opt.toLowerCase() ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>`;
        } else {
            const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
            return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" />`;
        }
    }).join("");

    modalBody.appendChild(section("Preisdetails", priceDetailsHTML, 'bg-yellow-50'));
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "20px";

  if (currentUser) {
    const saveButton = document.createElement("button");
    saveButton.textContent = "Speichern";
    saveButton.onclick = saveDetails;
    saveButton.style.padding = "10px 20px";
    saveButton.style.fontWeight = "bold";
    saveButton.style.backgroundColor = "#28a745";
    saveButton.style.color = "white";
    saveButton.style.border = "none";
    saveButton.style.borderRadius = "6px";
    saveButton.style.cursor = "pointer";
    buttonContainer.appendChild(saveButton);
  }

  const historyButton = document.createElement("button");
  historyButton.textContent = "History";
  historyButton.style.padding = "10px 20px";
  historyButton.style.fontWeight = "bold";
  historyButton.style.backgroundColor = "#17a2b8";
  historyButton.style.color = "white";
  historyButton.style.border = "none";
  historyButton.style.borderRadius = "6px";
  historyButton.style.cursor = "pointer";
  historyButton.onclick = () => showHistory(r.Ref);
  buttonContainer.appendChild(historyButton);

  if (currentUser && originalIndex !== -1) {
      const sendConfirmationButton = document.createElement("button");
      sendConfirmationButton.textContent = "Final Charter Confirmation senden";
      sendConfirmationButton.style.padding = "10px 20px";
      sendConfirmationButton.style.fontWeight = "bold";
      sendConfirmationButton.style.backgroundColor = "#007BFF";
      sendConfirmationButton.style.color = "white";
      sendConfirmationButton.style.border = "none";
      sendConfirmationButton.style.borderRadius = "6px";
      sendConfirmationButton.style.cursor = "pointer";
      sendConfirmationButton.onclick = () => openEmailConfirmationModal(r);
      buttonContainer.appendChild(sendConfirmationButton);
  }

  if (currentUser && currentUser.role === 'admin' && originalIndex !== -1) {
    const deleteButtonModal = document.createElement("button");
    deleteButtonModal.textContent = "Eintrag löschen";
    deleteButtonModal.className = "btn btn-delete";
    deleteButtonModal.style.padding = "10px 20px";
    deleteButtonModal.style.fontWeight = "bold";
    deleteButtonModal.style.backgroundColor = "#dc3545";
    deleteButtonModal.style.color = "white";
    deleteButtonModal.style.border = "none";
    deleteButtonModal.style.borderRadius = "6px";
    deleteButtonModal.style.cursor = "pointer";
    deleteButtonModal.onclick = () => deleteRowFromModal(r.Ref);
    buttonContainer.appendChild(deleteButtonModal);
  }

  modalBody.appendChild(buttonContainer);

  modal.style.display = "flex";
}

// NEU: Funktion zum Befüllen der Kundendaten aus dem CRM-Dropdown
function populateCustomerFields(kundenID) {
    const modalBody = document.getElementById("modalBody");
    const selectedCustomer = allCustomers.find(c => c.KundenID === kundenID);

    if (selectedCustomer) {
        modalBody.querySelector('input[name="Billing Company"]').value = selectedCustomer['Billing Company'] || '';
        modalBody.querySelector('input[name="Billing Address"]').value = selectedCustomer['Billing Address'] || '';
        modalBody.querySelector('input[name="Tax Number"]').value = selectedCustomer['Tax Number'] || '';
        modalBody.querySelector('input[name="Contact Name Invoicing"]').value = selectedCustomer['Contact Name Invoicing'] || '';
        modalBody.querySelector('input[name="Contact E-Mail Invoicing"]').value = selectedCustomer['Contact E-Mail Invoicing'] || '';
    } else {
        // Leere die Felder, wenn die "Auswählen"-Option gewählt wird
        modalBody.querySelector('input[name="Billing Company"]').value = '';
        modalBody.querySelector('input[name="Billing Address"]').value = '';
        modalBody.querySelector('input[name="Tax Number"]').value = '';
        modalBody.querySelector('input[name="Contact Name Invoicing"]').value = '';
        modalBody.querySelector('input[name="Contact E-Mail Invoicing"]').value = '';
    }
}


// NEU: Funktion zum Umschalten der Origin/Destination Felder basierend auf Checkbox
function toggleOriginDestinationFields(checkbox, fieldType) {
    const parentLabel = checkbox.closest('label');
    let inputElement = parentLabel.nextElementSibling;

    if (!inputElement || (inputElement.tagName !== 'INPUT' && inputElement.tagName !== 'LABEL')) {
        const sectionDiv = checkbox.closest('.modal-section');
        if (sectionDiv) {
            inputElement = sectionDiv.querySelector(`input[name="${fieldType}"]`);
        }
    }

    if (checkbox.checked) {
        if (!inputElement || inputElement.name !== fieldType) {
            const newLabel = document.createElement('label');
            newLabel.textContent = `${fieldType}:`;
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.name = fieldType;
            newInput.value = currentModalData[fieldType] || '';
            newInput.style.cssText = 'width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px;';

            parentLabel.parentNode.insertBefore(newLabel, parentLabel.nextSibling);
            newLabel.parentNode.insertBefore(newInput, newLabel.nextSibling);
        } else {
            inputElement.style.display = '';
            if (inputElement.previousElementSibling.tagName === 'LABEL') {
                inputElement.previousElementSibling.style.display = '';
            }
        }
    } else {
        if (inputElement && inputElement.name === fieldType) {
            inputElement.style.display = 'none';
            if (inputElement.previousElementSibling.tagName === 'LABEL') {
                inputElement.previousElementSibling.style.display = 'none';
            }
        }
        if (currentModalData) {
            currentModalData[fieldType] = '';
        }
    }
}


// Neue Funktion, die vom Modal aus den Löschvorgang startet und dann das Modal schließt
async function deleteRowFromModal(ref) {
  const isConfirmed = confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Eintrag gelöscht!", true);
    } else {
      showSaveFeedback(`Fehler beim Löschen des Eintrags! ${responseData.message || ''}`, false);
      console.error("Löschen fehlgeschlagen:", responseData);
    }
    closeModal();
    fetchData();
  } catch (err) {
    showSaveFeedback("Fehler beim Löschen!", false);
    console.error(err);
  }
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal();
    closeProfileModal();
    closeStatisticsModal();
    closeEmailConfirmationModal();
    closeEmailPreviewModal();
    closeInvoiceListModal();
    closeInvoiceModal();
    closeUserManagementModal();
    closeCustomerManagementModal();
  }
});

async function saveDetails() {
  const isConfirmed = confirm('Sind Sie sicher, dass Sie diese Änderungen speichern möchten?');
  if (!isConfirmed) {
    return;
  }

  // Start with the essential data: Ref, mode, and user
  const data = {
    Ref: currentModalData.Ref, // Use the Ref from the data object that opened the modal
    mode: "write",
    user: currentUser.name
  };

  // If Ref is missing, something is wrong.
  if (!data.Ref) {
    showSaveFeedback("Fehler: Referenznummer nicht gefunden. Speichern abgebrochen.", false);
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled]), #modalBody select[name]:not([disabled])");
  
  // Add all other form values to the data object
  inputs.forEach(i => {
    // Skip Ref because we already have it.
    if (i.name === 'Ref') return;

    if (i.name === "Flight Date") {
        data[i.name] = i.value;
    } else if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(i.name)) {
        data[i.name] = i.value.replace(/,/g, '.').replace('€', '').trim() || "";
    } else {
        if (i.type === "checkbox") {
            data[i.name] = i.checked ? "Ja" : "Nein";
        } else {
            data[i.name] = i.value;
        }
    }
  });

  console.log('Payload for saving:', data);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Gespeichert!", true);
    } else {
      showSaveFeedback(`Fehler beim Speichern! ${responseData.message || ''}`, false);
      console.error("Speichern fehlgeschlagen:", responseData);
    }
    closeModal();
    fetchData();
  } catch (err) {
    showSaveFeedback("Fehler beim Speichern!", false);
    console.error(err);
  }
}

async function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;

  const isConfirmed = confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Eintrag gelöscht!", true);
    } else {
      showSaveFeedback(`Fehler beim Löschen des Eintrags! ${responseData.message || ''}`, false);
      console.error("Löschen fehlgeschlagen:", responseData);
    }
    fetchData();
  } catch (err) {
    showSaveFeedback("Fehler beim Löschen!", false);
    console.error(err);
  }
}

// === KALENDER FUNKTIONEN ===
function shiftCalendar(offset) {
  baseMonth += offset;
  if (baseMonth < 0) { baseMonth += 12; baseYear--; }
  if (baseMonth > 11) { baseMonth -= 12; baseYear++; }
  renderCalendars();
}

function renderCalendars() {
  const container = document.getElementById("calendarArea");
  container.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const m = baseMonth + i;
    const y = baseYear + Math.floor(m / 12);
    const month = (m % 12 + 12) % 12;
    container.innerHTML += generateCalendarHTML(y, month);
  }
}

function openCalendarDayFlights(year, month, day) {
  console.log(`Clicked on calendar day: Jahr ${year}, Monat ${month + 1}, Tag ${day}`);

  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date'];
    const isMatch = flightDateFromData === clickedDateStr;
    return isMatch;
  });

  if (flightsOnThisDay.length > 0) {
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.findIndex(item => item.Ref === firstFlight.Ref);
    if (originalIndex !== -1) {
      openModal(originalIndex);
    }
  }
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' });
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;

  const todayCal = new Date();
  todayCal.setHours(0, 0, 0, 0);

  const flightsByDay = new Map();
  requestData.forEach((r) => {
    if (r['Flight Date'] && typeof r['Flight Date'] === 'string' && r['Flight Date'].match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [fYear, fMonth, fDay] = r['Flight Date'].split('-').map(Number);
        if (fYear === year && (fMonth - 1) === month) {
            if (!flightsByDay.has(fDay)) {
              flightsByDay.set(fDay, []);
            }
            flightsByDay.get(fDay).push(r);
        }
    }
  });

  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 0; j < 7; j++) {
      if ((i === 0 && j < firstDayOfMonthWeekday) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const currentCalendarDayForCell = new Date(year, month, day);
        currentCalendarDayForCell.setHours(0,0,0,0);

        const flightsForDay = flightsByDay.get(day) || [];
        let cellClasses = ['calendar-day'];
        let tooltipContentArray = [];
        let dayHasVorfeldbegleitung = false;
        let hasImport = false;
        let hasExport = false;

        if (currentCalendarDayForCell.getTime() === todayCal.getTime()) {
            cellClasses.push('today-red-text');
        }

        if (flightsForDay.length > 0) {
          flightsForDay.forEach(f => {
            const tonnageValue = parseFloat(String(f.Tonnage).replace(',', '.') || "0") || 0;
            let formattedAbflugzeit = f['Abflugzeit'] || '-';
            
            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlugnummer: ${f.Flugnummer || '-'}` +
              `\nAbflugzeit: ${formattedAbflugzeit}` +
              `\nTonnage: ${tonnageValue.toLocaleString('de-DE')} kg`
            );
            if (f.Origin) tooltipContentArray[tooltipContentArray.length - 1] += `\nOrigin: ${f.Origin}`;
            if (f.Destination) tooltipContentArray[tooltipContentArray.length - 1] += `\nDestination: ${f.Destination}`;
            if (String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') dayHasVorfeldbegleitung = true;
            if (String(f['Flight Type Import']).toLowerCase() === 'ja') hasImport = true;
            if (String(f['Flight Type Export']).toLowerCase() === 'ja') hasExport = true;
          });
        }

        if (hasImport && hasExport) cellClasses.push('import-export');
        else if (hasImport) cellClasses.push('import-only');
        else if (hasExport) cellClasses.push('export-only');
        else if (flightsForDay.length > 0) cellClasses.push('has-flights');

        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';
        
        let dayNumberClass = 'font-bold text-lg';
        if (currentCalendarDayForCell.getTime() === todayCal.getTime()) {
            dayNumberClass += ' today-red-text';
        }

        html += `<td class='${cellClasses.join(' ')}' data-tooltip='${dataTooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})"><div class="${dayNumberClass}">${day}</div>${flightIcon}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

// === UHRZEIT UND DATUM ===
document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus();
  updateClock();
  setInterval(updateClock, 1000);

  const archiveCheckbox = document.getElementById("archiveCheckbox");
  if (archiveCheckbox) {
      archiveCheckbox.addEventListener('change', filterTable);
  }
});

function updateClock() {
  const now = new Date();
  document.getElementById('currentDate').textContent = "Date: " + now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  document.getElementById('clock').textContent = "Time: " + now.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

// === NEUE ANFRAGE ERSTELLEN ===
function generateReference() {
  const now = new Date();
  const timestamp = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '').replace(/\//g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  openModal(-1);
}

// === FEEDBACK ANZEIGEN ===
function showSaveFeedback(message, success) {
  const feedback = document.createElement("div");
  feedback.textContent = message;
  feedback.style.position = "fixed";
  feedback.style.top = "20px";
  feedback.style.right = "20px";
  feedback.style.backgroundColor = success ? "#4CAF50" : "#f44336";
  feedback.style.color = "#fff";
  feedback.style.padding = "10px 16px";
  feedback.style.borderRadius = "8px";
  feedback.style.boxShadow = "0 8px 10px rgba(0,0,0,0.2)";
  feedback.style.zIndex = "9999";
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}

// NEUE FUNKTIONEN FÜR HISTORY MODAL
async function showHistory(ref) {
  const historyModal = document.getElementById("historyModal");
  const historyBody = document.getElementById("historyBody");
  const historyRefSpan = document.getElementById("historyRef");

  historyRefSpan.textContent = ref;
  historyBody.innerHTML = '<p style="text-align: center;">Lade Verlauf...</p>';
  historyModal.style.display = "flex";

  try {
    const response = await fetch(API_URL + "?mode=readAuditLog");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const auditResult = await response.json();

    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p style="text-align: center;">Kein Verlauf für diese Referenz gefunden.</p>';
      return;
    }

    let historyHTML = '<ul style="list-style-type: none; padding: 0;">';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      let detailsContent = log.Details || '-';

      if (currentUser && currentUser.role === 'viewer' && typeof detailsContent === 'string') {
        const sensitiveFieldPrefixes = ['Rate:', 'Security charges:', 'Dangerous Goods:', '10ft consumables:', '20ft consumables:', 'Zusatzkosten:'];
        let processedDetailsParts = [];
        const detailParts = detailsContent.split(';').map(part => part.trim()).filter(part => part !== '');
        detailParts.forEach(part => {
            let redactedPart = part;
            for (const prefix of sensitiveFieldPrefixes) {
                if (part.startsWith(prefix)) {
                    redactedPart = `${prefix} [GESCHWÄRZT]`;
                    break;
                }
            }
            processedDetailsParts.push(redactedPart);
        });
        detailsContent = processedDetailsParts.join('; ');
      }

      try {
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              detailsContent = 'Gelöschte Daten: <pre>' + JSON.stringify(parsedDetails, null, 2) + '</pre>';
          }
      } catch (e) {
          // It's not JSON, so display as is
      }

      historyHTML += `
        <li style="background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; padding: 15px;">
          <strong style="color: #007BFF;">Timestamp:</strong> ${log.Timestamp || '-'} <br>
          <strong style="color: #007BFF;">User:</strong> ${log.User || '-'} <br>
          <strong style="color: #007BFF;">Action:</strong> ${log.Action || '-'} <br>
          <strong style="color: #007BFF;">Details:</strong> ${detailsContent}
        </li>
      `;
    });
    historyHTML += '</ul>';
    historyBody.innerHTML = historyHTML;

  } catch (error) {
    console.error("Fehler beim Abrufen des Audit-Logs:", error);
    historyBody.innerHTML = '<p style="color: red; text-align: center;">Fehler beim Laden des Verlaufs: ' + error.message + '</p>';
  }
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

// === NEUE STATISTIK-FUNKTIONEN ===
function openStatisticsModal() {
    const statisticsModal = document.getElementById('statisticsModal');
    if (statisticsModal) {
        statisticsModal.style.display = 'flex';
        const statFromDateInput = document.getElementById('statFromDate');
        const statToDateInput = document.getElementById('statToDate');
        if (!statFromDateInput.value || !statToDateInput.value) {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            statFromDateInput.value = firstDayOfMonth;
            statToDateInput.value = lastDayOfMonth;
        }
        generateStatistics();
    }
}

function closeStatisticsModal() {
    document.getElementById("statisticsModal").style.display = "none";
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
        tonnagePerMonthChartInstance = null;
    }
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
        tonnagePerCustomerChartInstance = null;
    }
}

function generateStatistics() {
    const statFromDateInput = document.getElementById('statFromDate').value;
    const statToDateInput = document.getElementById('statToDate').value;
    const statisticsBody = document.getElementById('statisticsBody');
    
    statisticsBody.querySelectorAll('h4, p, ul, table').forEach(el => el.remove());

    if (!statFromDateInput || !statToDateInput) {
        statisticsBody.insertAdjacentHTML('beforeend', '<p style="text-align: center; color: red;">Bitte wählen Sie einen Start- und Enddatum für die Statistik.</p>');
        return;
    }

    const fromDate = new Date(statFromDateInput + 'T00:00:00Z');
    const toDate = new Date(statToDateInput + 'T23:59:59Z');

    const filteredData = requestData.filter(r => {
        const flightDateObj = r['Flight Date'] ? new Date(r['Flight Date'] + 'T00:00:00Z') : null;
        return flightDateObj && flightDateObj >= fromDate && flightDateObj <= toDate;
    });

    let totalFlights = filteredData.length;
    let totalTonnage = 0;
    let totalRevenue = 0;
    const dangerousGoodsCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    const vorfeldbegleitungCount = { "Ja": 0, "Nein": 0 };
    const tonnagePerMonth = {};
    const tonnagePerCustomer = {};

    filteredData.forEach(item => {
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        totalTonnage += tonnage;

        const rate = parseFloat(String(item.Rate).replace(',', '.') || "0") || 0;
        const security = parseFloat(String(item['Security charges']).replace(',', '.') || "0") || 0;
        const cons10ft = parseFloat(String(item['10ft consumables']).replace(',', '.') || "0") || 0;
        const cons20ft = parseFloat(String(item['20ft consumables']).replace(',', '.') || "0") || 0;
        totalRevenue += rate + security + cons10ft + cons20ft;

        const dgStatus = String(item['Dangerous Goods'] || 'N/A');
        dangerousGoodsCount[dgStatus]++;
        
        const vbStatus = String(item['Vorfeldbegleitung'] || 'Nein').toLowerCase() === 'ja' ? 'Ja' : 'Nein';
        vorfeldbegleitungCount[vbStatus]++;
        
        if (item['Flight Date']) {
            const yearMonth = item['Flight Date'].substring(0, 7);
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }
        
        const customerName = item['Billing Company'] || 'Unbekannt';
        tonnagePerCustomer[customerName] = (tonnagePerCustomer[customerName] || 0) + tonnage;
    });

    let statsHTML = '<h4>Gesamtübersicht</h4>';
    statsHTML += `<p>Gesamtzahl Flüge: <strong>${totalFlights}</strong></p>`;
    statsHTML += `<p>Gesamte Tonnage: <strong>${totalTonnage.toLocaleString('de-DE')} kg</strong></p>`;
    if (currentUser.role === 'admin') {
        statsHTML += `<p>Gesamtumsatz: <strong>${totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong></p>`;
    }
    
    statsHTML += '<h4>Vorfeldbegleitung</h4>';
    statsHTML += `<ul><li>Ja: ${vorfeldbegleitungCount["Ja"]}</li><li>Nein: ${vorfeldbegleitungCount["Nein"]}</li></ul>`;

    statsHTML += '<h4>Dangerous Goods (DGR)</h4>';
    statsHTML += `<ul><li>Ja: ${dangerousGoodsCount["Ja"]}</li><li>Nein: ${dangerousGoodsCount["Nein"]}</li><li>N/A: ${dangerousGoodsCount["N/A"]}</li></ul>`;
    
    const firstChartContainer = statisticsBody.querySelector('.chart-container');
    if (firstChartContainer) {
        firstChartContainer.insertAdjacentHTML('beforebegin', statsHTML);
    } else {
        statisticsBody.insertAdjacentHTML('beforeend', statsHTML);
    }
    
    renderTonnagePerMonthChart(tonnagePerMonth);
    renderTonnagePerCustomerChart(tonnagePerCustomer);
}

function renderTonnagePerMonthChart(data) {
    const ctx = document.getElementById('tonnagePerMonthChart');
    if (!ctx) return;
    const chartCtx = ctx.getContext('2d');
    if (tonnagePerMonthChartInstance) tonnagePerMonthChartInstance.destroy();

    const labels = Object.keys(data).sort();
    const tonnageValues = labels.map(label => data[label]);

    tonnagePerMonthChartInstance = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: tonnageValues,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderTonnagePerCustomerChart(data) {
    const ctx = document.getElementById('tonnagePerCustomerChart');
    if (!ctx) return;
    const chartCtx = ctx.getContext('2d');
    if (tonnagePerCustomerChartInstance) tonnagePerCustomerChartInstance.destroy();

    const sortedCustomers = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 10);
    const labels = sortedCustomers.map(([customer]) => customer);
    const tonnageValues = sortedCustomers.map(([, tonnage]) => tonnage);

    tonnagePerCustomerChartInstance = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: tonnageValues,
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function downloadStatisticsToCSV() {
    const statFromDateInput = document.getElementById('statFromDate').value;
    const statToDateInput = document.getElementById('statToDate').value;

    if (!statFromDateInput || !statToDateInput) {
        showSaveFeedback("Bitte wählen Sie einen Start- und Enddatum für den Download aus.", false);
        return;
    }

    const fromDate = new Date(statFromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(statToDateInput);
    toDate.setHours(23, 59, 59, 999);

    const filteredData = requestData.filter(r => {
        let flightDateFromData = r['Flight Date'];
        let flightDateObj;

        if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = flightDateFromData.split('-');
            flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else if (flightDateFromData instanceof Date) {
            flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
        } else {
            flightDateObj = new Date('Invalid Date');
        }
        flightDateObj.setHours(0, 0, 0, 0);

        return flightDateObj >= fromDate && flightDateObj <= toDate;
    });

    let csvContent = "";

    // --- Gesamtübersicht Statistik ---
    let totalFlights = filteredData.length;
    let totalTonnage = 0;

    filteredData.forEach(item => {
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        totalTonnage += tonnage;
    });

    csvContent += "Gesamtuebersicht\n";
    csvContent += "Gesamtzahl Fluege," + totalFlights + "\n";
    csvContent += "Gesamte Tonnage (kg)," + totalTonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 }) + "\n"; // Nutze en-US für CSV-Konsistenz
    csvContent += "\n"; // Leere Zeile zur Trennung

    // --- Dangerous Goods Statistik ---
    const dangerousGoodsCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    filteredData.forEach(item => {
        // Sicherstellen, dass item['Dangerous Goods'] immer ein String ist
        const dgStatus = String(item['Dangerous Goods'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Dangerous Goods'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        dangerousGoodsCount[dgStatus]++;
    });
    csvContent += "Dangerous Goods Statistik\n";
    csvContent += "Status,Anzahl,Prozentsatz\n";
    csvContent += `Ja,${dangerousGoodsCount["Ja"]},${(dangerousGoodsCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    csvContent += `Nein,${dangerousGoodsCount["Nein"]},${(dangerousGoodsCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    if (dangerousGoodsCount["N/A"] > 0) {
        csvContent += `Nicht angegeben,${dangerousGoodsCount["N/A"]},${(dangerousGoodsCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    }
    csvContent += "\n";

    // --- Vorfeldbegleitung Statistik ---
    const VorfeldbegleitungCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    filteredData.forEach(item => {
        const vbStatus = String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        VorfeldbegleitungCount[vbStatus]++;
    });
    csvContent += "Vorfeldbegleitung Statistik\n";
    csvContent += "Status,Anzahl,Prozentsatz\n";
    csvContent += `Ja,${VorfeldbegleitungCount["Ja"]},${(VorfeldbegleitungCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    csvContent += `Nein,${VorfeldbegleitungCount["Nein"]},${(VorfeldbegleitungCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    if (VorfeldbegleitungCount["N/A"] > 0) {
        csvContent += `Nicht angegeben,${VorfeldbegleitungCount["N/A"]},${(VorfeldbegleitungCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%\n`;
    }
    csvContent += "\n";

    // --- Tonnage pro Monat Statistik ---
    const tonnagePerMonth = {};
    filteredData.forEach(item => {
        const flightDate = item['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const yearMonth = flightDate.substring(0, 7); // "YYYY-MM"
            const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }
    });
    csvContent += "Tonnage pro Monat\n";
    csvContent += "Monat,Tonnage (kg)\n";
    Object.keys(tonnagePerMonth).sort().forEach(month => {
        csvContent += `${month},${tonnagePerMonth[month].toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}\n`;
    });
    csvContent += "\n";

    // --- Tonnage pro Kunde Statistik ---
    const tonnagePerCustomer = {};
    filteredData.forEach(item => {
        const customerName = item['Billing Company'] || 'Unbekannt';
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        tonnagePerCustomer[customerName] = (tonnagePerCustomer[customerName] || 0) + tonnage;
    });
    csvContent += "Tonnage pro Kunde\n";
    csvContent += "Kunde,Tonnage (kg)\n";
    // Sortiere Kunden nach Tonnage absteigend für bessere Lesbarkeit
    Object.entries(tonnagePerCustomer).sort(([, a], [, b]) => b - a).forEach(([customer, tonnage]) => {
        csvContent += `"${customer}",${tonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}\n`; // Kundenname in Anführungszeichen setzen, um Kommas zu behandeln
    });
    csvContent += "\n";

    // --- Airline Statistik ---
    const airlineStats = {};
    filteredData.forEach(item => {
        const airlineName = item.Airline || 'Unbekannt';
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;

        if (!airlineStats[airlineName]) {
            airlineStats[airlineName] = { totalTonnage: 0, totalFlights: 0 };
        }
        airlineStats[airlineName].totalTonnage += tonnage;
        airlineStats[airlineName].totalFlights++;
    });

    csvContent += "Statistik nach Airline\n";
    let airlineHeader = "Airline,Fluege,Tonnage (kg)";
    csvContent += airlineHeader + "\n";

    Object.entries(airlineStats).sort(([, a], [, b]) => b.totalFlights - a.totalFlights).forEach(([airlineName, stats]) => {
        let row = `"${airlineName}",${stats.totalFlights},${stats.totalTonnage.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })}`;
        csvContent += row + "\n";
    });

    // Erstelle ein Blob und lade es herunter
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature-Erkennung für das HTML5-Download-Attribut
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Charter_Dashboard_Statistik_${statFromDateInput}_bis_${statToDateInput}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showSaveFeedback("Statistik erfolgreich heruntergeladen!", true);
    } else {
        // Fallback für Browser, die das Download-Attribut nicht unterstützen (heute weniger wahrscheinlich)
        showSaveFeedback("Ihr Browser unterstützt das direkt Herunterladen nicht. Bitte kopieren Sie den Text manuell.", false);
        console.warn("Download-Attribut wird nicht unterstützt. Fallback erforderlich.");
    }
}

// === NEUE E-MAIL BESTÄTIGUNGSFUNKTIONEN ===
function openEmailConfirmationModal(data) {
    // Setze das aktuelle Datenobjekt für die E-Mail-Funktion
    currentModalData = data;
    const emailConfirmationModal = document.getElementById('emailConfirmationModal');
    const recipientEmailInput = document.getElementById('recipientEmailInput');
    const emailConfirmationMessage = document.getElementById('emailConfirmationMessage');

    // Versuche, die E-Mail-Adresse des Kunden vorab auszufüllen
    if (currentModalData && currentModalData['Contact E-Mail Invoicing']) {
        recipientEmailInput.value = currentModalData['Contact E-Mail Invoicing'];
    } else {
        recipientEmailInput.value = '';
    }
    emailConfirmationMessage.textContent = ''; // Alte Nachrichten löschen
    emailConfirmationModal.style.display = 'flex';
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
    document.getElementById('recipientEmailInput').value = ''; // Eingabefeld leeren
    document.getElementById('emailConfirmationMessage').textContent = ''; // Nachricht leeren
}

document.getElementById('sendEmailConfirmBtn').addEventListener('click', async () => {
    const recipientEmailInput = document.getElementById('recipientEmailInput');
    const emailConfirmationMessage = document.getElementById('emailConfirmationMessage');
    const recipientEmail = recipientEmailInput.value.trim();

    if (!recipientEmail) {
        emailConfirmationMessage.textContent = 'Bitte geben Sie eine Empfänger-E-Mail-Adresse ein.';
        emailConfirmationMessage.style.color = 'red';
        return;
    }

    // Einfache E-Mail-Validierung
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
        emailConfirmationMessage.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
        emailConfirmationMessage.style.color = 'red';
        return;
    }

    // Deaktiviere den Button während des Sendens
    const sendButton = document.getElementById('sendEmailConfirmBtn');
    sendButton.disabled = true;
    sendButton.textContent = 'Senden...';
    emailConfirmationMessage.textContent = 'Sende E-Mail...';
    emailConfirmationMessage.style.color = 'blue';

    try {
        const emailSubject = `Charter Bestätigung für Referenz: ${currentModalData.Ref || 'N/A'}`;
        
        // Erstelle den Payload und füge ALLE Daten aus currentModalData hinzu
        const payload = {
            mode: 'sendConfirmationEmail',
            to: recipientEmail,
            from: 'sales@vgcargo.de', // Feste Absenderadresse
            bcc: 'sales@vgcargo.de, import@vgcargo.de, export@vgcargo.de', // Feste BCC-Adressen
            subject: emailSubject,
            ref: currentModalData.Ref, // Referenz für Audit-Log
            user: currentUser.name // Aktueller Benutzer für Audit-Log
        };

        // Füge alle Eigenschaften von currentModalData zum Payload hinzu
        for (const key in currentModalData) {
            if (!payload.hasOwnProperty(key)) {
                if (currentModalData[key] instanceof Date) {
                    if (key === 'Flight Date') {
                        payload[key] = currentModalData[key].toISOString().split('T')[0];
                    } else {
                        payload[key] = currentModalData[key].toLocaleString('de-DE');
                    }
                } else {
                    payload[key] = currentModalData[key];
                }
            }
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            emailConfirmationMessage.textContent = 'Charter Bestätigung erfolgreich gesendet!';
            emailConfirmationMessage.style.color = 'green';
            showSaveFeedback("Charter Bestätigung gesendet!", true);
            const index = requestData.findIndex(item => item.Ref === currentModalData.Ref);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                filterTable();
            }
            setTimeout(() => {
                closeEmailConfirmationModal();
                closeModal();
                fetchData();
            }, 1500);
        } else {
            emailConfirmationMessage.textContent = result.message || 'Fehler beim Senden der E-Mail.';
            emailConfirmationMessage.style.color = 'red';
            showSaveFeedback("Fehler beim Senden der Bestätigung!", false);
        }
    } catch (error) {
        console.error('Fehler beim Senden der E-Mail:', error);
        emailConfirmationMessage.textContent = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
        emailConfirmationMessage.style.color = 'red';
        showSaveFeedback("Fehler beim Senden der Bestätigung!", false);
    } finally {
        sendButton.disabled = false;
        sendButton.textContent = 'Senden';
    }
});

// GEÄNDERT: Funktion zum Generieren des E-Mail-Bodys für die Vorschau
async function generateEmailPreview() {
    if (!currentModalData) {
        showSaveFeedback("Keine Daten für die E-Mail-Vorschau verfügbar.", false);
        return;
    }

    const emailPreviewModal = document.getElementById('emailPreviewModal');
    const previewRefSpan = document.getElementById('previewRef');
    const emailPreviewContent = document.getElementById('emailPreviewContent');

    previewRefSpan.textContent = currentModalData.Ref || 'N/A';
    emailPreviewContent.innerHTML = '<p style="text-align: center;">Lade Vorschau...</p>'; // Ladeanzeige
    emailPreviewModal.style.display = 'flex';

    try {
        const payload = {
            mode: 'generateEmailPreview', // KORRIGIERT: Modus an Backend angepasst
            ref: currentModalData.Ref,     // KORRIGIERT: Sende 'ref' statt 'data'
            userRole: currentUser.role
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success' && result.htmlContent) { // KORRIGIERT: Prüfe auf 'htmlContent'
            emailPreviewContent.innerHTML = result.htmlContent; // KORRIGIERT: HTML direkt aus 'htmlContent' rendern
        } else {
            emailPreviewContent.innerHTML = `<p style="color: red; text-align: center;">${result.message || 'Fehler beim Generieren der E-Mail-Vorschau.'}</p>`;
        }
    } catch (error) {
        console.error('Fehler beim Generieren der E-Mail-Vorschau:', error);
        emailPreviewContent.innerHTML = '<p style="color: red; text-align: center;">Ein unerwarteter Fehler ist aufgetreten beim Generieren der Vorschau.</p>';
    }
}


function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
    document.getElementById('emailPreviewContent').innerHTML = ''; // Inhalt leeren
}

// Event Listener für den Vorschau-Button
document.getElementById('previewEmailBtn').addEventListener('click', generateEmailPreview);

// KORRIGIERT: Funktion zum manuellen Markieren als "Final Confirmation Sent"
async function markAsSentManually() {
    if (!currentModalData || !currentModalData.Ref) {
        showSaveFeedback("Keine Referenzdaten zum Markieren verfügbar.", false);
        return;
    }

    const refToMark = currentModalData.Ref;
    const user = currentUser.name;

    const isConfirmed = confirm(`Möchten Sie die Charter Confirmation für Referenz "${refToMark}" wirklich manuell als 'gesendet' markieren?`);
    if (!isConfirmed) {
        return;
    }

    try {
        const payload = {
            mode: 'markAsSent', // KORRIGIERT: Modus an Backend angepasst ('markAsSent' statt 'markAsConfirmed')
            ref: refToMark,
            user: user,
            sendEmail: 'false' // Explizit angeben, dass keine E-Mail gesendet werden soll
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload).toString(),
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            showSaveFeedback(`Referenz ${refToMark} als 'gesendet' markiert!`, true);
            // Aktualisiere den lokalen Datenstatus und re-render die Tabelle
            const index = requestData.findIndex(item => item.Ref === refToMark);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                filterTable(); // Tabelle neu rendern, um den Haken anzuzeigen
            }
            closeEmailPreviewModal(); // Vorschau-Modal schließen
            closeModal(); // Detail-Modal schließen
            fetchData(); // Daten neu laden, um sicherzustellen, dass alles synchron ist
        } else {
            showSaveFeedback(result.message || 'Fehler beim Markieren als gesendet.', false);
        }
    } catch (error) {
        console.error('Fehler beim manuellen Markieren als gesendet:', error);
        showSaveFeedback('Ein Fehler ist beim Markieren als gesendet aufgetreten.', false);
    }
}

// Event Listener für den neuen Button "Charter Confirmation gesendet"
document.getElementById('markAsSentBtn').addEventListener('click', markAsSentManually);

// === NEUE RECHNUNGSFUNKTIONEN ===
function openInvoiceListModal() {
    const modal = document.getElementById('invoiceListModal');
    const body = document.getElementById('invoiceListBody');
    body.innerHTML = 'Lade Flüge...';

    const uninvoicedFlights = requestData.filter(r => 
        String(r.Status || '').toLowerCase() === 'bestätigt' &&
        String(r.RechnungErstellt || '').toLowerCase() !== 'ja'
    );

    if (uninvoicedFlights.length === 0) {
        body.innerHTML = '<p>Keine abzurechnenden Flüge gefunden.</p>';
    } else {
        let tableHTML = `<table class="w-full data-table">
            <thead><tr><th>Reference</th><th>Flugdatum</th><th>Airline</th><th>Aktion</th></tr></thead>
            <tbody>`;
        uninvoicedFlights.forEach(r => {
            const flightDate = r['Flight Date'] ? new Date(r['Flight Date'] + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' }) : '-';
            tableHTML += `<tr>
                <td><a href="javascript:void(0);" onclick="openInvoiceModal('${r.Ref}')">${r.Ref}</a></td>
                <td>${flightDate}</td>
                <td>${r.Airline || '-'}</td>
                <td><button class="btn btn-view" onclick="openInvoiceModal('${r.Ref}')">Rechnung erstellen</button></td>
            </tr>`;
        });
        tableHTML += `</tbody></table>`;
        body.innerHTML = tableHTML;
    }
    modal.style.display = 'flex';
}

function closeInvoiceListModal() {
    document.getElementById('invoiceListModal').style.display = 'none';
}

function openInvoiceModal(ref, isViewOnly = false) {
    currentInvoiceRef = ref;
    const flightData = requestData.find(r => r.Ref === ref);
    if (!flightData) {
        showSaveFeedback('Flugdaten nicht gefunden!', false);
        return;
    }

    const modal = document.getElementById('invoiceModal');
    
    document.getElementById('invoiceRecipient').innerHTML = `<h4>Rechnungsempfänger</h4><p><strong>Firma:</strong> ${flightData['Billing Company'] || '-'}</p><p><strong>Adresse:</strong> ${flightData['Billing Address'] || '-'}</p><p><strong>Steuernr.:</strong> ${flightData['Tax Number'] || '-'}</p>`;
    document.getElementById('invoiceSender').innerHTML = `<h4>Rechnungsersteller</h4><p>VG Cargo GmbH</p><p>Gebäude 860</p><p>55483 Hahn-Flughafen</p><p><strong>Bearbeiter:</strong> ${currentUser.name}</p>`;

    const costsBody = document.querySelector('#invoiceCostsTable tbody');
    costsBody.innerHTML = '';
    const costFields = { 'Rate': 'Rate', 'Security charges': 'Security charges', '10ft consumables': '10ft consumables', '20ft consumables': '20ft consumables', 'Zusatzkosten': 'Zusatzkosten' };
    
    for (const key in costFields) {
        const value = parseFloat(String(flightData[key] || '0').replace(',', '.')) || 0;
        const description = key === 'Zusatzkosten' && flightData[key] ? flightData[key] : costFields[key];
        const readonlyAttr = ''; // Immer bearbeitbar
        const row = `<tr>
            <td><input type="text" data-cost-key="${key}" class="invoice-desc" value="${description}" ${readonlyAttr}></td>
            <td><input type="number" step="0.01" data-cost-value="${key}" class="invoice-price" value="${value.toFixed(2)}" ${readonlyAttr}></td>
        </tr>`;
        costsBody.innerHTML += row;
    }
    
    const invoiceNumberInput = document.getElementById('invoiceNumberInput');
    const invoiceButtonContainer = document.getElementById('invoiceButtonContainer');

    if (isViewOnly) {
        invoiceNumberInput.value = flightData.Rechnungsnummer || 'N/A';
        invoiceNumberInput.readOnly = true;
        invoiceButtonContainer.querySelector('button[onclick="saveInvoice()"]').textContent = 'Rechnung aktualisieren';
    } else {
        invoiceNumberInput.value = '';
        invoiceNumberInput.readOnly = false;
        invoiceButtonContainer.querySelector('button[onclick="saveInvoice()"]').textContent = 'Rechnung erstellen und speichern';
    }
    
    if (document.getElementById('invoiceListModal').style.display === 'flex') {
        closeInvoiceListModal();
    }
    if (document.getElementById('detailModal').style.display === 'flex') {
        closeModal();
    }
    modal.style.display = 'flex';
}


function closeInvoiceModal() {
    document.getElementById('invoiceModal').style.display = 'none';
}

async function saveInvoice() {
    const invoiceNumber = document.getElementById('invoiceNumberInput').value;
    if (!invoiceNumber) {
        showSaveFeedback('Bitte eine Rechnungsnummer eintragen!', false);
        return;
    }
    if (!confirm(`Soll die Rechnung mit der Nummer ${invoiceNumber} jetzt final erstellt und gespeichert werden?`)) {
        return;
    }

    const payload = {
        mode: 'createInvoice',
        Ref: currentInvoiceRef,
        Rechnungsnummer: invoiceNumber,
        user: currentUser.name,
        Status: 'Abgerechnet' // Update status to Abgerechnet
    };

    document.querySelectorAll('#invoiceCostsTable .invoice-desc').forEach(input => {
        const key = input.dataset.costKey;
        const descValue = input.value;
        const priceValue = document.querySelector(`.invoice-price[data-cost-value="${key}"]`).value;
        
        if (key === 'Zusatzkosten') {
            payload[key] = descValue;
        }
        payload[key + '_price'] = priceValue;
    });
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback('Rechnung erfolgreich gespeichert!', true);
            closeInvoiceModal();
            fetchData();
        } else {
            showSaveFeedback(result.message || 'Fehler beim Speichern der Rechnung.', false);
        }
    } catch (error) {
        showSaveFeedback('Ein Netzwerkfehler ist aufgetreten.', false);
        console.error('Fehler beim Speichern der Rechnung:', error);
    }
}

function generateInvoicePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const flightData = requestData.find(r => r.Ref === currentInvoiceRef);
    if (!flightData) {
        showSaveFeedback('Flugdaten für PDF nicht gefunden!', false);
        return;
    }

    const invoiceNumber = document.getElementById('invoiceNumberInput').value || 'N/A';
    const vatOption = document.getElementById('vatSelection').value;

    // Header
    doc.setFontSize(20);
    doc.text("Rechnung", 105, 20, null, null, "center");
    doc.setFontSize(10);
    doc.text(`Rechnungsnummer: ${invoiceNumber}`, 105, 28, null, null, "center");
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 105, 34, null, null, "center");


    // Adressen
    doc.setFontSize(12);
    doc.text("Rechnungsersteller:", 20, 50);
    doc.setFontSize(10);
    doc.text("VG Cargo GmbH", 20, 58);
    doc.text("Gebäude 860", 20, 63);
    doc.text("55483 Hahn-Flughafen", 20, 68);

    doc.setFontSize(12);
    doc.text("Rechnungsempfänger:", 110, 50);
    doc.setFontSize(10);
    doc.text(flightData['Billing Company'] || '', 110, 58);
    doc.text(flightData['Billing Address'] || '', 110, 63);
    doc.text(`Steuernr.: ${flightData['Tax Number'] || ''}`, 110, 68);

    // Tabelle mit Kosten
    const tableColumn = ["Leistungsbeschreibung", "Preis (€)"];
    const tableRows = [];
    let netTotal = 0;

    document.querySelectorAll('#invoiceCostsTable tbody tr').forEach(row => {
        const desc = row.querySelector('.invoice-desc').value;
        const price = parseFloat(row.querySelector('.invoice-price').value) || 0;
        tableRows.push([desc, price.toFixed(2)]);
        netTotal += price;
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 80,
        theme: 'striped',
        headStyles: { fillColor: [0, 123, 255] },
    });

    let finalY = doc.autoTable.previous.finalY;

    // Berechnung und Anzeige der Summen
    let vatAmount = 0;
    let totalAmount = netTotal;

    doc.setFontSize(10);
    doc.text(`Nettobetrag:`, 150, finalY + 10, { align: 'right' });
    doc.text(`${netTotal.toFixed(2)} €`, 190, finalY + 10, { align: 'right' });

    if (vatOption === "19") {
        vatAmount = netTotal * 0.19;
        totalAmount = netTotal + vatAmount;
        doc.text(`MwSt. (19%):`, 150, finalY + 17, { align: 'right' });
        doc.text(`${vatAmount.toFixed(2)} €`, 190, finalY + 17, { align: 'right' });
    }

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Zahlbetrag:`, 150, finalY + 24, { align: 'right' });
    doc.text(`${totalAmount.toFixed(2)} €`, 190, finalY + 24, { align: 'right' });
    doc.setFont(undefined, 'normal');

    // Zusatztext für 0% MwSt.
    if (vatOption === "0") {
        doc.setFontSize(9);
        doc.text("Services are free from tax in accordance with §4 No. 3 UStG", 20, finalY + 40);
    }

    // Footer
    doc.setFontSize(8);
    doc.text("Vielen Dank für Ihren Auftrag.", 105, 280, null, null, "center");
    
    doc.save(`Rechnung-${invoiceNumber}.pdf`);
}


// === NEUE FUNKTIONEN FÜR BENUTZERVERWALTUNG ===

async function openUserManagementModal() {
    const modal = document.getElementById('userManagementModal');
    if (!modal) return;

    // Formular zurücksetzen
    clearUserForm();

    // Ladeanzeige
    document.getElementById('userListContainer').innerHTML = '<p>Lade Benutzerliste...</p>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(API_URL + "?mode=getUsers");
        if (!response.ok) {
            throw new Error('Netzwerk-Antwort war nicht ok.');
        }
        const result = await response.json();
        if (result.status === 'success') {
            allUsers = result.data;
            renderUserList();
        } else {
            throw new Error(result.message || 'Fehler beim Laden der Benutzer.');
        }
    } catch (error) {
        document.getElementById('userListContainer').innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

function renderUserList() {
    const container = document.getElementById('userListContainer');
    if (allUsers.length === 0) {
        container.innerHTML = '<p>Keine Benutzer gefunden.</p>';
        return;
    }

    let tableHTML = `<table class="w-full data-table"><thead><tr><th>Username</th><th>Name</th><th>Rolle</th><th>Aktionen</th></tr></thead><tbody>`;
    allUsers.forEach(user => {
        tableHTML += `<tr>
            <td>${user.username}</td>
            <td>${user.name}</td>
            <td>${user.role}</td>
            <td>
                <button class="btn btn-view" onclick="editUser('${user.username}')">Edit</button>
                <button class="btn btn-delete" onclick="deleteUser('${user.username}')">Delete</button>
            </td>
        </tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function editUser(username) {
    const user = allUsers.find(u => u.username === username);
    if (!user) return;

    document.getElementById('userFormTitle').textContent = `Benutzer bearbeiten: ${username}`;
    document.getElementById('userInputUsername').value = user.username;
    document.getElementById('userInputName').value = user.name;
    document.getElementById('userInputRole').value = user.role;
    document.getElementById('userInputPassword').value = ''; // Passwortfeld aus Sicherheitsgründen leeren
    document.getElementById('userInputPassword').placeholder = 'Leer lassen, um nicht zu ändern';

    editingUsername = username;
}

function clearUserForm() {
    document.getElementById('userFormTitle').textContent = 'Neuen Benutzer anlegen';
    document.getElementById('userInputUsername').value = '';
    document.getElementById('userInputName').value = '';
    document.getElementById('userInputRole').value = 'viewer';
    document.getElementById('userInputPassword').value = '';
    document.getElementById('userInputPassword').placeholder = 'Passwort erforderlich';
    editingUsername = null;
}

function closeUserManagementModal() {
    document.getElementById('userManagementModal').style.display = 'none';
}

async function saveUser() {
    const payload = {
        mode: 'saveUser',
        originalUsername: editingUsername, // ist `null` bei neuen Benutzern
        username: document.getElementById('userInputUsername').value.trim(),
        name: document.getElementById('userInputName').value.trim(),
        role: document.getElementById('userInputRole').value,
        password: document.getElementById('userInputPassword').value,
        user: currentUser.name // Admin, der die Aktion ausführt
    };

    if (!payload.username || !payload.name) {
        return showSaveFeedback('Username und Name dürfen nicht leer sein.', false);
    }
    if (!editingUsername && !payload.password) {
        return showSaveFeedback('Für neue Benutzer ist ein Passwort erforderlich.', false);
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback(result.message, true);
            openUserManagementModal(); // Liste und Formular neu laden/zurücksetzen
        } else {
            throw new Error(result.message || 'Unbekannter Fehler beim Speichern.');
        }
    } catch (error) {
        showSaveFeedback(error.message, false);
    }
}

async function deleteUser(username) {
    if (!confirm(`Möchten Sie den Benutzer "${username}" wirklich unwiderruflich löschen?`)) {
        return;
    }

    const payload = {
        mode: 'deleteUser',
        username: username,
        user: currentUser.name // Admin, der die Aktion ausführt
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback(result.message, true);
            openUserManagementModal(); // Liste neu laden
        } else {
            throw new Error(result.message || 'Unbekannter Fehler beim Löschen.');
        }
    } catch (error) {
        showSaveFeedback(error.message, false);
    }
}

// =======================================================
// === NEUE FUNKTIONEN FÜR KUNDENVERWALTUNG (CRM)       ===
// =======================================================

async function fetchCustomers() {
    try {
        const response = await fetch(API_URL + "?mode=getCustomers");
        if (!response.ok) throw new Error('Failed to fetch customers.');
        const result = await response.json();
        if (result.status === 'success') {
            allCustomers = result.data;
            console.log("Customers loaded:", allCustomers.length);
        } else {
            throw new Error(result.message || 'Error fetching customers.');
        }
    } catch (error) {
        showSaveFeedback(error.message, false);
    }
}

async function openCustomerManagementModal() {
    const modal = document.getElementById('customerManagementModal');
    if (!modal) return;

    clearCustomerForm();
    document.getElementById('customerListContainer').innerHTML = '<p>Lade Kundenliste...</p>';
    modal.style.display = 'flex';
    
    // Daten werden bereits beim Login geladen, hier nur Liste rendern
    if (allCustomers.length > 0) {
        renderCustomerList();
    } else {
        // Falls die Liste leer ist, neu laden
        await fetchCustomers();
        renderCustomerList();
    }
}

function renderCustomerList() {
    const container = document.getElementById('customerListContainer');
    if (!container) return;
    if (allCustomers.length === 0) {
        container.innerHTML = '<p>Keine Kunden in der Datenbank gefunden.</p>';
        return;
    }

    let tableHTML = `<table class="w-full data-table">
        <thead>
            <tr>
                <th>Firma</th>
                <th>Kontaktperson</th>
                <th>E-Mail</th>
                <th>Aktionen</th>
            </tr>
        </thead>
        <tbody>`;
    
    allCustomers.sort((a,b) => a['Billing Company'].localeCompare(b['Billing Company'])).forEach(customer => {
        tableHTML += `<tr>
            <td>${customer['Billing Company'] || '-'}</td>
            <td>${customer['Contact Name Invoicing'] || '-'}</td>
            <td>${customer['Contact E-Mail Invoicing'] || '-'}</td>
            <td>
                <button class="btn btn-view" onclick="editCustomer('${customer.KundenID}')">Edit</button>
                <button class="btn btn-delete" onclick="deleteCustomer('${customer.KundenID}')">Delete</button>
            </td>
        </tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function editCustomer(kundenID) {
    const customer = allCustomers.find(c => c.KundenID === kundenID);
    if (!customer) return;

    document.getElementById('customerFormTitle').textContent = `Kunden bearbeiten: ${customer['Billing Company']}`;
    document.getElementById('customerInputID').value = customer.KundenID;
    document.getElementById('customerInputCompany').value = customer['Billing Company'];
    document.getElementById('customerInputAddress').value = customer['Billing Address'];
    document.getElementById('customerInputTaxNumber').value = customer['Tax Number'];
    document.getElementById('customerInputContactName').value = customer['Contact Name Invoicing'];
    document.getElementById('customerInputEmail').value = customer['Contact E-Mail Invoicing'];
    document.getElementById('customerInputNotes').value = customer['Bemerkungen'];

    editingCustomerID = kundenID;
}

function clearCustomerForm() {
    document.getElementById('customerFormTitle').textContent = 'Neuen Kunden anlegen';
    document.getElementById('customerInputID').value = '';
    document.getElementById('customerInputCompany').value = '';
    document.getElementById('customerInputAddress').value = '';
    document.getElementById('customerInputTaxNumber').value = '';
    document.getElementById('customerInputContactName').value = '';
    document.getElementById('customerInputEmail').value = '';
    document.getElementById('customerInputNotes').value = '';
    editingCustomerID = null;
}

function closeCustomerManagementModal() {
    document.getElementById('customerManagementModal').style.display = 'none';
}

async function saveCustomer() {
    const payload = {
        mode: 'saveCustomer',
        KundenID: editingCustomerID, // ist `null` bei neuen Kunden
        'Billing Company': document.getElementById('customerInputCompany').value.trim(),
        'Billing Address': document.getElementById('customerInputAddress').value.trim(),
        'Tax Number': document.getElementById('customerInputTaxNumber').value.trim(),
        'Contact Name Invoicing': document.getElementById('customerInputContactName').value.trim(),
        'Contact E-Mail Invoicing': document.getElementById('customerInputEmail').value.trim(),
        'Bemerkungen': document.getElementById('customerInputNotes').value.trim(),
        user: currentUser.name
    };

    if (!payload['Billing Company']) {
        return showSaveFeedback('Der Firmenname darf nicht leer sein.', false);
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback(result.message, true);
            await fetchCustomers(); // Kundendaten neu laden
            renderCustomerList();   // Liste aktualisieren
            clearCustomerForm();    // Formular zurücksetzen
        } else {
            throw new Error(result.message || 'Unbekannter Fehler beim Speichern des Kunden.');
        }
    } catch (error) {
        showSaveFeedback(error.message, false);
    }
}

async function deleteCustomer(kundenID) {
    const customer = allCustomers.find(c => c.KundenID === kundenID);
    if (!confirm(`Möchten Sie den Kunden "${customer['Billing Company']}" wirklich löschen?`)) {
        return;
    }

    const payload = {
        mode: 'deleteCustomer',
        KundenID: kundenID,
        user: currentUser.name
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback(result.message, true);
            await fetchCustomers(); // Daten neu laden
            renderCustomerList();   // Liste aktualisieren
        } else {
            throw new Error(result.message || 'Unbekannter Fehler beim Löschen.');
        }
    } catch (error) {
        showSaveFeedback(error.message, false);
    }
}


// --- WICHTIGE KORREKTUR: Funktionen global zugänglich machen ---
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.logoutUser = logoutUser;
window.fetchData = fetchData;
window.renderRequestTables = renderRequestTables;
window.filterTable = filterTable;
window.openModal = openModal;
window.deleteRowFromModal = deleteRowFromModal;
window.closeModal = closeModal;
window.saveDetails = saveDetails;
window.deleteRow = deleteRow;
window.shiftCalendar = shiftCalendar;
window.renderCalendars = renderCalendars;
window.openCalendarDayFlights = openCalendarDayFlights;
window.generateCalendarHTML = generateCalendarHTML;
window.createNewRequest = createNewRequest;
window.showSaveFeedback = showSaveFeedback;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;
window.openStatisticsModal = openStatisticsModal;
window.closeStatisticsModal = closeStatisticsModal;
window.generateStatistics = generateStatistics;
window.renderTonnagePerMonthChart = renderTonnagePerMonthChart;
window.renderTonnagePerCustomerChart = renderTonnagePerCustomerChart;
window.downloadStatisticsToCSV = downloadStatisticsToCSV;
window.openEmailConfirmationModal = openEmailConfirmationModal;
window.closeEmailConfirmationModal = closeEmailConfirmationModal;
window.toggleOriginDestinationFields = toggleOriginDestinationFields;
window.generateEmailPreview = generateEmailPreview;
window.closeEmailPreviewModal = closeEmailPreviewModal;
window.markAsSentManually = markAsSentManually;
// NEUE GLOBALE FUNKTIONEN FÜR RECHNUNGEN
window.openInvoiceListModal = openInvoiceListModal;
window.closeInvoiceListModal = closeInvoiceListModal;
window.openInvoiceModal = openInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.saveInvoice = saveInvoice;
window.generateInvoicePDF = generateInvoicePDF;
// NEUE GLOBALE FUNKTIONEN FÜR BENUTZERVERWALTUNG
window.openUserManagementModal = openUserManagementModal;
window.closeUserManagementModal = closeUserManagementModal;
window.saveUser = saveUser;
window.deleteUser = deleteUser;
window.editUser = editUser;
window.clearUserForm = clearUserForm;
// NEUE GLOBALE FUNKTIONEN FÜR KUNDENVERWALTUNG (CRM)
window.openCustomerManagementModal = openCustomerManagementModal;
window.closeCustomerManagementModal = closeCustomerManagementModal;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;
window.editCustomer = editCustomer;
window.clearCustomerForm = clearCustomerForm;
window.populateCustomerFields = populateCustomerFields;
// Initialisiere Auth-Status, sobald das DOM geladen ist.
checkAuthStatus();
" in the document.
I want you to fix the bug in the given co
