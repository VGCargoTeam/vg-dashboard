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

// Variable zum Speichern der aktuell im Modal angezeigten Daten
let currentModalData = null;


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
      adminElements.forEach(el => el.style.display = ""); // Standardanzeige
    } else {
      adminElements.forEach(el => el.style.display = "none"); // Ausblenden
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
  if (profileModal) {
    // Sicherstellen, dass das Modal existiert
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

function renderTable(dataToRender = requestData) {
  // Erlaubt das Rendern von gefilterten Daten
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";

  let totalFlights = 0;
  let totalWeight = 0;

  dataToRender.forEach((r) => { // dataToRender verwenden
    const row = document.createElement("tr");
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref); // Find original index for opening modal

    // Datum korrekt für die Anzeige formatieren (DD.MM.YYYY)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
      try {
        // Robustes Parsen des Datums, um Zeitzonenprobleme zu vermeiden
        let dateObj;
        if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet YYYY-MM-DD vom Backend
          const parts = displayFlightDate.split('-');
          dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else if (displayFlightDate instanceof Date) { // Falls es direkt ein Date-Objekt ist (selten, aber sicherheitshalber)
          dateObj = new Date(displayFlightDate.getFullYear(), displayFlightDate.getMonth(), displayFlightDate.getDate());
        } else {
          dateObj = new Date('Invalid Date'); // Ungültiges Datum
        }
        // Sicherstellen, dass die Uhrzeit auf Mitternacht gesetzt ist, um Konsistenz zu gewährleisten
        dateObj.setHours(0, 0, 0, 0);
        console.log(`[renderTable] Original: "${r['Flight Date']}", Geparsed (Lokal): ${dateObj}`); // Zum Debuggen
        if (!isNaN(dateObj.getTime())) {
          displayFlightDate = dateObj.toLocaleDateString('de-DE');
          console.log(`[renderTable] Formatiert (de-DE): ${displayFlightDate}`);
        }
      } catch (e) {
        console.error("Fehler bei der Datumskonvertierung für die Anzeige in Tabelle:", displayFlightDate, e);
      }
    }

    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    // NEU: Status der finalen Bestätigung prüfen und Icon hinzufügen
    const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';
    const confirmationIcon = isConfirmed ? '<span class="text-green-500 ml-1">&#10004;</span>' : ''; // Grünes Häkchen

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a>${confirmationIcon}</td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString('de-DE')}</td>
      <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button>
        ${deleteButtonHTML}
      </td>
    `;
    tbody.appendChild(row);

    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent = `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString('de-DE')} kg`;
  updateUIBasedOnUserRole();
}

function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearchInput = document.getElementById("flightNumberSearch");
  const flightNumberSearch = flightNumberSearchInput ? flightNumberSearchInput.value.toLowerCase() : '';
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false; // Archiv-Checkbox, falls vorhanden

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch);

    let matchesDateRange = true;
    let isPastOrTodayAndGoneFlight = false;

    let flightDateFromData = r['Flight Date'];
    let flightDateObj;

    // Robustes Parsen des Datums, um Zeitzonenprobleme zu vermeiden
    if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet YYYY-MM-DD vom Backend
      const parts = flightDateFromData.split('-');
      flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (flightDateFromData instanceof Date) { // Falls es direkt ein Date-Objekt ist
      flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
    } else {
      flightDateObj = new Date('Invalid Date'); // Ungültiges Datum
    }
    flightDateObj.setHours(0, 0, 0, 0); // Sicherstellen, dass die Uhrzeit auf Mitternacht gesetzt ist
    console.log(`[filterTable] Original: "${flightDateFromData}", Geparsed (Lokal): ${flightDateObj}`);

    if (flightDateObj && !isNaN(flightDateObj.getTime())) {
      if (flightDateObj < today) {
        isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
        const abflugzeit = r['Abflugzeit'];
        if (abflugzeit) {
          // Abflugzeit muss auch als lokaler Zeitpunkt für den Vergleich geparst werden
          let flightTimeAsDate = new Date();
          if (typeof abflugzeit === 'string' && abflugzeit.match(/^\d{2}:\d{2}$/)) { // Erwartet HH:MM vom Backend
            const [hours, minutes] = abflugzeit.split(':').map(Number);
            flightTimeAsDate.setHours(hours, minutes, 0, 0);
          } else if (abflugzeit instanceof Date) {
            flightTimeAsDate = abflugzeit; // Falls schon Date-Objekt
          } else {
            flightTimeAsDate = new Date('Invalid Date');
          }
          const now = new Date();
          now.setSeconds(0, 0);
          now.setMilliseconds(0);

          if (!isNaN(flightTimeAsDate.getTime()) && flightTimeAsDate <= now) {
            isPastOrTodayAndGoneFlight = true;
          }
        }
      }

      // Filter nach Datumsbereich
      if (fromDateInput) {
        const fromDateParts = fromDateInput.split('-');
        const fromDateObj = new Date(parseInt(fromDateParts[0]), parseInt(fromDateParts[1]) - 1, parseInt(fromDateParts[2]));
        fromDateObj.setHours(0,0,0,0); // Auch Filterdatum auf Mitternacht setzen
        if (flightDateObj < fromDateObj) matchesDateRange = false;
      }
      if (toDateInput) {
        const toDateParts = toDateInput.split('-');
        const toDateObj = new Date(parseInt(toDateParts[0]), parseInt(toDateParts[1]) - 1, parseInt(toDateParts[2]));
        toDateObj.setHours(0,0,0,0); // Auch Filterdatum auf Mitternacht setzen
        if (flightDateObj > toDateObj) matchesDateRange = false;
      }
    } else {
      isPastOrTodayAndGoneFlight = false;
    }

    const passesPastFlightFilter = showArchive || !isPastOrTodayAndGoneFlight;

    return matchesRef && matchesAirline && matchesFlightNumber && matchesDateRange && passesPastFlightFilter;
  });

  renderTable(filtered);
  renderCalendars();
}


// === MODAL FUNKTIONEN ===
function openModal(originalIndex) {
  if (!currentUser) {
    console.error("Versuch, Modal ohne angemeldeten Benutzer zu öffnen. Weiterleitung zum Login.");
    // Using a custom alert/message box instead of window.alert
    showSaveFeedback("Bitte melden Sie sich an, um diese Funktion zu nutzen.", false);
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500); // Redirect after message
    return;
  }

  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'),
    'Billing Company': "",
    'Billing Address': "",
    'Tax Number': "",
    'Contact Name Invoicing': "",
    'Contact E-Mail Invoicing': "",
    'Airline': "",
    'Aircraft Type': "",
    'Flugnummer': "",
    'Flight Date': "",
    'Abflugzeit': "",
    'Tonnage': "",
    'Rate': "",
    'Security charges': "",
    "Dangerous Goods": "Nein", // Standardwert "Nein"
    '10ft consumables': "",
    '20ft consumables': "",
    'Zusatzkosten': "",
    'Email Request': "",
    'AGB Accepted': "Ja", // Standardwert "Ja" für neue Anfragen
    'Service Description Accepted': "Ja", // Standardwert "Ja" für neue Anfragen
    'Accepted By Name': "",
    'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein", // NEU: Standardwert für neue Anfragen
    'Flight Type Import': "Nein", // NEU: Standardwert
    'Flight Type Export': "Nein", // NEU: Standardwert
    'Origin': '', // NEU: Origin für Import
    'Destination': '' // NEU: Destination für Export
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
    return fields.map(({ label, key, type }) => {
      let value = r[key];
      if (value === undefined || value === null) value = "";

      const isAlwaysReadOnlyField = [
        "Ref",
        "Created At",
        "Acceptance Timestamp",
        "Email Request",
        "Accepted By Name",
        "Final Confirmation Sent"
      ].includes(key);

      let readOnlyAttr = '';
      let styleAttr = '';
      if (isAlwaysReadOnlyField) {
        readOnlyAttr = 'readonly';
        styleAttr = 'background-color:#eee; cursor: not-allowed;';
      }

      // Spezielle Handhabung für Price-related fields und 'Zusatzkosten'
      // Diese Felder sollen für Viewer komplett unsichtbar sein.
      const isPriceRelatedOrZusatzkostenField = [
        'Rate',
        'Security charges',
        'Dangerous Goods',
        '10ft consumables',
        '20ft consumables',
        'Zusatzkosten'
      ].includes(key);

      // Wenn der Benutzer ein Viewer ist und es sich um ein preisspezifisches Feld handelt, überspringen.
      if (isPriceRelatedOrZusatzkostenField && currentUser.role === 'viewer') {
        return ''; // Leerer String, um das Feld komplett zu überspringen
      }

      // Für Admins sind diese Felder editierbar, es sei denn, sie sind in isAlwaysReadOnlyField.


      if (key === "Flight Date") {
        let dateValue = "";
        if (value) {
          try {
            // Parsen des Datums, um es im Input korrekt darzustellen (YYYY-MM-DD Format)
            if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet YYYY-MM-DD vom Backend
              dateValue = value;
            } else if (value instanceof Date) {
              dateValue = value.toISOString().split('T')[0]; // Konvertiere Date-Objekt zu YYYY-MM-DD
            }
          } catch (e) {
            console.error("Fehler beim Parsen des Flugdatums für Modal-Input:", value, e);
          }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${dateValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "Abflugzeit") {
        let timeValue = "";
        if (value) {
          if (typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)) { // Erwartet HH:MM vom Backend
            timeValue = value;
          } else if (value instanceof Date) {
            timeValue = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          }
        }
        return `<label>${label}:</label><input type="time" name="${key}" value="${timeValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") {
        // Immer einen grünen Haken anzeigen, da der Kunde die AGB akzeptieren MUSS, um eine Anfrage zu senden.
        const icon = '&#10004;'; // Grüner Haken
        const color = 'green';
        return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if (key === "Vorfeldbegleitung" && type === "checkbox") {
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (['Tonnage'].includes(key)) { // Tonnage darf Viewer sehen und bearbeiten
        const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
        return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (key === "Email Request") { // E-Mail Request ist ein normales Textfeld
        return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      } else if (key === "Flight Type Import") { // NEU: Checkbox für Import
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        const originInput = (String(r['Flight Type Import']).toLowerCase() === 'ja') ? `<label>Origin:</label><input type="text" name="Origin" value="${r.Origin || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Origin')"> ${label}</label>${originInput}`;
      } else if (key === "Flight Type Export") { // NEU: Checkbox für Export
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        const destinationInput = (String(r['Flight Type Export']).toLowerCase() === 'ja') ? `<label>Destination:</label><input type="text" name="Destination" value="${r.Destination || ''}" ${readOnlyAttr} style="${styleAttr}" />` : '';
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}" onchange="toggleOriginDestinationFields(this, 'Destination')"> ${label}</label>${destinationInput}`;
      } else if (key === "Final Confirmation Sent") { // Anzeige für "Final Confirmation Sent"
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
    { label: "Final Confirmation Sent", key: "Final Confirmation Sent" } // NEU: Feld hinzugefügt
  ];

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

  // Hinzufügen der Abschnitte mit spezifischen Hintergrundfarben
  modalBody.appendChild(section("Kundendetails", renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields), 'bg-green-50'));

  // Preisdetails nur für Admins anzeigen
  if (currentUser && currentUser.role === 'admin') {
    // Erstellen des HTML für Preisdetails
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
      let value = r[key] || "";
      if (key === "Zusatzkosten") {
        // Sicherstellen, dass die textarea für Zusatzkosten korrekt gerendert wird
        return `<label>${label}:</label><textarea name="${key}" placeholder="Labeln, Fotos" style="height:80px">${value}</textarea>`;
      } else if (key === "Dangerous Goods") {
        const options = ["Ja", "Nein", "N/A"]; // Beispieloptionen
        return `<label>${label}:</label>
            <select name="${key}">
              ${options.map(opt => `<option value="${opt}" ${String(value).toLowerCase() === opt.toLowerCase() ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>`;
      } else {
        const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
        return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" />`;
      }
    }).join("");
    modalBody.appendChild(section("Preisdetails", priceDetailsHTML, 'bg-yellow-50')); // Farbklasse für Preisdetails
  }

  // Der 'else' Block für Viewer wurde entfernt, da 'Zusatzkosten'
  // direkt in renderFields() behandelt wird, um es komplett zu überspringen.

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.marginTop = "20px";

  // Speichern-Button ist für alle eingeloggten Benutzer verfügbar
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

  if (currentUser && originalIndex !== -1) { // Button für alle Rollen, wenn ein Eintrag geöffnet ist
    const sendConfirmationButton = document.createElement("button");
    sendConfirmationButton.textContent = "Final Charter Confirmation senden";
    sendConfirmationButton.style.padding = "10px 20px";
    sendConfirmationButton.style.fontWeight = "bold";
    sendConfirmationButton.style.backgroundColor = "#007BFF"; // Blau für Senden
    sendConfirmationButton.style.color = "white";
    sendConfirmationButton.style.border = "none";
    sendConfirmationButton.style.borderRadius = "6px";
    sendConfirmationButton.style.cursor = "pointer";
    sendConfirmationButton.onclick = () => openEmailConfirmationModal(r); // Übergabe der aktuellen Daten
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

// NEU: Funktion zum Umschalten der Origin/Destination Felder basierend auf Checkbox
function toggleOriginDestinationFields(checkbox, fieldType) {
  const parentLabel = checkbox.closest('label');
  let inputElement = parentLabel.nextElementSibling; // Versuchen, das nächste Geschwisterelement zu finden

  // Wenn es kein Input-Element ist oder es nicht das richtige ist, suchen wir es
  if (!inputElement || (inputElement.tagName !== 'INPUT' && inputElement.tagName !== 'LABEL')) {
    // Suche innerhalb des gleichen modal-section Divs
    const sectionDiv = checkbox.closest('.modal-section');
    if (sectionDiv) {
      inputElement = sectionDiv.querySelector(`input[name="${fieldType}"]`);
    }
  }

  if (checkbox.checked) {
    // Wenn die Checkbox aktiviert ist, füge das Feld hinzu, falls es nicht existiert
    if (!inputElement || inputElement.name !== fieldType) {
      const newLabel = document.createElement('label');
      newLabel.textContent = `${fieldType}:`;
      const newInput = document.createElement('input');
      newInput.type = 'text';
      newInput.name = fieldType;
      newInput.value = currentModalData[fieldType] || ''; // Vorhandenen Wert setzen
      newInput.style.cssText = 'width: 100%; padding: 6px; margin-top: 4px; border: 1px solid #ccc; border-radius: 4px;';
      parentLabel.parentNode.insertBefore(newLabel, parentLabel.nextSibling);
      newLabel.parentNode.insertBefore(newInput, newLabel.nextSibling);
    } else {
      // Wenn das Feld bereits existiert, stelle sicher, dass es sichtbar ist
      inputElement.style.display = '';
      inputElement.previousElementSibling.style.display = ''; // Label auch anzeigen
    }
  } else {
    // Wenn die Checkbox deaktiviert ist, verstecke das Feld
    if (inputElement && inputElement.name === fieldType) {
      inputElement.style.display = 'none';
      inputElement.previousElementSibling.style.display = 'none'; // Label auch verstecken
    }
    // Optional: Den Wert des Feldes leeren, wenn es ausgeblendet wird
    if (currentModalData) {
      currentModalData[fieldType] = '';
    }
  }
}

// Neue Funktion, die vom Modal aus den Löschvorgang startet und dann das Modal schließt
async function deleteRowFromModal(ref) {
  // Statt alert() eine benutzerdefinierte Bestätigung verwenden, da alert() in iframes nicht gut funktioniert
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
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

// Event Listener für ESC-Taste zum Schließen aller Modals
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal();
    closeProfileModal();
    closeStatisticsModal();
    closeEmailConfirmationModal();
    closeEmailPreviewModal();
  }
});


