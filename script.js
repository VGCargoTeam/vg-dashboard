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


// === AUTHENTIFIKATION UND BENUTZERVERWALTUNG ===
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

function renderTable(dataToRender = requestData) { // Erlaubt das Rendern von gefilterten Daten
  const unconfirmedTbody = document.querySelector("#unconfirmedDataTable tbody");
  const confirmedTbody = document.querySelector("#confirmedDataTable tbody");

  unconfirmedTbody.innerHTML = "";
  confirmedTbody.innerHTML = "";

  let totalUnconfirmedFlights = 0;
  let totalUnconfirmedWeight = 0;
  let totalConfirmedFlights = 0;
  let totalConfirmedWeight = 0;

  dataToRender.forEach((r) => { // dataToRender verwenden
    const row = document.createElement("tr");
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;

    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);

    // Datum korrekt für die Anzeige formatieren (DD.MM.YYYY)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            // Robustes Parsen des Datums, um Zeitzonenprobleme zu vermeiden
            let dateObj;
            if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet竭-MM-DD vom Backend
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
    if (isConfirmed) {
        confirmedTbody.appendChild(row);
        totalConfirmedFlights++;
        totalConfirmedWeight += ton;
    } else {
        unconfirmedTbody.appendChild(row);
        totalUnconfirmedFlights++;
        totalUnconfirmedWeight += ton;
    }
  });

  document.getElementById("unconfirmedSummary").textContent =
    `Total Unbestätigte Flüge: ${totalUnconfirmedFlights} | Total Tonnage: ${totalUnconfirmedWeight.toLocaleString('de-DE')} kg`;
  document.getElementById("confirmedSummary").textContent =
    `Total Bestätigte Flüge: ${totalConfirmedFlights} | Total Tonnage: ${totalConfirmedWeight.toLocaleString('de-DE')} kg`;
  document.getElementById("summaryInfo").textContent =
    `Gesamte Flüge: ${totalUnconfirmedFlights + totalConfirmedFlights} | Gesamte Tonnage: ${(totalUnconfirmedWeight + totalConfirmedWeight).toLocaleString('de-DE')} kg`;


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
  renderTable(filtered);
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
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "", 'Call Sign': "", // NEU: Call Sign hinzugefügt
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

  // NEW: FlightRadar24 Search input and button
  const flightRadarSearchHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
        <label for="callSignForFlightRadar" style="font-weight:bold;">FlightRadar24 Suche (Call Sign):</label>
        <input type="text" id="callSignForFlightRadar" value="${r['Call Sign'] || ''}" placeholder="Call Sign eingeben" style="flex-grow:1; padding:8px; border-radius:4px; border:1px solid #ccc;">
        <button onclick="searchFlightRadar24(document.getElementById('callSignForFlightRadar').value)"
                style="padding:8px 15px; background-color:#007BFF; color:white; border:none; border-radius:4px; cursor:pointer;">
            Suchen auf FlightRadar24
        </button>
    </div>
  `;

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

  // Add FlightRadar24 search to the modalBody
  modalBody.insertAdjacentHTML('afterbegin', flightRadarSearchHTML);

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
          inputElement.previousElementSibling.style.display = ''; // Label anzeigen
      }
  } else {
      // Wenn die Checkbox deaktiviert ist, verstecke das Feld, falls es existiert
      if (inputElement && inputElement.name === fieldType) {
          inputElement.style.display = 'none';
          if (inputElement.previousElementSibling && inputElement.previousElementSibling.tagName === 'LABEL') {
              inputElement.previousElementSibling.style.display = 'none';
          }
      }
  }
}


// Function to save details
async function saveDetails() {
  const modal = document.getElementById("detailModal");
  const inputs = modal.querySelectorAll("#modalBody input, #modalBody textarea, #modalBody select");
  const data = {};
  inputs.forEach(input => {
    const key = input.name;
    let value;
    if (input.type === "checkbox") {
      value = input.checked ? "Ja" : "Nein";
    } else if (input.tagName === "SELECT") {
      value = input.value;
    }
    else {
      value = input.value;
    }
    data[key] = value;
  });

  // Ensure "Final Confirmation Sent" is not overwritten if already 'Ja'
  if (currentModalData && currentModalData['Final Confirmation Sent'] === 'Ja') {
      data['Final Confirmation Sent'] = 'Ja';
  } else {
      data['Final Confirmation Sent'] = data['Final Confirmation Sent'] || 'Nein'; // Default to 'Nein' if not set
  }

  // Set acceptance details only if currently not accepted and AGB is accepted
  if (currentModalData && !currentModalData['Accepted By Name'] && data['AGB Accepted'] === 'Ja' && currentUser) {
      data['Accepted By Name'] = currentUser.name;
      data['Acceptance Timestamp'] = new Date().toLocaleString('de-DE');
  } else if (currentModalData) { // If already accepted, keep existing values
      data['Accepted By Name'] = currentModalData['Accepted By Name'] || "";
      data['Acceptance Timestamp'] = currentModalData['Acceptance Timestamp'] || "";
  }


  let payload = {
    mode: "write", // oder "update"
    data: JSON.stringify(data),
    user: currentUser.name // Aktuellen Benutzer für das Audit-Log hinzufügen
  };

  // Wenn es sich um ein Update handelt, fügen Sie die ursprüngliche Referenz hinzu
  if (currentModalData && currentModalData.Ref) {
    payload.mode = "update";
    payload.originalRef = currentModalData.Ref;
  }

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
      fetchData(); // Daten neu laden, um die Tabelle zu aktualisieren
    } else {
      showSaveFeedback(result.message || "Fehler beim Speichern der Daten!", false);
    }
  } catch (error) {
    console.error("Speicherfehler:", error);
    showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
  }
}


function closeModal() {
  document.getElementById("detailModal").style.display = "none";
  currentModalData = null; // Zurücksetzen der Modal-Daten beim Schließen
}

function showSaveFeedback(message, isSuccess) {
  const feedbackDiv = document.getElementById("saveFeedback");
  if (!feedbackDiv) {
    const mainDiv = document.querySelector(".main");
    const newFeedbackDiv = document.createElement("div");
    newFeedbackDiv.id = "saveFeedback";
    newFeedbackDiv.style.cssText = `
            position: fixed;
            top: 70px; /* Unter dem Header */
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            border-radius: 8px;
            font-weight: bold;
            color: white;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        `;
    mainDiv.appendChild(newFeedbackDiv);
  }

  const actualFeedbackDiv = document.getElementById("saveFeedback");
  actualFeedbackDiv.textContent = message;
  actualFeedbackDiv.style.backgroundColor = isSuccess ? "#28a745" : "#dc3545";
  actualFeedbackDiv.style.opacity = "1";

  setTimeout(() => {
    actualFeedbackDiv.style.opacity = "0";
  }, 3000);
}

// Function to delete a row
async function deleteRow(buttonElement) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("Sie haben keine Berechtigung, Einträge zu löschen.", false);
      return;
  }

  const row = buttonElement.closest("tr");
  const ref = row.children[0].textContent.replace('✓', '').trim(); // Ref aus der ersten Zelle

  if (confirm(`Sind Sie sicher, dass Sie den Eintrag mit der Referenz ${ref} löschen möchten?`)) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ mode: "delete", ref: ref, user: currentUser.name }).toString(),
      });

      const result = await response.json();
      if (response.ok && result.status === "success") {
        showSaveFeedback("Eintrag erfolgreich gelöscht!", true);
        fetchData(); // Tabelle aktualisieren
      } else {
        showSaveFeedback(result.message || "Fehler beim Löschen des Eintrags!", false);
      }
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
    }
  }
}

// Separate function for deleting from modal
async function deleteRowFromModal(ref) {
  if (!currentUser || currentUser.role !== 'admin') {
      showSaveFeedback("Sie haben keine Berechtigung, Einträge zu löschen.", false);
      return;
  }
  if (confirm(`Sind Sie sicher, dass Sie den Eintrag mit der Referenz ${ref} löschen möchten?`)) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ mode: "delete", ref: ref, user: currentUser.name }).toString(),
      });

      const result = await response.json();
      if (response.ok && result.status === "success") {
        showSaveFeedback("Eintrag erfolgreich gelöscht!", true);
        closeModal(); // Modal schließen nach dem Löschen
        fetchData(); // Tabelle aktualisieren
      } else {
        showSaveFeedback(result.message || "Fehler beim Löschen des Eintrags!", false);
      }
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
    }
  }
}


// Helper function to generate unique reference
function generateReference() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  // Kombinieren Sie Datum und Zeit für eine hohe Eindeutigkeit
  return `REF-${year}${month}${day}-${hours}${minutes}${seconds}`;
}


// === KALENDER FUNKTIONEN ===
function renderCalendars() {
  const calendarArea = document.getElementById("calendarArea");
  calendarArea.innerHTML = ""; // Alten Kalender löschen

  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  for (let i = -1; i <= 1; i++) { // Zeigt Vormonat, aktuellen Monat, nächsten Monat
    const displayDate = new Date(baseYear, baseMonth + i, 1);
    const month = displayDate.getMonth();
    const year = displayDate.getFullYear();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sonntag, 1 = Montag

    const calendarBlock = document.createElement("div");
    calendarBlock.className = "calendar-block";
    calendarBlock.innerHTML = `
      <h3 class="text-center text-lg font-bold my-2">${monthNames[month]} ${year}</h3>
      <table class="w-full text-sm">
        <thead>
          <tr>
            <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;
    const tbody = calendarBlock.querySelector("tbody");

    let dayCounter = 1;
    for (let row = 0; row < 6; row++) {
      const tr = document.createElement("tr");
      for (let col = 0; col < 7; col++) {
        const td = document.createElement("td");
        if ((row === 0 && col < (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1)) || dayCounter > numDays) {
          td.className = "calendar-day empty";
        } else {
          const currentDay = dayCounter;
          const fullDate = new Date(year, month, currentDay);
          fullDate.setHours(0,0,0,0); // Ensure no time component

          td.className = "calendar-day";
          td.textContent = currentDay;

          // Überprüfen, ob es Flüge an diesem Tag gibt
          const flightsOnThisDay = requestData.filter(r => {
            let flightDateFromData = r['Flight Date'];
            let flightDateObj;

            if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Erwartet竭-MM-DD vom Backend
                const parts = flightDateFromData.split('-');
                flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (flightDateFromData instanceof Date) { // Falls es direkt ein Date-Objekt ist
                flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
            } else {
                flightDateObj = new Date('Invalid Date'); // Ungültiges Datum
            }
            flightDateObj.setHours(0,0,0,0);

            return flightDateObj && !isNaN(flightDateObj.getTime()) && flightDateObj.getTime() === fullDate.getTime();
          });

          if (flightsOnThisDay.length > 0) {
            let tooltipContent = "";
            let hasImport = false;
            let hasExport = false;

            flightsOnThisDay.forEach(f => {
                tooltipContent += `Ref: ${f.Ref}\nAirline: ${f.Airline || '-'}\nTonnage: ${parseFloat(String(f.Tonnage).replace(',', '.') || "0").toLocaleString('de-DE')}kg\n`;
                if (String(f['Flight Type Import']).toLowerCase() === 'ja') hasImport = true;
                if (String(f['Flight Type Export']).toLowerCase() === 'ja') hasExport = true;
            });
            td.setAttribute("data-tooltip", tooltipContent.trim()); // Tooltip hinzufügen

            if (hasImport && hasExport) {
                td.classList.add("import-export");
            } else if (hasImport) {
                td.classList.add("import-only");
            } else if (hasExport) {
                td.classList.add("export-only");
            } else {
                td.classList.add("has-flights"); // Bestehende Klasse für allgemeine Flüge
            }
          }
          dayCounter++;
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      if (dayCounter > numDays) break;
    }
    calendarArea.appendChild(calendarBlock);
  }
}


