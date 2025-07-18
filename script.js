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

function renderTables(unconfirmedData, confirmedData) { // Erlaubt das Rendern von gefilterten Daten
  const unconfirmedTbody = document.querySelector("#unconfirmedDataTable tbody");
  const confirmedTbody = document.querySelector("#confirmedDataTable tbody");
  unconfirmedTbody.innerHTML = "";
  confirmedTbody.innerHTML = "";

  let totalUnconfirmedFlights = 0;
  let totalUnconfirmedWeight = 0;
  let totalConfirmedFlights = 0;
  let totalConfirmedWeight = 0;

  // Render Unconfirmed Table
  unconfirmedData.forEach((r) => {
    const row = document.createElement("tr");
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            let dateObj;
            if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = displayFlightDate.split('-');
                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (displayFlightDate instanceof Date) {
                dateObj = new Date(displayFlightDate.getFullYear(), displayFlightDate.getMonth(), displayFlightDate.getDate());
            } else {
                dateObj = new Date('Invalid Date');
            }
            dateObj.setHours(0, 0, 0, 0);
            if (!isNaN(dateObj.getTime())) {
                displayFlightDate = dateObj.toLocaleDateString('de-DE');
            }
        } catch (e) {
             console.error("Fehler bei der Datumskonvertierung für die Anzeige in Unconfirmed Tabelle:", displayFlightDate, e);
        }
    }
    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString('de-DE')}</td>
      <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button>
        ${deleteButtonHTML}
      </td>
    `;
    unconfirmedTbody.appendChild(row);
    totalUnconfirmedFlights++;
    totalUnconfirmedWeight += ton;
  });

  document.getElementById("unconfirmedSummaryInfo").textContent =
    `Total Flights: ${totalUnconfirmedFlights} | Total Tonnage: ${totalUnconfirmedWeight.toLocaleString('de-DE')} kg`;

  // Render Confirmed Table
  confirmedData.forEach((r) => {
    const row = document.createElement("tr");
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            let dateObj;
            if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = displayFlightDate.split('-');
                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (displayFlightDate instanceof Date) {
                dateObj = new Date(displayFlightDate.getFullYear(), displayDate.getMonth(), displayFlightDate.getDate());
            } else {
                dateObj = new Date('Invalid Date');
            }
            dateObj.setHours(0, 0, 0, 0);
            if (!isNaN(dateObj.getTime())) {
                displayFlightDate = dateObj.toLocaleDateString('de-DE');
            }
        } catch (e) {
             console.error("Fehler bei der Datumskonvertierung für die Anzeige in Confirmed Tabelle:", displayFlightDate, e);
        }
    }
    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a><span class="text-green-500 ml-1">&#10004;</span></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString('de-DE')}</td>
      <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button>
        ${deleteButtonHTML}
      </td>
    `;
    confirmedTbody.appendChild(row);
    totalConfirmedFlights++;
    totalConfirmedWeight += ton;
  });

  document.getElementById("confirmedSummaryInfo").textContent =
    `Total Flights: ${totalConfirmedFlights} | Total Tonnage: ${totalConfirmedWeight.toLocaleString('de-DE')} kg`;

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
    if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet竭-MM-DD vom Backend
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

  const unconfirmedFiltered = filtered.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() !== 'ja');
  const confirmedFiltered = filtered.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja');

  renderTables(unconfirmedFiltered, confirmedFiltered);
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
    'Call Sign': "", // NEU: Call Sign hinzugefügt
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
    'Destination': '' // NEU: Destination für Export
  } : requestData[originalIndex];

  // Speichere die aktuellen Daten im Modal, um sie später für die E-Mail zu verwenden
  currentModalData = r;

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  // Set the Call Sign input in the FlightRadar24 search section
  const callSignSearchInput = document.getElementById('callSignSearchInput');
  if (callSignSearchInput) {
      callSignSearchInput.value = r['Call Sign'] || '';
  }

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
          "Ref", "Created At", "Acceptance Timestamp", "Email Request", "Accepted By Name", "Final Confirmation Sent"
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
        'Rate', 'Security charges', 'Dangerous Goods',
        '10ft consumables', '20ft consumables', 'Zusatzkosten'
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
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet竭-MM-DD vom Backend
                    dateValue = value;
                } else if (value instanceof Date) {
                    dateValue = value.toISOString().split('T')[0]; // Konvertiere Date-Objekt zu竭-MM-DD
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
    { label: "Call Sign", key: "Call Sign" }, // NEU: Call Sign hinzugefügt
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

// NEU: Funktion zum Suchen auf FlightRadar24
function searchFlightRadar24() {
    const callSign = document.getElementById('callSignSearchInput').value.trim();
    if (callSign) {
        window.open(`https://www.flightradar24.com/${callSign}`, '_blank');
    } else {
        showSaveFeedback("Bitte geben Sie ein Call Sign ein, um auf FlightRadar24 zu suchen.", false);
    }
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

            // Füge das Label und Input nach der Checkbox hinzu
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
    }
}