async function saveDetails() {
  // Statt alert() eine benutzerdefinierte Bestätigung verwenden
  const isConfirmed = confirm('Sind Sie sicher, dass Sie diese Änderungen speichern möchten?');
  if (!isConfirmed) {
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled]), #modalBody select[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => {
    if (i.name === "Flight Date") {
      data[i.name] = i.value;
    } else if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(i.name)) {
      // Tonnage und Preis-Felder: Kommas durch Punkte ersetzen und Euro-Symbol sowie Leerzeichen entfernen
      data[i.name] = i.value.replace(/,/g, '.').replace('€', '').trim() || "";
    } else {
      // Wichtig: Für 'Zusatzkosten' (textarea) kommt der Wert einfach als String.
      if (i.type === "checkbox") {
        data[i.name] = i.checked ? "Ja" : "Nein";
      } else {
        data[i.name] = i.value;
      }
    }
  });

  const refValue = document.querySelector("#modalBody input[name='Ref']").value;
  data.mode = "write";
  data.user = currentUser.name;

  console.log('Payload for saving:', data);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
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
  // Statt alert() eine benutzerdefinierte Bestätigung verwenden
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${r.status}`);
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
  if (baseMonth < 0) {
    baseMonth += 12;
    baseYear--;
  }
  if (baseMonth > 11) {
    baseMonth -= 12;
    baseYear++;
  }
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
  // Erstelle das Vergleichsdatum als String (YYYY-MM-DD)
  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date']; // Dies ist bereits YYYY-MM-DD vom Backend
    // Einfacher String-Vergleich
    const isMatch = flightDateFromData === clickedDateStr;
    console.log(` Vergleich: Flugdatum "${flightDateFromData}" vs. geklicktes Datum "${clickedDateStr}" -> Match: ${isMatch}`);
    return isMatch;
  });

  console.log(`Gefundene Flüge für diesen Tag (${clickedDateStr}):`, flightsOnThisDay);

  if (flightsOnThisDay.length > 0) {
    // Wenn mehrere Flüge am selben Tag, öffne den ersten gefundenen.
    // Optimal wäre eine Liste oder Auswahl, aber für den Anfang öffnen wir den ersten.
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.findIndex(item => item.Ref === firstFlight.Ref);
    console.log(`Erster Flug Ref: ${firstFlight.Ref}, Original Index: ${originalIndex}`);
    if (originalIndex !== -1) {
      openModal(originalIndex);
    } else {
      console.warn("Konnte den Originalindex des Fluges nicht finden:", firstFlight);
    }
  } else {
    console.log("Keine Flüge für diesen Tag gefunden.");
  }
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' });

  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;

  let day = 1;
  const today = new Date(); // Get today's date
  today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison

  for (let i = 0; i < 6; i++) { // Max 6 Wochen im Kalender
    html += "<tr>";
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < firstDayOfMonthWeekday) {
        html += `<td class="empty"></td>`;
      } else if (day > daysInMonth) {
        html += `<td class="empty"></td>`;
      } else {
        const currentCalendarDate = new Date(year, month, day);
        currentCalendarDate.setHours(0, 0, 0, 0); // Reset time for accurate comparison

        let cellClasses = "calendar-day";
        let tooltipText = "";
        let hasFlight = false;
        let isImportOnly = false;
        let isExportOnly = false;

        const flightsOnThisDay = requestData.filter(r => {
          let flightDateFromData = r['Flight Date']; // This is YYYY-MM-DD from backend
          // Robust parsing of flight date string to Date object
          let flightDateObj;
          if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const parts = flightDateFromData.split('-');
            flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            flightDateObj = new Date('Invalid Date'); // Handle invalid format
          }
          flightDateObj.setHours(0, 0, 0, 0); // Reset time for comparison

          return flightDateObj.getTime() === currentCalendarDate.getTime();
        });


        if (flightsOnThisDay.length > 0) {
          hasFlight = true;
          const imports = flightsOnThisDay.filter(f => String(f['Flight Type Import']).toLowerCase() === 'ja').length;
          const exports = flightsOnThisDay.filter(f => String(f['Flight Type Export']).toLowerCase() === 'ja').length;

          if (imports > 0 && exports === 0) {
            isImportOnly = true;
            cellClasses += " import-only";
          } else if (exports > 0 && imports === 0) {
            isExportOnly = true;
            cellClasses += " export-only";
          } else if (imports > 0 && exports > 0) {
            cellClasses += " import-export";
          } else {
            cellClasses += " has-flights"; // Default for flights without specific type
          }


          tooltipText = flightsOnThisDay.map(f => {
            let flightInfo = `Ref: ${f.Ref}\nAirline: ${f.Airline}\nFlugnummer: ${f.Flugnummer || 'N/A'}\nTonnage: ${parseFloat(String(f.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')} kg`;
            if (String(f['Flight Type Import']).toLowerCase() === 'ja' && f.Origin) {
                flightInfo += `\nImport von: ${f.Origin}`;
            }
            if (String(f['Flight Type Export']).toLowerCase() === 'ja' && f.Destination) {
                flightInfo += `\nExport nach: ${f.Destination}`;
            }
            return flightInfo;
          }).join('\n\n');
        }

        // Add 'today-red-text' class if it's the current day
        if (currentCalendarDate.getTime() === today.getTime()) {
          cellClasses += " today-red-text";
        }


        html += `<td class="${cellClasses}" onclick="openCalendarDayFlights(${year}, ${month}, ${day})" data-tooltip="${tooltipText}">
                            ${day}
                            ${hasFlight ? '<span class="flight-icon">✈</span>' : ''}
                        </td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }

  html += "</tbody></table></div>";
  return html;
}

// === HISTORY MODAL FUNKTIONEN ===
function openHistoryModal() {
  document.getElementById("historyModal").style.display = "flex";
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

async function showHistory(ref) {
  openHistoryModal(); // Öffnet das Modal
  document.getElementById("historyRef").textContent = ref;
  const historyBody = document.getElementById("historyBody");
  historyBody.innerHTML = "Lade Historie...";

  try {
    const response = await fetch(`${API_URL}?mode=history&ref=${encodeURIComponent(ref)}`);
    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const data = await response.json();

    if (data.status === "success" && data.history && data.history.length > 0) {
      historyBody.innerHTML = "<ul>" + data.history.map(entry => {
        // Versuchen, den JSON-String zu parsen, wenn er existiert
        let detailsHtml = '';
        if (entry.details) {
          try {
            const details = JSON.parse(entry.details);
            detailsHtml = '<h4>Änderungen:</h4><pre>' + JSON.stringify(details, null, 2) + '</pre>';
          } catch (e) {
            detailsHtml = `<h4>Änderungen (Roh):</h4><pre>${entry.details}</pre>`;
          }
        }
        return `
          <li>
            <strong>Datum:</strong> ${new Date(entry.timestamp).toLocaleString('de-DE')}<br>
            <strong>Aktion:</strong> ${entry.action}<br>
            <strong>Durchgeführt von:</strong> ${entry.user || 'Unbekannt'}<br>
            ${detailsHtml}
          </li>
        `;
      }).join('') + "</ul>";
    } else {
      historyBody.innerHTML = "<p>Keine Historie für diese Referenz gefunden.</p>";
    }
  } catch (error) {
    console.error("Fehler beim Abrufen der Historie:", error);
    historyBody.innerHTML = "<p>Fehler beim Laden der Historie.</p>";
  }
}

// === STATISTIK MODAL FUNKTIONEN ===
function openStatisticsModal() {
  const statisticsModal = document.getElementById("statisticsModal");
  statisticsModal.style.display = "flex";
  // Set default dates if not already set
  const statFromDateInput = document.getElementById('statFromDate');
  const statToDateInput = document.getElementById('statToDate');
  if (!statFromDateInput.value || !statToDateInput.value) {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    statFromDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
    statToDateInput.value = today.toISOString().split('T')[0];
  }
  generateStatistics(); // Generate statistics when modal opens
}

function closeStatisticsModal() {
  document.getElementById("statisticsModal").style.display = "none";
}

// NEU: Funktion zur Generierung der Statistiken
function generateStatistics() {
    const statFromDate = document.getElementById('statFromDate').value;
    const statToDate = document.getElementById('statToDate').value;

    let filteredData = requestData;

    if (statFromDate && statToDate) {
        const fromDateObj = new Date(statFromDate);
        const toDateObj = new Date(statToDate);
        fromDateObj.setHours(0, 0, 0, 0);
        toDateObj.setHours(23, 59, 59, 999); // End of day

        filteredData = requestData.filter(r => {
            let flightDateFromData = r['Flight Date'];
            let flightDateObj;
            if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = flightDateFromData.split('-');
                flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (flightDateFromData instanceof Date) {
                flightDateObj = flightDateFromData;
            } else {
                flightDateObj = new Date('Invalid Date');
            }
            flightDateObj.setHours(0, 0, 0, 0); // Normalize to start of day for comparison

            return flightDateObj >= fromDateObj && flightDateObj <= toDateObj;
        });
    }

    // Tonnage per Month Chart
    renderTonnagePerMonthChart(filteredData);

    // Tonnage per Customer Chart (renamed to Tonnage per Airline for consistency)
    renderTonnagePerCustomerChart(filteredData);

    // NEU: Vorfeldbegleitungen Statistik
    const apronEscortsCount = filteredData.filter(r => String(r['Vorfeldbegleitung']).toLowerCase() === 'ja').length;
    document.getElementById('apronEscortsCount').textContent = `Anzahl: ${apronEscortsCount}`;

    // NEU: DGR Abfertigungen Statistik
    const dgrCount = filteredData.filter(r => String(r['Dangerous Goods']).toLowerCase() === 'ja').length;
    document.getElementById('dgrCount').textContent = `Anzahl: ${dgrCount}`;

    // NEU: Flüge und Tonnage pro Airline Tabelle
    renderFlightsAndTonnagePerAirlineTable(filteredData);
}


function renderTonnagePerMonthChart(dataToRender) {
  if (tonnagePerMonthChartInstance) {
    tonnagePerMonthChartInstance.destroy();
  }

  const monthlyTonnage = {}; // { "YYYY-MM": totalTonnage }

  dataToRender.forEach(r => {
    const flightDate = r['Flight Date'];
    if (flightDate) {
      const date = new Date(flightDate);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
      monthlyTonnage[yearMonth] = (monthlyTonnage[yearMonth] || 0) + tonnage;
    }
  });

  const sortedMonths = Object.keys(monthlyTonnage).sort();
  const labels = sortedMonths.map(ym => {
    const [year, month] = ym.split('-');
    return new Date(year, month - 1).toLocaleString('de-DE', { month: 'short', year: '2-digit' });
  });
  const data = sortedMonths.map(ym => monthlyTonnage[ym]);

  const ctx = document.getElementById('tonnagePerMonthChart').getContext('2d');
  tonnagePerMonthChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tonnage pro Monat (kg)',
        data: data,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Tonnage (kg)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Monat'
          }
        }
      }
    }
  });
}

function renderTonnagePerCustomerChart(dataToRender) {
  if (tonnagePerCustomerChartInstance) {
    tonnagePerCustomerChartInstance.destroy();
  }

  const customerTonnage = {}; // { "CustomerName": totalTonnage }
  const customerFlights = {}; // { "CustomerName": totalFlights }

  dataToRender.forEach(r => {
    const airline = r.Airline || 'Unbekannt';
    const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;

    customerTonnage[airline] = (customerTonnage[airline] || 0) + tonnage;
    customerFlights[airline] = (customerFlights[airline] || 0) + 1;
  });

  // Sort by tonnage (descending)
  const sortedAirlines = Object.keys(customerTonnage).sort((a, b) => customerTonnage[b] - customerTonnage[a]);

  const labels = sortedAirlines;
  const data = sortedAirlines.map(airline => customerTonnage[airline]);

  const ctx = document.getElementById('tonnagePerCustomerChart').getContext('2d');
  tonnagePerCustomerChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tonnage pro Airline (kg)',
        data: data,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Tonnage (kg)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Airline'
          }
        }
      }
    }
  });
}

// NEU: Funktion zur Darstellung der Flüge und Tonnage pro Airline in einer Tabelle
function renderFlightsAndTonnagePerAirlineTable(dataToRender) {
    const airlineStats = {};

    dataToRender.forEach(r => {
        const airline = r.Airline || 'N/A';
        const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;

        if (!airlineStats[airline]) {
            airlineStats[airline] = { flights: 0, tonnage: 0 };
        }
        airlineStats[airline].flights++;
        airlineStats[airline].tonnage += tonnage;
    });

    const tableBody = document.querySelector('#airlineStatisticsTable tbody');
    tableBody.innerHTML = ''; // Clear previous data

    // Sort airlines by total tonnage descending
    const sortedAirlines = Object.keys(airlineStats).sort((a, b) => airlineStats[b].tonnage - airlineStats[a].tonnage);

    sortedAirlines.forEach(airline => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = airline;
        row.insertCell().textContent = airlineStats[airline].flights;
        row.insertCell().textContent = airlineStats[airline].tonnage.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    });
}


function downloadStatisticsToCSV() {
    const statFromDate = document.getElementById('statFromDate').value;
    const statToDate = document.getElementById('statToDate').value;

    let dataToExport = requestData;

    if (statFromDate && statToDate) {
        const fromDateObj = new Date(statFromDate);
        const toDateObj = new Date(statToDate);
        fromDateObj.setHours(0, 0, 0, 0);
        toDateObj.setHours(23, 59, 59, 999);

        dataToExport = requestData.filter(r => {
            let flightDateFromData = r['Flight Date'];
            let flightDateObj;
            if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = flightDateFromData.split('-');
                flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (flightDateFromData instanceof Date) {
                flightDateObj = flightDateFromData;
            } else {
                flightDateObj = new Date('Invalid Date');
            }
            flightDateObj.setHours(0, 0, 0, 0);

            return flightDateObj >= fromDateObj && flightDateObj <= toDateObj;
        });
    }

    if (dataToExport.length === 0) {
        alert("Keine Daten zum Exportieren für den ausgewählten Zeitraum.");
        return;
    }

    // NEU: Sammle alle möglichen Kopfzeilen aus den Daten
    const allKeys = new Set();
    dataToExport.forEach(obj => {
        Object.keys(obj).forEach(key => allKeys.add(key));
    });

    // Bestimme die Reihenfolge der Spalten. Wichtige Spalten zuerst.
    const desiredOrder = [
        "Ref", "Flight Date", "Airline", "Flugnummer", "Tonnage", "Flight Type Import", "Origin", "Flight Type Export", "Destination",
        "Vorfeldbegleitung", "Dangerous Goods", "Rate", "Security charges", "10ft consumables", "20ft consumables", "Zusatzkosten",
        "Billing Company", "Billing Address", "Tax Number", "Contact Name Invoicing", "Contact E-Mail Invoicing",
        "Email Request", "AGB Accepted", "Service Description Accepted", "Accepted By Name", "Acceptance Timestamp", "Final Confirmation Sent", "Created At"
    ];

    const headers = desiredOrder.filter(key => allKeys.has(key)).concat(
        Array.from(allKeys).filter(key => !desiredOrder.includes(key))
    );

    let csvContent = headers.map(header => `"${header}"`).join(";") + "\n"; // Headers with semicolon separator

    dataToExport.forEach(row => {
        const rowValues = headers.map(header => {
            let value = row[header] !== undefined && row[header] !== null ? String(row[header]) : "";

            // Spezialbehandlung für Tonnage und andere numerische Felder zur Ausgabe mit Komma
            if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(header)) {
                value = parseFloat(value.replace(',', '.') || "0").toLocaleString('de-DE', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            // Sicherstellen, dass Kommas in Textfeldern nicht als Separator interpretiert werden
            value = `"${value.replace(/"/g, '""')}"`;
            return value;
        });
        csvContent += rowValues.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Charter_Statistik_${statFromDate}_bis_${statToDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// === EMAIL FUNKTIONEN ===
function openEmailConfirmationModal(data) {
    currentModalData = data; // Store data for use in email functions
    document.getElementById('emailConfirmationModal').style.display = 'flex';
    document.getElementById('emailConfirmationMessage').textContent = ''; // Clear previous messages
    document.getElementById('recipientEmailInput').value = currentModalData['Contact E-Mail Invoicing'] || ''; // Pre-fill with invoicing email
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
}

function openEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'flex';
}