function shiftCalendar(offset) {
  baseMonth += offset;
  if (baseMonth > 11) {
    baseMonth = 0;
    baseYear++;
  } else if (baseMonth < 0) {
    baseMonth = 11;
    baseYear--;
  }
  renderCalendars();
}


// === HISTORY FUNKTIONEN ===
async function showHistory(ref) {
    const historyModal = document.getElementById('historyModal');
    const historyBody = document.getElementById('historyBody');
    const historyRefSpan = document.getElementById('historyRef');

    if (historyRefSpan) historyRefSpan.textContent = ref;
    if (historyBody) historyBody.innerHTML = '<li>Lade Historie...</li>';

    try {
        const response = await fetch(`${API_URL}?mode=history&ref=${encodeURIComponent(ref)}`);
        const result = await response.json();

        if (response.ok && result.status === 'success' && result.data && result.data.length > 0) {
            historyBody.innerHTML = '<ul>' + result.data.map(entry => {
                let details = '';
                try {
                    const changes = JSON.parse(entry.Changes);
                    details = Object.entries(changes).map(([key, value]) => {
                        // Überprüfen, ob value.old und value.new existieren
                        if (value && typeof value === 'object' && 'old' in value && 'new' in value) {
                            return `<li><strong>${key}:</strong> Von "<pre>${value.old}</pre>" zu "<pre>${value.new}</pre>"</li>`;
                        }
                        // Wenn nur ein Wert vorhanden ist oder das Format anders ist
                        return `<li><strong>${key}:</strong> <pre>${JSON.stringify(value)}</pre></li>`;
                    }).join('');
                } catch (e) {
                    details = `<li><strong>Raw Changes:</strong> <pre>${entry.Changes}</pre></li>`;
                }

                return `
                    <li>
                        <strong>Timestamp:</strong> ${entry.Timestamp || 'N/A'}<br>
                        <strong>User:</strong> ${entry.User || 'N/A'}<br>
                        <strong>Action:</strong> ${entry.Action || 'N/A'}
                        <ul>${details}</ul>
                    </li>
                `;
            }).join('') + '</ul>';
        } else {
            if (historyBody) historyBody.innerHTML = '<li>Keine Historie für diese Referenz gefunden.</li>';
        }
        if (historyModal) historyModal.style.display = 'flex';
    } catch (error) {
        console.error('Fehler beim Abrufen der Historie:', error);
        if (historyBody) historyBody.innerHTML = '<li>Fehler beim Laden der Historie.</li>';
        showSaveFeedback("Fehler beim Laden der Historie!", false);
    }
}

