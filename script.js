// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbzo-FgxA6TMJYK4xwLbrsRnNTAU_AN-FEJJoZH6w7aJ3BlcsaB751LjdUJ9nieGtu1P/exec'; // <<< AKTUALISIERT: NEUER LINK VOM BENUTZER

// !!! WICHTIG: Die users.js-Importzeile wird entfernt, da die Benutzerdaten nun aus Google Sheets kommen. !!!
// import { users } from './users.js';

let currentUser = null; // Speichert den aktuell angemeldeten Benutzer
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

// Globale Variablen für Chart-Instanzen, um sie bei Bedarf zu zerstören
let tonnagePerMonthChartInstance = null;
let tonnagePerCustomerChartInstance = null;
let revenuePerAirlineChartInstance = null; // NEU
let tonnagePerAircraftTypeChartInstance = null; // NEU

// Variable zum Speichern der aktuell im Modal angezeigten Daten
let currentModalData = null;
let currentInvoiceRef = null; // NEU: Globale Variable für die aktuelle Rechnungsreferenz


// === AUTHENTIFIZIERUNG UND BENUTZERVERWALTUNG ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    // Da die Benutzerdaten nun aus Google Sheets kommen, brauchen wir hier keine users-Datei-Überprüfung mehr.
    // Wir vertrauen darauf, dass das currentUser-Objekt gültig ist, wenn es im localStorage ist.
    updateUIBasedOnUserRole();
    fetchData(); // Daten laden, wenn angemeldet
  } else {
    // Wenn nicht angemeldet, zur Login-Seite umleiten
    window.location.href = 'login.html';
  }
}