function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
}

document.getElementById('previewEmailBtn').addEventListener('click', generateEmailPreview);
document.getElementById('sendEmailConfirmBtn').addEventListener('click', sendCharterConfirmationEmail);
document.getElementById('markAsSentBtn').addEventListener('click', markAsSentManually);


async function generateEmailPreview() {
    const recipientEmail = document.getElementById('recipientEmailInput').value;
    if (!recipientEmail) {
        document.getElementById('emailConfirmationMessage').textContent = 'Bitte geben Sie eine Empfänger-E-Mail-Adresse ein.';
        return;
    }
    document.getElementById('emailConfirmationMessage').textContent = 'Generiere Vorschau...';

    const payload = {
        mode: 'generateEmailPreview',
        ref: currentModalData.Ref,
        recipientEmail: recipientEmail,
        user: currentUser.name
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
            document.getElementById('emailPreviewContent').innerHTML = result.htmlContent; // Render HTML directly
            document.getElementById('previewRef').textContent = currentModalData.Ref;
            closeEmailConfirmationModal(); // Close confirmation modal
            openEmailPreviewModal(); // Open preview modal
            document.getElementById('emailConfirmationMessage').textContent = '';
        } else {
            document.getElementById('emailConfirmationMessage').textContent = result.message || 'Fehler beim Generieren der E-Mail-Vorschau.';
        }
    } catch (error) {
        console.error('Fehler beim Generieren der E-Mail-Vorschau:', error);
        document.getElementById('emailConfirmationMessage').textContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
    }
}