function closeHistoryModal() {
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.style.display = 'none';
    }
}


// === STATISTICS MODAL FUNCTIONS ===
function openStatisticsModal() {
    const statisticsModal = document.getElementById('statisticsModal');
    if (statisticsModal) {
        statisticsModal.style.display = 'flex';
        generateStatistics();
    }
}

function closeStatisticsModal() {
    const statisticsModal = document.getElementById('statisticsModal');
    if (statisticsModal) {
        statisticsModal.style.display = 'none';
    }
}

function generateStatistics() {
    // Sicherstellen, dass alte Chart-Instanzen zerstört werden, bevor neue erstellt werden
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
        tonnagePerMonthChartInstance = null;
    }
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
        tonnagePerCustomerChartInstance = null;
    }


    const statsBody = document.getElementById('statisticsBody');
    statsBody.innerHTML = `
        <div class="chart-container">
            <canvas id="tonnagePerMonthChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="tonnagePerCustomerChart"></canvas>
        </div>
        <button onclick="downloadStatisticsToCSV()" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mt-4">
            Statistiken als CSV herunterladen
        </button>
    `; // Clear and re-add chart containers

    // Grouping data for Tonnage per Month
    const tonnagePerMonth = {};
    requestData.forEach(r => {
        let flightDate = r['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const dateParts = flightDate.split('-');
            const yearMonth = `${dateParts[0]}-${dateParts[1]}`; // YYYY-MM
            const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }
    });

    const sortedMonths = Object.keys(tonnagePerMonth).sort();
    const monthlyLabels = sortedMonths.map(ym => {
        const [year, month] = ym.split('-');
        return new Date(year, month - 1).toLocaleString('de-DE', { month: 'short', year: '2-digit' });
    });
    const monthlyData = sortedMonths.map(ym => tonnagePerMonth[ym]);

    renderTonnagePerMonthChart(monthlyLabels, monthlyData);


    // Grouping data for Tonnage per Customer (Billing Company)
    const tonnagePerCustomer = {};
    requestData.forEach(r => {
        const customer = r['Billing Company'] || 'Unbekannt';
        const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        tonnagePerCustomer[customer] = (tonnagePerCustomer[customer] || 0) + tonnage;
    });

    const sortedCustomers = Object.keys(tonnagePerCustomer).sort((a, b) => tonnagePerCustomer[b] - tonnagePerCustomer[a]);
    const customerLabels = sortedCustomers.slice(0, 10); // Top 10 Kunden
    const customerData = customerLabels.map(customer => tonnagePerCustomer[customer]);

    renderTonnagePerCustomerChart(customerLabels, customerData);

    // Optional: Add more summary statistics directly as text
    let totalTonnageOverall = requestData.reduce((sum, r) => sum + (parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0), 0);
    let numberOfRequests = requestData.length;

    const summaryStatsDiv = document.createElement('div');
    summaryStatsDiv.className = 'w-full text-center mt-4 p-4 bg-gray-50 rounded-lg shadow-inner';
    summaryStatsDiv.innerHTML = `
        <h4 class="text-lg font-semibold mb-2">Zusammenfassende Statistiken</h4>
        <p><strong>Gesamt-Tonnage aller Anfragen:</strong> ${totalTonnageOverall.toLocaleString('de-DE')} kg</p>
        <p><strong>Gesamtzahl der Anfragen:</strong> ${numberOfRequests}</p>
    `;
    statsBody.insertBefore(summaryStatsDiv, statsBody.querySelector('button')); // Vor dem Download-Button einfügen
}