function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

// === DATEN SPEICHERN ===
async function saveDetails() {
  const modal = document.getElementById("detailModal");
  const inputs = modal.querySelectorAll("input, select, textarea");
  const data = {};
  inputs.forEach((input) => {
    let key = input.name;
    let value;

    if (input.type === 'checkbox') {
        value = input.checked ? 'Ja' : 'Nein';
    } else if (input.tagName === 'SELECT') {
        value = input.value;
    }
    else {
        value = input.value;
    }
    data[key] = value;
  });

  // Überprüfe Pflichtfelder (Beispiel: Airline, Flugnummer, Flight Date, Tonnage)
  const requiredFields = ['Airline', 'Flugnummer', 'Flight Date', 'Tonnage'];
  for (const field of requiredFields) {
      if (!data[field] || String(data[field]).trim() === '') {
          showSaveFeedback(`Fehler: Das Feld '${field}' ist ein Pflichtfeld.`, false);
          return; // Abbruch bei fehlendem Pflichtfeld
      }
  }

  // Zusätzliche Prüfungen für 'Flight Type Import' und 'Flight Type Export'
  if (data['Flight Type Import'] === 'Ja' && (!data['Origin'] || String(data['Origin']).trim() === '')) {
      showSaveFeedback('Fehler: Wenn "Flight Type Import" ausgewählt ist, muss "Origin" ausgefüllt sein.', false);
      return;
  }
  if (data['Flight Type Export'] === 'Ja' && (!data['Destination'] || String(data['Destination']).trim() === '')) {
      showSaveFeedback('Fehler: Wenn "Flight Type Export" ausgewählt ist, muss "Destination" ausgefüllt sein.', false);
      return;
  }

  // Ref und Created At sollten nicht änderbar sein
  data.Ref = currentModalData.Ref; // Stelle sicher, dass die Referenz beibehalten wird
  data['Created At'] = currentModalData['Created At'];

  const payload = {
    mode: "write",
    data: data,
    user: currentUser ? currentUser.name : "Unknown", // Benutzername für Audit-Log
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload).toString(),
    });

    const result = await response.json();

    if (response.ok && result.status === "success") {
      showSaveFeedback("Daten erfolgreich gespeichert!", true);
      closeModal();
      fetchData(); // Daten neu laden und Tabelle aktualisieren
    } else {
      showSaveFeedback(
        result.message || "Fehler beim Speichern der Daten!",
        false
      );
    }
  } catch (error) {
    console.error("Speicherfehler:", error);
    showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
  }
}

async function deleteRow(buttonElement) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("Sie haben keine Berechtigung, Daten zu löschen.", false);
      return;
  }

  if (!confirm("Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?")) {
    return;
  }

  const row = buttonElement.closest("tr");
  const ref = row.cells[0].textContent.replace('✔', '').trim(); // Ref aus erster Zelle holen, Haken entfernen

  await deleteData(ref);
}