async function sendCharterConfirmationEmail() {
    const recipientEmail = document.getElementById('recipientEmailInput').value;
    if (!recipientEmail) {
        document.getElementById('emailConfirmationMessage').textContent = 'Bitte geben Sie eine Empfänger-E-Mail-Adresse ein.';
        return;
    }

    // Zusätzliche Bestätigung vor dem Senden
    const confirmSend = confirm(`Möchten Sie die Charter Bestätigung wirklich an ${recipientEmail} senden?`);
    if (!confirmSend) {
        return;
    }

    document.getElementById('emailConfirmationMessage').textContent = 'Sende E-Mail...';
    document.getElementById('sendEmailConfirmBtn').disabled = true; // Disable button to prevent multiple clicks

    const payload = {
        mode: 'sendCharterConfirmation',
        ref: currentModalData.Ref,
        recipientEmail: recipientEmail,
        user: currentUser.name
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
            document.getElementById('emailConfirmationMessage').textContent = 'E-Mail erfolgreich gesendet!';
            document.getElementById('emailConfirmationMessage').style.color = 'green';
            // Update the 'Final Confirmation Sent' status in requestData and re-render
            const index = requestData.findIndex(r => r.Ref === currentModalData.Ref);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                // Trigger a re-render of the table and calendar to show the checkmark
                filterTable();
            }
            setTimeout(() => {
                closeEmailConfirmationModal();
                closeModal(); // Close detail modal as well
            }, 2000); // Close after 2 seconds
        } else {
            document.getElementById('emailConfirmationMessage').textContent = result.message || 'Fehler beim Senden der E-Mail.';
            document.getElementById('emailConfirmationMessage').style.color = 'red';
        }
    } catch (error) {
        console.error('Fehler beim Senden der E-Mail:', error);
        document.getElementById('emailConfirmationMessage').textContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
        document.getElementById('emailConfirmationMessage').style.color = 'red';
    } finally {
        document.getElementById('sendEmailConfirmBtn').disabled = false; // Re-enable button
    }
}