function renderTonnagePerMonthChart(labels, data) {
    const ctx = document.getElementById('tonnagePerMonthChart').getContext('2d');
    tonnagePerMonthChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
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
                title: {
                    display: true,
                    text: 'Monatliche Tonnage'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString('de-DE') + ' kg';
                        }
                    }
                }
            }
        }
    });
}

function renderTonnagePerCustomerChart(labels, data) {
    const ctx = document.getElementById('tonnagePerCustomerChart').getContext('2d');
    tonnagePerCustomerChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)',
                    'rgba(199, 199, 199, 0.6)',
                    'rgba(83, 102, 255, 0.6)',
                    'rgba(100, 255, 80, 0.6)',
                    'rgba(255, 99, 200, 0.6)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(199, 199, 199, 1)',
                    'rgba(83, 102, 255, 1)',
                    'rgba(100, 255, 80, 1)',
                    'rgba(255, 99, 200, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tonnage pro Kunde (Top 10)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed) {
                                label += context.parsed.toLocaleString('de-DE') + ' kg';
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
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Statistic Type,Label,Value (kg)\n";

    // Monthly Tonnage
    const tonnagePerMonth = {};
    requestData.forEach(r => {
        let flightDate = r['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const dateParts = flightDate.split('-');
            const yearMonth = `${dateParts[0]}-${dateParts[1]}`; // YYYY-MM
            const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }
    });
    const sortedMonths = Object.keys(tonnagePerMonth).sort();
    sortedMonths.forEach(ym => {
        csvContent += `Monthly Tonnage,${ym},${tonnagePerMonth[ym].toLocaleString('en-US', {useGrouping: false})}\n`;
    });

    // Tonnage per Customer
    const tonnagePerCustomer = {};
    requestData.forEach(r => {
        const customer = r['Billing Company'] || 'Unbekannt';
        const tonnage = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        tonnagePerCustomer[customer] = (tonnagePerCustomer[customer] || 0) + tonnage;
    });
    const sortedCustomers = Object.keys(tonnagePerCustomer).sort((a, b) => tonnagePerCustomer[b] - tonnagePerCustomer[a]);
    sortedCustomers.forEach(customer => {
        csvContent += `Customer Tonnage,"${customer}",${tonnagePerCustomer[customer].toLocaleString('en-US', {useGrouping: false})}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "charter_statistics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSaveFeedback("Statistiken als CSV heruntergeladen!", true);
}


// E-Mail Funktionalität
function openEmailConfirmationModal(data) {
    const emailModal = document.getElementById('emailConfirmationModal');
    const emailRefSpan = document.getElementById('emailRef');
    const recipientInput = document.getElementById('recipientEmail');
    const subjectInput = document.getElementById('emailSubject');
    const bodyTextarea = document.getElementById('emailBody');
    const sendBtn = document.getElementById('sendEmailConfirmBtn');

    emailRefSpan.textContent = data.Ref;
    recipientInput.value = data['Contact E-Mail Invoicing'] || ''; // Vorab ausfüllen
    subjectInput.value = `Charter Confirmation für Ref: ${data.Ref}`;
    bodyTextarea.value = `Sehr geehrte/r ${data['Contact Name Invoicing'] || ''},\n\nwir bestätigen hiermit Ihre Charteranfrage mit der Referenz ${data.Ref}.\n\nFlugdetails:\nAirline: ${data.Airline || ''}\nAircraft Type: ${data['Aircraft Type'] || ''}\nFlugnummer: ${data.Flugnummer || ''}\nFlight Date: ${data['Flight Date'] || ''}\nAbflugzeit: ${data.Abflugzeit || ''}\nTonnage: ${data.Tonnage || ''} kg\n\nMit freundlichen Grüßen,\nIhr Team`;

    sendBtn.onclick = () => sendEmailConfirmation(data.Ref); // Event Listener setzen

    emailModal.style.display = 'flex';
}

function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
}

async function sendEmailConfirmation(ref) {
    const recipient = document.getElementById('recipientEmail').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    if (!recipient || !subject || !body) {
        showSaveFeedback("Bitte füllen Sie alle E-Mail-Felder aus.", false);
        return;
    }

    const payload = {
        mode: 'sendEmail',
        ref: ref,
        recipient: recipient,
        subject: subject,
        body: body,
        user: currentUser.name // Aktuellen Benutzer für das Audit-Log hinzufügen
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
            showSaveFeedback("E-Mail erfolgreich gesendet und Status aktualisiert!", true);
            closeEmailConfirmationModal();
            fetchData(); // Dashboard neu laden, um den Status-Haken zu aktualisieren
        } else {
            showSaveFeedback(result.message || "Fehler beim Senden der E-Mail.", false);
        }
    } catch (error) {
        console.error('E-Mail-Sendefehler:', error);
        showSaveFeedback("Ein Fehler ist beim Senden der E-Mail aufgetreten.", false);
    }
}

// NEU: Funktionen für E-Mail Vorschau
function generateEmailPreview() {
    const recipient = document.getElementById('recipientEmail').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    const previewContentDiv = document.getElementById('emailPreviewContent');
    const previewRefSpan = document.getElementById('previewRef');
    const emailPreviewModal = document.getElementById('emailPreviewModal');

    previewRefSpan.textContent = document.getElementById('emailRef').textContent; // Referenz aus dem Bestätigungsmodal übernehmen

    // Einfache HTML-Vorschau
    previewContentDiv.innerHTML = `
        <p><strong>To:</strong> ${recipient}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <div style="white-space: pre-wrap; font-family: sans-serif;">${body}</div>
    `;

    emailPreviewModal.style.display = 'flex';
}

function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
}

// NEU: Funktion zum manuellen Markieren als gesendet
async function markAsSentManually() {
    if (!currentModalData) {
        showSaveFeedback("Keine Daten im Modal verfügbar zum Aktualisieren.", false);
        return;
    }

    const ref = currentModalData.Ref;

    if (confirm(`Möchten Sie die Charter Confirmation für Referenz ${ref} wirklich als manuell gesendet markieren? Dies kann nicht rückgängig gemacht werden.`)) {
        let payload = {
            mode: "update",
            originalRef: ref,
            data: JSON.stringify({ 'Final Confirmation Sent': 'Ja' }), // Nur dieses Feld aktualisieren
            user: currentUser.name // Aktuellen Benutzer für das Audit-Log hinzufügen
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
                showSaveFeedback("Status erfolgreich auf 'Manuell gesendet' aktualisiert!", true);
                closeEmailPreviewModal();
                closeEmailConfirmationModal(); // Auch das Bestätigungsmodal schließen
                closeModal(); // Und das Haupt-Detailmodal schließen
                fetchData(); // Daten neu laden, um die Tabelle zu aktualisieren
            } else {
                showSaveFeedback(result.message || "Fehler beim Aktualisieren des Status.", false);
            }
        } catch (error) {
            console.error("Fehler beim manuellen Markieren als gesendet:", error);
            showSaveFeedback("Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.", false);
        }
    }
}


// Event Listener für den Preview Button im emailConfirmationModal hinzufügen
document.addEventListener('DOMContentLoaded', () => {
    const sendEmailConfirmBtn = document.getElementById('sendEmailConfirmBtn');
    if (sendEmailConfirmBtn) {
        sendEmailConfirmBtn.insertAdjacentHTML('afterend', '<button class="btn-email-action" onclick="generateEmailPreview()" style="margin-left:10px;">Vorschau</button>');
    }

    const markAsSentBtn = document.getElementById('markAsSentBtn');
    if (markAsSentBtn) {
        markAsSentBtn.addEventListener('click', markAsSentManually);
    }
});


// Call Sign search on FlightRadar24
function searchFlightRadar24(callSign) {
    if (callSign) {
        const url = `https://www.flightradar24.com/${callSign}`;
        window.open(url, '_blank');
    } else {
        showSaveFeedback("Bitte geben Sie ein Call Sign ein, um auf FlightRadar24 zu suchen.", false);
    }
}