async function deleteRowFromModal(ref) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("Sie haben keine Berechtigung, Daten zu löschen.", false);
      return;
  }

  if (!confirm(`Sind Sie sicher, dass Sie den Eintrag mit Referenz "${ref}" löschen möchten?`)) {
    return;
  }

  await deleteData(ref);
  closeModal(); // Modal schließen nach dem Löschen
}

async function deleteData(ref) {
  const payload = {
    mode: "delete",
    ref: ref,
    user: currentUser ? currentUser.name : "Unknown", // Benutzername für Audit-Log
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload).toString(),
    });

    const result = await response.json();

    if (response.ok && result.status === "success") {
      showSaveFeedback("Eintrag erfolgreich gelöscht!", true);
      fetchData(); // Daten neu laden und Tabelle aktualisieren
    } else {
      showSaveFeedback(
        result.message || "Fehler beim Löschen des Eintrags!",
        false
      );
    }
  } catch (error) {
    console.error("Löschfehler:", error);
    showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
  }
}

function generateReference() {
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); // 4 zufällige Ziffern
  return `REF-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}


function showSaveFeedback(message, isSuccess) {
  const feedbackElement = document.getElementById("saveFeedback");
  if (!feedbackElement) {
    // Wenn das Feedback-Element nicht existiert, erstellen wir es
    const mainContent = document.querySelector('.main');
    if (mainContent) {
        const div = document.createElement('div');
        div.id = 'saveFeedback';
        div.style.position = 'fixed';
        div.style.bottom = '20px';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.padding = '10px 20px';
        div.style.borderRadius = '8px';
        div.style.zIndex = '3000';
        div.style.color = 'white';
        div.style.textAlign = 'center';
        div.style.opacity = '0';
        div.style.transition = 'opacity 0.5s ease-in-out';
        mainContent.appendChild(div);
        feedbackElement = div;
    } else {
        console.warn("Feedback-Element und .main-Container nicht gefunden. Feedback kann nicht angezeigt werden.");
        return;
    }
  }

  feedbackElement.textContent = message;
  feedbackElement.style.backgroundColor = isSuccess ? "#28a745" : "#dc3545";
  feedbackElement.style.opacity = '1';
  feedbackElement.style.display = 'block'; // Sicherstellen, dass es sichtbar ist

  setTimeout(() => {
    feedbackElement.style.opacity = '0';
    // Warte, bis die Transition beendet ist, bevor display auf 'none' gesetzt wird
    feedbackElement.addEventListener('transitionend', function handler() {
        feedbackElement.style.display = 'none';
        feedbackElement.removeEventListener('transitionend', handler);
    }, { once: true });
  }, 3000);
}


// === KALENDER FUNKTIONEN ===
function renderCalendars() {
  const calendarArea = document.getElementById("calendarArea");
  calendarArea.innerHTML = "";

  // Monate für die Anzeige festlegen (aktueller, vorheriger, nächster Monat)
  const monthsToShow = [
    new Date(baseYear, baseMonth - 1), // Vorheriger Monat
    new Date(baseYear, baseMonth),     // Aktueller Monat
    new Date(baseYear, baseMonth + 1)  // Nächster Monat
  ];

  monthsToShow.forEach(date => {
    calendarArea.appendChild(createMonthCalendar(date));
  });
}

function createMonthCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0); // Letzter Tag des Monats
  const daysInMonth = lastDay.getDate();

  const calendarBlock = document.createElement("div");
  calendarBlock.className = "calendar-block";
  calendarBlock.innerHTML = `
    <h4>${monthName}</h4>
    <table>
      <thead>
        <tr>
          <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  `;

  const tbody = calendarBlock.querySelector("tbody");
  let dayCounter = 1;
  const startDay = (firstDay.getDay() + 6) % 7; // Montag = 0, Sonntag = 6

  for (let i = 0; i < 6; i++) { // Max 6 Wochen im Monat
    const row = document.createElement("tr");
    for (let j = 0; j < 7; j++) {
      const cell = document.createElement("td");
      if (i === 0 && j < startDay) {
        cell.className = "calendar-day empty";
      } else if (dayCounter > daysInMonth) {
        cell.className = "calendar-day empty";
      } else {
        const currentDay = dayCounter;
        const fullDate = new Date(year, month, currentDay);
        fullDate.setHours(0,0,0,0); // Zeit auf Mitternacht setzen

        // Filter Flüge für diesen Tag und erfasse Typen
        const flightsOnDay = requestData.filter(d => {
            let flightDateObj;
            if (typeof d['Flight Date'] === 'string' && d['Flight Date'].match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = d['Flight Date'].split('-');
                flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (d['Flight Date'] instanceof Date) {
                flightDateObj = d['Flight Date'];
            } else {
                flightDateObj = new Date('Invalid Date');
            }
            flightDateObj.setHours(0,0,0,0); // Auch Flugdatum auf Mitternacht setzen
            return flightDateObj.getTime() === fullDate.getTime();
        });

        let hasImport = false;
        let hasExport = false;
        let hasOther = false;
        let tooltipContent = [];

        flightsOnDay.forEach(flight => {
            if (String(flight['Flight Type Import']).toLowerCase() === 'ja') {
                hasImport = true;
            }
            if (String(flight['Flight Type Export']).toLowerCase() === 'ja') {
                hasExport = true;
            }
            if (String(flight['Flight Type Import']).toLowerCase() !== 'ja' && String(flight['Flight Type Export']).toLowerCase() !== 'ja') {
                hasOther = true;
            }

            // Tooltip-Inhalt erstellen
            const flightTime = flight['Abflugzeit'] ? ` (${flight['Abflugzeit']} Uhr)` : '';
            const flightInfo = `${flight.Ref} - ${flight.Airline} - ${flight.Flugnummer || 'N/A'}${flightTime} - ${parseFloat(String(flight.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')} kg`;
            tooltipContent.push(flightInfo);
        });


        cell.textContent = currentDay;
        cell.className = "calendar-day";
        cell.onclick = () => openDayOverview(fullDate.toDateString(), flightsOnDay);


        if (flightsOnDay.length > 0) {
            cell.dataset.tooltip = tooltipContent.join('\n'); // Füge alle Flüge zum Tooltip hinzu
            if (hasImport && hasExport) {
                cell.classList.add('import-export');
            } else if (hasImport) {
                cell.classList.add('import-only');
            } else if (hasExport) {
                cell.classList.add('export-only');
            } else {
                cell.classList.add('has-flights'); // Bestehende Klasse für andere Flüge
            }
        }
        dayCounter++;
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
    if (dayCounter > daysInMonth) break; // Schleife beenden, wenn alle Tage des Monats gerendert wurden
  }

  return calendarBlock;
}