async function markAsSentManually() {
    const confirmManualSent = confirm(`Möchten Sie diesen Eintrag wirklich manuell als "Charter Confirmation gesendet" markieren?`);
    if (!confirmManualSent) {
        return;
    }

    const payload = {
        mode: 'markAsSentManually',
        ref: currentModalData.Ref,
        user: currentUser.name // Log the user who performed the action
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
            showSaveFeedback('Eintrag erfolgreich als "gesendet" markiert!', true);
            // Update the 'Final Confirmation Sent' status in requestData and re-render
            const index = requestData.findIndex(r => r.Ref === currentModalData.Ref);
            if (index !== -1) {
                requestData[index]['Final Confirmation Sent'] = 'Ja';
                filterTable(); // Re-render table to show updated status
            }
            closeEmailPreviewModal();
            closeModal(); // Close detail modal as well
        } else {
            showSaveFeedback(result.message || 'Fehler beim manuellen Markieren als "gesendet".', false);
        }
    } catch (error) {
        console.error('Fehler beim manuellen Markieren als "gesendet":', error);
        showSaveFeedback('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', false);
    }
}

// === Initialisierung ===
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  updateClock();
  setInterval(updateClock, 1000); // Aktualisiert die Uhr jede Sekunde
  renderCalendars(); // Initialisiere den Kalender nach dem Laden der Daten
  // Set initial dates for statistics
  const statFromDateInput = document.getElementById('statFromDate');
  const statToDateInput = document.getElementById('statToDate');
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  statFromDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
  statToDateInput.value = today.toISOString().split('T')[0];
});