// Initialisierung
window.onload = function() {
    checkAuthStatus();
    // Die fetchData() Funktion wird jetzt von checkAuthStatus() aufgerufen,
    // nachdem der Authentifizierungsstatus überprüft und der Benutzer geladen wurde.
    renderCalendars(); // Kalender initial rendern
};


// Mache Funktionen global zugänglich
window.openModal = openModal;
window.closeModal = closeModal;
window.saveDetails = saveDetails;
window.filterTable = filterTable;
window.deleteRow = deleteRow;
window.deleteRowFromModal = deleteRowFromModal;
window.shiftCalendar = shiftCalendar;
window.checkAuthStatus = checkAuthStatus;
window.logoutUser = logoutUser;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.showSaveFeedback = showSaveFeedback;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;
window.openStatisticsModal = openStatisticsModal; // Mache neue Funktion global zugänglich
window.closeStatisticsModal = closeStatisticsModal; // Mache neue Funktion global zugänglich
window.generateStatistics = generateStatistics; // Mache neue Funktion global zugänglich
window.renderTonnagePerMonthChart = renderTonnagePerMonthChart; // Mache neue Funktion global zugänglich
window.renderTonnagePerCustomerChart = renderTonnagePerCustomerChart; // Mache neue Funktion global zugänglich
window.downloadStatisticsToCSV = downloadStatisticsToCSV; // Mache neue Download-Funktion global zugänglich
window.openEmailConfirmationModal = openEmailConfirmationModal; // NEU: E-Mail Bestätigungsmodal öffnen
window.closeEmailConfirmationModal = closeEmailConfirmationModal; // NEU: E-Mail Bestätigungsmodal schließen
window.toggleOriginDestinationFields = toggleOriginDestinationFields; // NEU: Funktion global zugänglich machen
window.generateEmailPreview = generateEmailPreview; // NEU: Funktion für E-Mail-Vorschau
window.closeEmailPreviewModal = closeEmailPreviewModal; // NEU: Funktion zum Schließen der E-Mail-Vorschau
window.markAsSentManually = markAsSentManually; // NEU: Funktion zum manuellen Markieren als gesendet
window.searchFlightRadar24 = searchFlightRadar24; // NEU: Funktion zum Suchen auf FlightRadar24

// Initialisiere Auth-Status, sobald das DOM geladen ist.
// Dies wird nach dem window.onload Event, aber vor dem Polling ausgeführt.
// checkAuthStatus(); // Moved to window.onload
