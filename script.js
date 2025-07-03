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

function renderTable(dataToRender = requestData) { // Erlaubt das Rendern von gefilterten Daten
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  let totalFlights = 0;
  let totalWeight = 0;

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
      <td>${ton.toLocaleString('de-DE')}</td> <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button>
        ${deleteButtonHTML}
      </td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString('de-DE')} kg`;

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
      window.location.href = 'login.html';
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
          "Ref", "Created At", "Acceptance Timestamp", "Email Request", "Accepted By Name"
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
    { label: "Acceptance Timestamp", key: "Acceptance Timestamp" }
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
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
    closeStatisticsModal(); // NEU: Statistik Modal schließen
    closeEmailConfirmationModal(); // NEU: E-Mail Bestätigungsmodal schließen
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
    } else { // Wichtig: Für 'Zusatzkosten' (textarea) kommt der Wert einfach als String.
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${r.status}`);
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
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

  // Erstelle das Vergleichsdatum als String (YYYY-MM-DD)
  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date']; // Dies ist bereits竭-MM-DD vom Backend

    // Einfacher String-Vergleich
    const isMatch = flightDateFromData === clickedDateStr;
    console.log(`  Vergleich: Flugdatum "${flightDateFromData}" vs. geklicktes Datum "${clickedDateStr}" -> Match: ${isMatch}`);
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

  const flightsByDay = new Map();
  requestData.forEach((r) => {
    let flightDate = r['Flight Date'];
    if (typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [fYear, fMonth, fDay] = flightDate.split('-').map(Number);
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
        let simpleTitleContent = '';
        let dayHasVorfeldbegleitung = false;

        // NEU: Import/Export Status für den Tag
        let hasImport = false;
        let hasExport = false;


        // Check if current day is today and add 'today' class
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            cellClasses.push('today');
        }

        if (flightsForDay.length > 0) {
          // Entferne 'has-flights' da wir spezifischere Klassen verwenden
          // cellClasses.push('has-flights');

          flightsForDay.forEach(f => {
            const tonnageValue = parseFloat(String(f.Tonnage).replace(',', '.') || "0") || 0;

            let formattedAbflugzeit = f['Abflugzeit'] || '-';
            if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.match(/^\d{2}:\d{2}$/)) {
            } else if (formattedAbflugzeit instanceof Date) {
                formattedAbflugzeit = formattedAbflugzeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            } else if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.includes('T')) {
                try {
                    const timeObj = new Date(formattedAbflugzeit);
                    if (!isNaN(timeObj.getTime())) {
                        formattedAbflugzeit = timeObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) {
                    console.error("Fehler beim Formatieren der Abflugzeit für Tooltip:", formattedAbflugzeit, e);
                }
            }


            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlugnummer: ${f.Flugnummer || '-'}` +
              `\nAbflugzeit: ${formattedAbflugzeit}` +
              `\nTonnage: ${tonnageValue.toLocaleString('de-DE')} kg`
            );
            if (f.Origin) { // NEU: Origin zum Tooltip hinzufügen
                tooltipContentArray[tooltipContentArray.length - 1] += `\nOrigin: ${f.Origin}`;
            }
            if (f.Destination) { // NEU: Destination zum Tooltip hinzufügen
                tooltipContentArray[tooltipContentArray.length - 1] += `\nDestination: ${f.Destination}`;
            }

            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true;
            }
            // NEU: Import/Export Status prüfen
            if (String(f['Flight Type Import'] || '').toLowerCase() === 'ja') {
                hasImport = true;
            }
            if (String(f['Flight Type Export'] || '').toLowerCase() === 'ja') {
                hasExport = true;
            }
          });
          simpleTitleContent = `Flüge: ${flightsForDay.length}`;
        }

        // NEU: Klassen für Kalenderfarben hinzufügen
        if (hasImport && hasExport) {
            cellClasses.push('import-export');
        } else if (hasImport) {
            cellClasses.push('import-only');
        } else if (hasExport) {
            cellClasses.push('export-only');
        } else if (flightsForDay.length > 0) {
            // Wenn Flüge da sind, aber weder Import noch Export markiert, Standardfarbe für Flüge
            cellClasses.push('has-flights');
        }


        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        // Added styling for 'today' class here
        let dayNumberClass = '';
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            dayNumberClass = 'font-bold text-lg today-red-text'; // NEU: Klasse für rote Farbe
        } else {
            dayNumberClass = 'font-bold text-lg'; // Standardklasse für die Zahl
        }


        html += `<td class='${cellClasses.join(' ')}' title='${simpleTitleContent}' data-tooltip='${dataTooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})"><div class="${dayNumberClass}">${day}</div>${flightIcon}</td>`;
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

  // Das Event-Listener für archiveCheckbox muss hier bleiben, da es keine globale Funktion ist.
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

      // Nur für Viewer-Rolle sensible Informationen schwärzen (dieser Teil bleibt, da es um History geht)
      if (currentUser && currentUser.role === 'viewer' && typeof detailsContent === 'string') {
        const sensitiveFieldPrefixes = [
          'Rate:',
          'Security charges:',
          'Dangerous Goods:',
          '10ft consumables:',
          '20ft consumables:',
          'Zusatzkosten:'
        ];

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
          // Nicht-JSON-Strings werden direkt als Details angezeigt
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
        // Set default date range to current month if not already set
        const statFromDateInput = document.getElementById('statFromDate');
        const statToDateInput = document.getElementById('statToDate');
        if (!statFromDateInput.value || !statToDateInput.value) {
            const now = new Date();
            // Erster Tag des aktuellen Monats
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            // Letzter Tag des aktuellen Monats (geht zum nächsten Monat und dann zum 0. Tag)
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

            statFromDateInput.value = firstDayOfMonth;
            statToDateInput.value = lastDayOfMonth;
        }

        generateStatistics(); // Statistik beim Öffnen generieren
    } else {
        console.warn("Statistik-Modal (id='statisticsModal') nicht gefunden.");
    }
}

function closeStatisticsModal() {
    document.getElementById("statisticsModal").style.display = "none";
    // Optional: Zerstöre die Charts beim Schließen des Modals, um Speicher freizugeben
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

    // Entferne alte nicht-Diagramm-Inhalte, um Platz für neue Statistiken zu schaffen
    // ACHTUNG: Hier werden nur die dynamisch hinzugefügten Elemente entfernt.
    // Die statischen Chart-Container bleiben bestehen.
    const elementsToRemove = statisticsBody.querySelectorAll('h4, p, ul, table');
    elementsToRemove.forEach(el => {
        // Stelle sicher, dass nur die von generateStatistics hinzugefügten Elemente entfernt werden
        // und nicht die statischen Chart-Container
        if (!el.classList.contains('chart-container') && el.tagName !== 'CANVAS') {
            el.remove();
        }
    });


    if (!statFromDateInput || !statToDateInput) {
        statisticsBody.insertAdjacentHTML('beforeend', '<p style="text-align: center; color: red;">Bitte wählen Sie einen Start- und Enddatum für die Statistik.</p>');
        return;
    }

    const fromDate = new Date(statFromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(statToDateInput);
    toDate.setHours(23, 59, 59, 999); // Setze auf Ende des Tages für inklusiven Bereich

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
        flightDateObj.setHours(0, 0, 0, 0); // Normalisiere für den Vergleich

        return flightDateObj >= fromDate && flightDateObj <= toDate;
    });

    // Statistiken initialisieren
    let totalFlights = filteredData.length;
    let totalTonnage = 0;
    // Finanzstatistiken entfernt:
    // let totalRate = 0;
    // let totalSecurityCharges = 0;
    // let total10ftConsumables = 0;
    // let total20ftConsumables = 0;
    const dangerousGoodsCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    const VorfeldbegleitungCount = { "Ja": 0, "Nein": 0, "N/A": 0 };
    const airlineStats = {}; // { AirlineName: { totalTonnage: X, totalFlights: Y } } - totalRevenue entfernt
    const tonnagePerMonth = {}; // { "YYYY-MM": totalTonnage }
    const tonnagePerCustomer = {}; // { CustomerName: totalTonnage }


    filteredData.forEach(item => {
        const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
        
        totalTonnage += tonnage;

        // Dangerous Goods Statistik
        // Sicherstellen, dass item['Dangerous Goods'] immer ein String ist, bevor toLowerCase aufgerufen wird
        const dgStatus = String(item['Dangerous Goods'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Dangerous Goods'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        dangerousGoodsCount[dgStatus]++;

        // Vorfeldbegleitung Statistik
        const vbStatus = String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'ja' ? 'Ja' : (String(item['Vorfeldbegleitung'] || '').toLowerCase() === 'nein' ? 'Nein' : 'N/A');
        VorfeldbegleitungCount[vbStatus]++;

        // Airline-spezifische Statistik
        const airlineName = item.Airline || 'Unbekannt';
        if (!airlineStats[airlineName]) {
            airlineStats[airlineName] = { totalTonnage: 0, totalFlights: 0 }; // totalRevenue entfernt
        }
        airlineStats[airlineName].totalTonnage += tonnage;
        airlineStats[airlineName].totalFlights++;

        // Tonnage pro Monat Statistik
        const flightDate = item['Flight Date'];
        if (flightDate && typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const yearMonth = flightDate.substring(0, 7); // "YYYY-MM"
            const tonnage = parseFloat(String(item.Tonnage).replace(',', '.') || "0") || 0;
            tonnagePerMonth[yearMonth] = (tonnagePerMonth[yearMonth] || 0) + tonnage;
        }

        // Tonnage pro Kunde Statistik (nutzt 'Billing Company' als Kunde)
        const customerName = item['Billing Company'] || 'Unbekannt';
        tonnagePerCustomer[customerName] = (tonnagePerCustomer[customerName] || 0) + tonnage;
    });

    // --- TEXT-BASIERTE STATISTIKEN RENDERN ---
    let statsHTML = '<h4>Gesamtübersicht</h4>';
    statsHTML += `<p>Gesamtzahl Flüge: <strong>${totalFlights}</strong></p>`;
    statsHTML += `<p>Gesamte Tonnage: <strong>${totalTonnage.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg</strong></p>`;


    statsHTML += '<h4>Dangerous Goods Statistik</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Ja: ${dangerousGoodsCount["Ja"]} (${(dangerousGoodsCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>Nein: ${dangerousGoodsCount["Nein"]} (${(dangerousGoodsCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (dangerousGoodsCount["N/A"] > 0) {
        statsHTML += `<li>Nicht angegeben: ${dangerousGoodsCount["N/A"]} (${(dangerousGoodsCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul>`;

    statsHTML += '<h4>Vorfeldbegleitung Statistik</h4>';
    statsHTML += `<ul>`;
    statsHTML += `<li>Ja: ${VorfeldbegleitungCount["Ja"]} (${(VorfeldbegleitungCount["Ja"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    statsHTML += `<li>Nein: ${VorfeldbegleitungCount["Nein"]} (${(VorfeldbegleitungCount["Nein"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    if (VorfeldbegleitungCount["N/A"] > 0) {
        statsHTML += `<li>Nicht angegeben: ${VorfeldbegleitungCount["N/A"]} (${(VorfeldbegleitungCount["N/A"] / totalFlights * 100 || 0).toFixed(1)}%)</li>`;
    }
    statsHTML += `</ul>`;


    statsHTML += '<h4>Statistik nach Airline</h4>';
    if (Object.keys(airlineStats).length > 0) {
        statsHTML += `<table><thead><tr><th>Airline</th><th>Flüge</th><th>Tonnage (kg)</th>`;
        statsHTML += `</tr></thead><tbody>`;

        // Sortiere Airlines nach Gesamtflügen absteigend
        const sortedAirlines = Object.entries(airlineStats).sort(([, a], [, b]) => b.totalFlights - a.totalFlights);

        sortedAirlines.forEach(([airlineName, stats]) => {
            statsHTML += `<tr>`;
            statsHTML += `<td>${airlineName}</td>`;
            statsHTML += `<td>${stats.totalFlights}</td>`;
            statsHTML += `<td>${stats.totalTonnage.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</td>`;
            statsHTML += `</tr>`;
        });
        statsHTML += `</tbody></table>`;
    } else {
        statsHTML += '<p>Keine Flüge für die ausgewählten Daten gefunden.</p>';
    }

    // Füge die textbasierten Statistiken vor den Diagrammen ein
    // Finden Sie das erste Chart-Container-Element und fügen Sie die Statistiken davor ein.
    // Wenn keine Chart-Container gefunden werden (was nicht passieren sollte, aber als Fallfall), fügen Sie sie ans Ende.
    const firstChartContainer = statisticsBody.querySelector('.chart-container');
    if (firstChartContainer) {
        firstChartContainer.insertAdjacentHTML('beforebegin', statsHTML);
    } else {
        statisticsBody.insertAdjacentHTML('beforeend', statsHTML);
    }

    // --- DIAGRAMME RENDERN ---
    renderTonnagePerMonthChart(tonnagePerMonth);
    renderTonnagePerCustomerChart(tonnagePerCustomer);
}

function renderTonnagePerMonthChart(data) {
    const ctx = document.getElementById('tonnagePerMonthChart');
    if (!ctx) {
        console.error("Canvas element 'tonnagePerMonthChart' not found.");
        return;
    }
    const chartCtx = ctx.getContext('2d');

    // Zerstöre die vorherige Chart-Instanz, falls vorhanden
    if (tonnagePerMonthChartInstance) {
        tonnagePerMonthChartInstance.destroy();
    }

    const labels = Object.keys(data).sort(); // Sortiere nach Monat (YYYY-MM)
    const tonnageValues = labels.map(label => data[label]);

    tonnagePerMonthChartInstance = new Chart(chartCtx, {
        type: 'bar', // Balkendiagramm
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
        options: {
            responsive: true,
            maintainAspectRatio: false, // Wichtig für feste Höhe des Canvas
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
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString('de-DE') + ' kg';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderTonnagePerCustomerChart(data) {
    const ctx = document.getElementById('tonnagePerCustomerChart');
    if (!ctx) {
        console.error("Canvas element 'tonnagePerCustomerChart' not found.");
        return;
    }
    const chartCtx = ctx.getContext('2d');

    // Zerstöre die vorherige Chart-Instanz, falls vorhanden
    if (tonnagePerCustomerChartInstance) {
        tonnagePerCustomerChartInstance.destroy();
    }

    // Sortiere Kunden nach Tonnage (absteigend) und zeige nur die Top X (z.B. Top 10)
    const sortedCustomers = Object.entries(data).sort(([, tonnageA], [, tonnageB]) => tonnageB - tonnageA);
    const topCustomers = sortedCustomers.slice(0, 10); // Zeige nur die Top 10 Kunden

    const labels = topCustomers.map(([customer]) => customer);
    const tonnageValues = topCustomers.map(([, tonnage]) => tonnage);

    // Farben für die Balken generieren
    const backgroundColors = [
        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)', 'rgba(83, 102, 255, 0.6)', 'rgba(40, 159, 64, 0.6)',
        'rgba(210, 50, 50, 0.6)'
    ];
    const borderColors = backgroundColors.map(color => color.replace('0.6', '1')); // Feste Ränder

    tonnagePerCustomerChartInstance = new Chart(chartCtx, {
        type: 'bar', // Balkendiagramm
        data: {
            labels: labels,
            datasets: [{
                label: 'Tonnage (kg)',
                data: tonnageValues,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: borderColors.slice(0, labels.length),
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
                        text: 'Kunde'
                    },
                    // Optional: Labels drehen, wenn sie zu lang sind
                    ticks: {
                        autoSkip: false,
                        maxRotation: 90,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString('de-DE') + ' kg';
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
        // Hier wird der E-Mail-Body basierend auf der Benutzerrolle generiert
        const emailBody = generateEmailBody(currentModalData, currentUser.role);

        const payload = {
            mode: 'sendConfirmationEmail',
            to: recipientEmail,
            from: 'aklassen26@gmail.com', // Feste Absenderadresse
            bcc: 'sales@vgcargo.de, import@vgcargo.de, export@vgcargo.de', // Feste BCC-Adressen
            subject: emailSubject,
            body: emailBody,
            ref: currentModalData.Ref, // Referenz für Audit-Log
            user: currentUser.name // Aktueller Benutzer für Audit-Log
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
            emailConfirmationMessage.textContent = 'Charter Bestätigung erfolgreich gesendet!';
            emailConfirmationMessage.style.color = 'green';
            showSaveFeedback("Charter Bestätigung gesendet!", true);
            // Schließe das Modal nach einer kurzen Verzögerung
            setTimeout(() => {
                closeEmailConfirmationModal();
                closeModal(); // Auch das Detail-Modal schließen
                fetchData(); // Daten neu laden, um History zu aktualisieren
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

// Funktion zum Generieren des E-Mail-Bodys basierend auf Daten und Benutzerrolle
function generateEmailBody(data, userRole) {
    // Start des HTML-E-Mail-Bodys
    let body = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Charter Bestätigung</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 20px;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            h2, h3 {
                color: #0056b3;
                border-bottom: 1px solid #eeeeee;
                padding-bottom: 5px;
                margin-top: 20px;
            }
            p {
                margin-bottom: 10px;
            }
            .detail-item {
                margin-bottom: 5px;
            }
            .detail-label {
                font-weight: bold;
            }
            .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #eeeeee;
                text-align: center;
                font-size: 0.9em;
                color: #777777;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <p>Sehr geehrte/r ${data['Contact Name Invoicing'] || 'Kunde/in'},</p>
            <p>hiermit bestätigen wir Ihre Charteranfrage mit der Referenznummer <strong>${data.Ref || 'N/A'}</strong>.</p>
            <p>Nachfolgend finden Sie die Details Ihrer Anfrage:</p>

            <h2>Kundendetails</h2>
            <div class="detail-item"><span class="detail-label">Rechnungsfirma:</span> ${data['Billing Company'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Rechnungsadresse:</span> ${data['Billing Address'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Steuernummer:</span> ${data['Tax Number'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Kontaktname (Rechnung):</span> ${data['Contact Name Invoicing'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Kontakt E-Mail (Rechnung):</span> ${data['Contact E-Mail Invoicing'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">AGB Akzeptiert:</span> Ja</div>
            <div class="detail-item"><span class="detail-label">Service Beschreibung Akzeptiert:</span> Ja</div>
            <div class="detail-item"><span class="detail-label">Akzeptiert von:</span> ${data['Accepted By Name'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Akzeptanz-Zeitstempel:</span> ${data['Acceptance Timestamp'] || '-'}</div>

            <h2>Flugdetails</h2>
            <div class="detail-item"><span class="detail-label">Airline:</span> ${data.Airline || '-'}</div>
            <div class="detail-item"><span class="detail-label">Flugzeugtyp:</span> ${data['Aircraft Type'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Flugnummer:</span> ${data.Flugnummer || '-'}</div>
            <div class="detail-item"><span class="detail-label">Flugdatum:</span> ${data['Flight Date'] ? new Date(data['Flight Date']).toLocaleDateString('de-DE') : '-'}</div>
            <div class="detail-item"><span class="detail-label">Abflugzeit:</span> ${data['Abflugzeit'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Tonnage:</span> ${data.Tonnage ? parseFloat(String(data.Tonnage).replace(',', '.')).toLocaleString('de-DE') + ' kg' : '-'}</div>
            <div class="detail-item"><span class="detail-label">Vorfeldbegleitung:</span> ${data.Vorfeldbegleitung || '-'}</div>
            <div class="detail-item"><span class="detail-label">Flugtyp Import:</span> ${data['Flight Type Import'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Origin:</span> ${data.Origin || '-'}</div>
            <div class="detail-item"><span class="detail-label">Flugtyp Export:</span> ${data['Flight Type Export'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">Destination:</span> ${data.Destination || '-'}</div>
            <div class="detail-item"><span class="detail-label">E-Mail Anfrage:</span> ${data['Email Request'] || '-'}</div>
    `;

    // Preisdetails nur für Admin-Benutzer
    if (userRole === 'admin') {
        body += `
            <h2>Preisdetails</h2>
            <div class="detail-item"><span class="detail-label">Rate:</span> ${data.Rate ? parseFloat(String(data.Rate).replace(',', '.')).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-'}</div>
            <div class="detail-item"><span class="detail-label">Security Charges:</span> ${data['Security charges'] ? parseFloat(String(data['Security charges']).replace(',', '.')).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-'}</div>
            <div class="detail-item"><span class="detail-label">Dangerous Goods:</span> ${data['Dangerous Goods'] || '-'}</div>
            <div class="detail-item"><span class="detail-label">10ft Consumables:</span> ${data['10ft consumables'] ? parseFloat(String(data['10ft consumables']).replace(',', '.')).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-'}</div>
            <div class="detail-item"><span class="detail-label">20ft Consumables:</span> ${data['20ft consumables'] ? parseFloat(String(data['20ft consumables']).replace(',', '.')).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-'}</div>
            <div class="detail-item"><span class="detail-label">Zusatzkosten:</span> ${data.Zusatzkosten || '-'}</div>
        `;
    }

    body += `
            <div class="footer">
                <p>Mit freundlichen Grüßen,</p>
                <p>Ihr VG Cargo Team</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return body;
}


// --- WICHTIGE KORREKTUR: Funktionen global zugänglich machen ---
// Wenn script.js als type="module" geladen wird, sind Funktionen
// standardmäßig nicht im globalen "window"-Scope verfügbar,
// es sei denn, sie werden explizit exportiert oder zugewiesen.
// Für HTML-onclick-Attribute ist die Zuweisung an "window" erforderlich.
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.logoutUser = logoutUser;
window.fetchData = fetchData;
window.renderTable = renderTable;
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
window.openStatisticsModal = openStatisticsModal; // Mache neue Funktion global zugänglich
window.closeStatisticsModal = closeStatisticsModal; // Mache neue Funktion global zugänglich
window.generateStatistics = generateStatistics; // Mache neue Funktion global zugänglich
window.renderTonnagePerMonthChart = renderTonnagePerMonthChart; // Mache neue Funktion global zugänglich
window.renderTonnagePerCustomerChart = renderTonnagePerCustomerChart; // Mache neue Funktion global zugänglich
window.downloadStatisticsToCSV = downloadStatisticsToCSV; // Mache neue Download-Funktion global zugänglich
window.openEmailConfirmationModal = openEmailConfirmationModal; // NEU: E-Mail Bestätigungsmodal öffnen
window.closeEmailConfirmationModal = closeEmailConfirmationModal; // NEU: E-Mail Bestätigungsmodal schließen
window.toggleOriginDestinationFields = toggleOriginDestinationFields; // NEU: Funktion global zugänglich machen

// Initialisiere Auth-Status, sobald das DOM geladen ist.
// Dies wird nach dem window.onload Event, aber vor dem Polling ausgeführt.
checkAuthStatus();