// === Hilfsfunktionen ===
function updateClock() {
  const now = new Date();
  document.getElementById("currentDate").textContent = `Datum: ${now.toLocaleDateString('de-DE')}`;
  document.getElementById("clock").textContent = `Uhrzeit: ${now.toLocaleTimeString('de-DE')}`;
}

function showSaveFeedback(message, isSuccess) {
  const feedbackElement = document.createElement('div');
  feedbackElement.textContent = message;
  feedbackElement.style.position = 'fixed';
  feedbackElement.style.bottom = '20px';
  feedbackElement.style.left = '50%';
  feedbackElement.style.transform = 'translateX(-50%)';
  feedbackElement.style.backgroundColor = isSuccess ? '#28a745' : '#dc3545';
  feedbackElement.style.color = 'white';
  feedbackElement.style.padding = '10px 20px';
  feedbackElement.style.borderRadius = '8px';
  feedbackElement.style.zIndex = '3000';
  feedbackElement.style.opacity = '0';
  feedbackElement.style.transition = 'opacity 0.5s ease-in-out';
  feedbackElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

  document.body.appendChild(feedbackElement);

  // Fade in
  setTimeout(() => {
    feedbackElement.style.opacity = '1';
  }, 100);

  // Fade out and remove
  setTimeout(() => {
    feedbackElement.style.opacity = '0';
    feedbackElement.addEventListener('transitionend', () => {
      feedbackElement.remove();
    });
  }, 3000);
}

function generateReference() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3-stellige Zufallszahl

  return `REF-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}