function shiftCalendar(direction) {
  baseMonth += direction;
  if (baseMonth > 11) {
    baseMonth = 0;
    baseYear++;
  } else if (baseMonth < 0) {
    baseMonth = 11;
    baseYear--;
  }
  renderCalendars();
}

function openDayOverview(dateString, flights) {
    const historyModal = document.getElementById('historyModal');
    const historyRefSpan = document.getElementById('historyRef');
    const historyBody = document.getElementById('historyBody');

    historyRefSpan.textContent = `Flüge am ${new Date(dateString).toLocaleDateString('de-DE')}`;
    historyBody.innerHTML = ''; // Alten Inhalt leeren

    if (flights.length === 0) {
        historyBody.innerHTML = '<p>Keine Flüge für dieses Datum.</p>';
    } else {
        const ul = document.createElement('ul');
        flights.forEach(flight => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>Ref:</strong> <a href="javascript:void(0);" onclick="openModal(${requestData.findIndex(item => item.Ref === flight.Ref)}); closeHistoryModal();">${flight.Ref}</a><br>
                <strong>Airline:</strong> ${flight.Airline || '-'}<br>
                <strong>Flugnummer:</strong> ${flight.Flugnummer || '-'}<br>
                <strong>Call Sign:</strong> ${flight['Call Sign'] || '-'}<br>
                <strong>Tonnage:</strong> ${parseFloat(String(flight.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')} kg<br>
                <strong>Abflugzeit:</strong> ${flight['Abflugzeit'] || '-'}<br>
                <strong>Bestätigt:</strong> ${String(flight['Final Confirmation Sent']).toLowerCase() === 'ja' ? 'Ja' : 'Nein'}
            `;
            ul.appendChild(li);
        });
        historyBody.appendChild(ul);
    }
    historyModal.style.display = 'flex';
}


function showHistory(ref) {
    const historyModal = document.getElementById('historyModal');
    const historyRefSpan = document.getElementById('historyRef');
    const historyBody = document.getElementById('historyBody');

    historyRefSpan.textContent = ref;
    historyBody.innerHTML = 'Lade Historie...';

    fetch(`${API_URL}?mode=history&ref=${encodeURIComponent(ref)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            historyBody.innerHTML = ''; // Alten Inhalt leeren
            if (data.history && data.history.length > 0) {
                const ul = document.createElement('ul');
                data.history.reverse().forEach(entry => { // Neueste zuerst
                    const li = document.createElement('li');
                    const timestamp = new Date(entry.timestamp).toLocaleString('de-DE');
                    const user = entry.user || 'System';
                    let changes = '';
                    try {
                        const parsedChanges = JSON.parse(entry.changes);
                        changes = Object.entries(parsedChanges).map(([key, value]) => {
                            if (typeof value === 'object' && value !== null && 'old' in value && 'new' in value) {
                                return `<li><strong>${key}:</strong> von "${value.old}" zu "${value.new}"</li>`;
                            }
                            return `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`; // Fallback für andere Formate
                        }).join('');
                        changes = `<ul>${changes}</ul>`;
                    } catch (e) {
                        changes = `<pre>${entry.changes}</pre>`; // Rohtext, wenn JSON-Parsing fehlschlägt
                    }
                    li.innerHTML = `<strong>${timestamp}</strong> by <i>${user}</i>:<br>${changes}`;
                    ul.appendChild(li);
                });
                historyBody.appendChild(ul);
            } else {
                historyBody.innerHTML = '<p>Keine Historie für diese Referenz gefunden.</p>';
            }
            historyModal.style.display = 'flex';
        })
        .catch(error => {
            console.error('Fehler beim Laden der Historie:', error);
            historyBody.innerHTML = `<p style="color: red;">Fehler beim Laden der Historie: ${error.message}</p>`;
            historyModal.style.display = 'flex';
        });
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}


// === STATISTIK FUNKTIONEN ===
function openStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'flex';
    generateStatistics(); // Statistiken generieren, wenn das Modal geöffnet wird
}

function closeStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'none';
    // Charts zerstören, um Speicherlecks zu vermeiden und bei erneutem Öffnen neu zu rendern
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
    const confirmedRequests = requestData.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja');

    // Tonnage pro Monat
    const tonnageByMonth = {};
    confirmedRequests.forEach(r => {
        const flightDate = r['Flight Date'];
        const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        if (flightDate) {
            const date = new Date(flightDate);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            tonnageByMonth[monthYear] = (tonnageByMonth[monthYear] || 0) + tonnage;
        }
    });

    const sortedMonths = Object.keys(tonnageByMonth).sort();
    const tonnageMonthLabels = sortedMonths.map(my => {
        const [year, month] = my.split('-');
        return new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    });
    const tonnageMonthData = sortedMonths.map(my => tonnageByMonth[my]);

    renderTonnagePerMonthChart(tonnageMonthLabels, tonnageMonthData);

    // Tonnage pro Kunde (Top 10)
    const tonnageByCustomer = {};
    confirmedRequests.forEach(r => {
        const customer = r['Billing Company'] || 'Unbekannt';
        const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        tonnageByCustomer[customer] = (tonnageByCustomer[customer] || 0) + tonnage;
    });

    const sortedCustomers = Object.entries(tonnageByCustomer)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10); // Top 10

    const tonnageCustomerLabels = sortedCustomers.map(entry => entry[0]);
    const tonnageCustomerData = sortedCustomers.map(entry => entry[1]);

    renderTonnagePerCustomerChart(tonnageCustomerLabels, tonnageCustomerData);
}


function renderTonnagePerMonthChart(labels, data) {
    const ctx = document.getElementById('tonnagePerMonthChart').getContext('2d');
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
    }
    tonnagePerMonthChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
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
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderTonnagePerCustomerChart(labels, data) {
    const ctx = document.getElementById('tonnagePerCustomerChart').getContext('2d');
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
    }
    tonnagePerCustomerChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: data,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#E7E9ED', '#8AC926', '#1982C4', '#6A4C93'
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('de-DE', { style: 'decimal' }).format(context.parsed) + ' kg';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function downloadStatisticsToCSV() {
    const confirmedRequests = requestData.filter(r => String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja');

    if (confirmedRequests.length === 0) {
        showSaveFeedback("Keine bestätigten Daten zum Exportieren vorhanden.", false);
        return;
    }

    const headers = [
        "Ref", "Created At", "Billing Company", "Billing Address", "Tax Number",
        "Contact Name Invoicing", "Contact E-Mail Invoicing", "Airline", "Aircraft Type",
        "Flugnummer", "Call Sign", // Call Sign hinzugefügt
        "Flight Date", "Abflugzeit", "Tonnage", "Rate", "Security charges", "Dangerous Goods",
        "10ft consumables", "20ft consumables", "Zusatzkosten", "Email Request",
        "AGB Accepted", "Service Description Accepted", "Accepted By Name", "Acceptance Timestamp",
        "Final Confirmation Sent", "Flight Type Import", "Flight Type Export", "Origin", "Destination"
    ];

    let csvContent = headers.join(";") + "\n"; // Headers as semicolon-separated

    confirmedRequests.forEach(row => {
        const values = headers.map(header => {
            let value = row[header];
            if (value === undefined || value === null) {
                value = "";
            }
            // Handle values that might contain semicolons or newlines
            if (typeof value === 'string' && (value.includes(';') || value.includes('\n') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`; // Enclose in double quotes and escape existing double quotes
            }
            return value;
        });
        csvContent += values.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "charter_statistics.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSaveFeedback("Statistiken erfolgreich als CSV heruntergeladen!", true);
    } else {
        showSaveFeedback("Ihr Browser unterstützt das Herunterladen von CSV-Dateien nicht direkt.", false);
    }
}


// === E-MAIL BESTÄTIGUNG MODAL FUNKTIONEN ===
function openEmailConfirmationModal(data) {
    currentModalData = data; // Setze die aktuellen Daten für das Modal
    const confirmRefSpan = document.getElementById('confirmRef');
    const confirmEmailSpan = document.getElementById('confirmEmail');
    const additionalEmailInput = document.getElementById('additionalEmail');
    const sendEmailConfirmBtn = document.getElementById('sendEmailConfirmBtn');

    confirmRefSpan.textContent = data.Ref;
    confirmEmailSpan.textContent = data['Contact E-Mail Invoicing'] || 'N/A';
    additionalEmailInput.value = ''; // Zusätzliches E-Mail-Feld leeren

    // Event Listener neu zuweisen, um sicherzustellen, dass er die aktuelle `data` erfasst
    sendEmailConfirmBtn.onclick = () => generateEmailPreview(data);

    document.getElementById('emailConfirmationModal').style.display = 'flex';
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
}

async function generateEmailPreview(data) {
    document.getElementById('emailConfirmationModal').style.display = 'none'; // Bestätigungsmodal schließen

    const previewRefSpan = document.getElementById('previewRef');
    const emailPreviewContentDiv = document.getElementById('emailPreviewContent');
    const markAsSentBtn = document.getElementById('markAsSentBtn');

    previewRefSpan.textContent = data.Ref;
    emailPreviewContentDiv.innerHTML = 'Lade E-Mail Vorschau...';

    const additionalEmail = document.getElementById('additionalEmail').value.trim();
    const recipientEmail = additionalEmail || data['Contact E-Mail Invoicing'];

    if (!recipientEmail) {
        showSaveFeedback("Keine E-Mail-Adresse für den Empfänger gefunden. Bitte geben Sie eine zusätzliche E-Mail ein.", false);
        return;
    }

    const payload = {
        mode: 'generateEmailPreview',
        ref: data.Ref,
        recipient: recipientEmail
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

        if (response.ok && result.status === 'success' && result.htmlContent) {
            emailPreviewContentDiv.innerHTML = result.htmlContent;
            // Markierungsbutton für manuelles Senden aktualisieren
            markAsSentBtn.onclick = () => markAsSentManually(data.Ref, true); // Übergibt 'true' für "als gesendet markieren"
            document.getElementById('emailPreviewModal').style.display = 'flex';
        } else {
            emailPreviewContentDiv.innerHTML = `<p style="color: red;">Fehler beim Laden der E-Mail-Vorschau: ${result.message || 'Unbekannter Fehler'}</p>`;
            markAsSentBtn.onclick = () => markAsSentManually(data.Ref, false); // "als gesendet markieren" ohne Vorschau
            document.getElementById('emailPreviewModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Fehler beim Abrufen der E-Mail-Vorschau:', error);
        emailPreviewContentDiv.innerHTML = `<p style="color: red;">Ein Netzwerkfehler ist aufgetreten: ${error.message}</p>`;
        markAsSentBtn.onclick = () => markAsSentManually(data.Ref, false); // "als gesendet markieren" ohne Vorschau
        document.getElementById('emailPreviewModal').style.display = 'flex';
    }
}

function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
}

// NEU: Funktion zum manuellen Markieren als gesendet (oder tatsächlich senden)
async function markAsSentManually(ref, sendEmail = false) {
    let payload = {
        mode: 'markAsSent',
        ref: ref,
        user: currentUser ? currentUser.name : "Unknown",
        sendEmail: sendEmail // Steuert, ob die E-Mail tatsächlich gesendet werden soll
    };

    // Wenn die E-Mail gesendet werden soll, fügen Sie die Empfänger hinzu
    if (sendEmail) {
        const additionalEmail = document.getElementById('additionalEmail').value.trim();
        payload.recipient = additionalEmail || currentModalData['Contact E-Mail Invoicing'];
        if (!payload.recipient) {
            showSaveFeedback("Keine E-Mail-Adresse für den Empfänger gefunden. E-Mail kann nicht gesendet werden.", false);
            return;
        }
    }

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
            showSaveFeedback(`Eintrag als 'Final Confirmation Sent' markiert. ${sendEmail ? 'E-Mail gesendet.' : ''}`, true);
            closeEmailPreviewModal();
            closeEmailConfirmationModal(); // Auch das Bestätigungsmodal schließen
            closeModal(); // Und das Detailmodal, da die Bestätigung nun abgeschlossen ist
            fetchData(); // Daten neu laden, um den Status-Update anzuzeigen
        } else {
            showSaveFeedback(result.message || `Fehler beim Markieren als gesendet. ${sendEmail ? 'E-Mail wurde nicht gesendet.' : ''}`, false);
        }
    } catch (error) {
        console.error('Fehler beim Markieren/Senden:', error);
        showSaveFeedback('Ein Fehler ist beim Markieren oder Senden aufgetreten. Bitte versuchen Sie es später erneut.', false);
    }
}


// Initialisiere Auth-Status, sobald das DOM geladen ist.
// Dies wird nach dem window.onload Event, aber vor dem Polling ausgeführt.
checkAuthStatus();