function updateUIBasedOnUserRole() {
  const adminElements = document.querySelectorAll(".admin-only");
  const loggedInUsernameSpan = document.getElementById('loggedInUsername');
  const loggedInUserRoleSpan = document.getElementById('loggedInUserRole');
  const loggedInUsernameProfileSpan = document.getElementById('loggedInUsernameProfile');
  const loggedInUserRoleProfileSpan = document.getElementById('loggedInUserRoleProfile');


  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;
    if (loggedInUsernameProfileSpan) loggedInUsernameProfileSpan.textContent = currentUser.name;
    if (loggedInUserRoleProfileSpan) loggedInUserRoleProfileSpan.textContent = currentUser.role;


    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = "inline-block"); // Oder 'block', je nach Element
    } else {
      adminElements.forEach(el => el.style.display = "none");
    }
  } else {
    // Falls kein Benutzer angemeldet ist (sollte durch checkAuthStatus abgefangen werden)
    adminElements.forEach(el => el.style.display = "none");
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'N/A';
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = 'N/A';
    if (loggedInUsernameProfileSpan) loggedInUsernameProfileSpan.textContent = 'N/A';
    if (loggedInUserRoleProfileSpan) loggedInUserRoleProfileSpan.textContent = 'N/A';
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

    // Sicherstellen, dass die Tabellen-Bodys existieren
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

    // Hilfsfunktion zum Erstellen einer Zeile, um Code-Duplizierung zu vermeiden
    const createRowHTML = (r) => {
        const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);

        let displayFlightDate = r['Flight Date'] || "-";
        if (displayFlightDate !== "-" && displayFlightDate.includes('-')) {
            try {
                // Erstellt ein Datumsobjekt in UTC, um Zeitzonenprobleme zu vermeiden
                const dateParts = displayFlightDate.split('-');
                const dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
                displayFlightDate = dateObj.toLocaleDateString('de-DE', { timeZone: 'UTC' });
            } catch (e) {
                 console.error("Fehler bei der Datumskonvertierung für die Anzeige in Tabelle:", displayFlightDate, e);
            }
        }

        const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';
        const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';
        
        // NEU: Logik für Status-Indikator
        let statusDotClass = 'status-blue'; // Blau: Angefragt
        let statusText = 'Angefragt';
        if (String(r.Status).toLowerCase() === 'storniert') {
            statusDotClass = 'status-red';
            statusText = 'Storniert';
        } else if (String(r.RechnungErstellt).toLowerCase() === 'ja') {
            statusDotClass = 'status-yellow';
            statusText = 'Abgerechnet';
        } else if (isConfirmed) {
            statusDotClass = 'status-green';
            statusText = 'Bestätigt';
        }
        const statusHTML = `<span class="status-dot ${statusDotClass}" title="${statusText}"></span>`;

        // NEU: Rechnungsstatus
        const isInvoiced = String(r.RechnungErstellt || '').toLowerCase() === 'ja';
        const invoiceStatusHTML = isInvoiced 
            ? `<a href="javascript:void(0);" onclick="openInvoiceView('${r.Ref}')" class="text-green-600 font-bold underline">${r.Rechnungsnummer || 'Ansehen'}</a>` 
            : '<span class="text-red-600">Offen</span>';

        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${statusHTML}</td>
          <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
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
  const invoiceNumberSearch = (document.getElementById("invoiceNumberSearch")?.value || '').toLowerCase(); // NEU
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false;

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch);
    const matchesInvoiceNumber = (r.Rechnungsnummer || '').toLowerCase().includes(invoiceNumberSearch); // NEU

    let flightDateObj = null;
    if (r['Flight Date'] && typeof r['Flight Date'] === 'string' && r['Flight Date'].includes('-')) {
        const parts = r['Flight Date'].split('-');
        flightDateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }

    // KORREKTUR: Logik für Datumsfilterung
    let matchesDateRange = true;
    if (fromDateInput || toDateInput) { // Nur filtern, wenn ein Datum eingegeben wurde
        if (!flightDateObj) {
            matchesDateRange = false; // Einträge ohne Datum ausblenden, wenn nach Datum gefiltert wird
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
    
    // KORREKTUR: Logik für Archiv-Filter
    let passesArchiveFilter = true;
    if (!showArchive && flightDateObj) {
        if (flightDateObj < today) {
            passesArchiveFilter = false;
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
      // Using a custom alert/message box instead of window.alert
      showSaveFeedback("Bitte melden Sie sich an, um diese Funktion zu nutzen.", false);
      setTimeout(() => { window.location.href = 'login.html'; }, 1500); // Redirect after message
      return;
  }

  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'),
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein", // Standardwert "Nein"
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Ja", // Standardwert "Ja" für neue Anfragen
    'Service Description Accepted': "Ja", // Standardwert "Ja" für neue Anfragen
    'Accepted By Name': "",
    'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein", // NEU: Standardwert für neue Anfragen
    'Flight Type Import': "Nein", // NEU: Standardwert
    'Flight Type Export': "Nein",  // NEU: Standardwert
    'Origin': '', // NEU: Origin für Import
    'Destination': '', // NEU: Destination für Export
    'Status': 'Angefragt', // NEU
    'Interne Notizen': '', // NEU
    'Kosten': '' // NEU
  } : requestData[originalIndex];

  // Speichere die aktuellen Daten im Modal, um sie später für die E-Mail zu verwenden
  currentModalData = r;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  // Modifizierte section Funktion, um eine Farbklasse zu akzeptieren
  const section = (title, contentHTML, colorClass = '') => {
    const wrap = document.createElement("div");
    wrap.className = `modal-section ${colorClass}`; // Farbklasse hier hinzufügen
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    return fields.map(({ label, key, type, options }) => {
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
        '10ft consumables', '20ft consumables', 'Zusatzkosten', 'Kosten'
      ].includes(key);

      if (isPriceRelatedOrZusatzkostenField && currentUser.role === 'viewer') {
          return '';
      }
      
      if (key === "Rechnungsnummer") {
        if (r.RechnungErstellt === 'Ja' && r.Rechnungsnummer) {
          return `<label>${label}:</label><p><a href="javascript:void(0);" onclick="openInvoiceView('${r.Ref}')" class="text-blue-600 font-bold underline">${r.Rechnungsnummer}</a></p>`;
        } else {
          return `<label>${label}:</label><p>Noch nicht erstellt</p>`;
        }
      }
      
      if (type === 'select' && options) {
        let optionsHTML = options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
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
      } else if (key === "Email Request" || key === "Interne Notizen") {
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

  const customerFields = [
    { label: "Ref", key: "Ref" },
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

  const flightFields = [
    { label: "Status", key: "Status", type: "select", options: ["Angefragt", "Bestätigt", "Abgerechnet", "Storniert", "Archiviert"] },
    { label: "Airline", key: "Airline" },
    { label: "Aircraft Type", key: "Aircraft Type" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Flight Date", key: "Flight Date" },
    { label: "Abflugzeit", key: "Abflugzeit" },
    { label: "Tonnage", key: "Tonnage" },
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" },
    { label: "Flight Type Import", key: "Flight Type Import", type: "checkbox" },
    { label: "Flight Type Export", key: "Flight Type Export", type: "checkbox" },
    { label: "E-Mail Request", key: "Email Request" }
  ];

  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods", type: "select", options: ["Ja", "Nein", "N/A"] },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea" },
    { label: "Kosten (für interne Kalkulation)", key: "Kosten"}
  ];
  
  const internalFields = [
      { label: "Interne Notizen", key: "Interne Notizen" },
      { label: "Dateien (AWB, Zoll, etc.)", key: "FileUpload" }
  ];

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields), 'bg-green-50'));

  if (currentUser && currentUser.role === 'admin') {
    modalBody.appendChild(section("Preisdetails & Kosten", renderFields(priceFields), 'bg-yellow-50'));
    modalBody.appendChild(section("Interne Vermerke", renderFields(internalFields), 'bg-gray-100'));
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
// ... (Rest der Datei bleibt unverändert)
// HIER FOLGT DER REST DEINES SCRIPTS...

// WICHTIGE KORREKTUR: Funktionen global zugänglich machen
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
window.openInvoiceCreationModal = openInvoiceCreationModal;
window.closeInvoiceCreationModal = closeInvoiceCreationModal;
window.saveInvoice = saveInvoice;
window.openInvoiceView = openInvoiceView;
window.updateInvoice = updateInvoice; // NEU
// Initialisiere Auth-Status, sobald das DOM geladen ist.
checkAuthStatus();
