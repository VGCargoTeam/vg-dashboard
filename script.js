// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbxlkY1f94D26BKvs7oeiNUhOJHEycsox3J61kb4iN7z_3frXRzfB8sCuCnWQVbFgk88/exec'; // <<< VERIFIZIERE DIESE URL

// !!! WICHTIG: Die users.js-Importzeile wird entfernt, da die Benutzerdaten nun aus Google Sheets kommen. !!!
// import { users } from './users.js'; 

let currentUser = null; // Speichert den aktuell angemeldeten Benutzer
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

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

  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;

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
      messageElem.style.display = 'block'; // Make sure the message is visible
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
    // Remove VAL: prefix and then replace comma with dot for parseFloat
    const ton = parseFloat(String(r.Tonnage).replace('VAL:', '').replace(',', '.') || "0") || 0; 
    
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

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})" class="text-blue-600 hover:text-blue-800 hover:underline font-semibold">${r.Ref}</a></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toString()}</td> <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button> 
        ${deleteButtonHTML}
      </td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  // Tonnage in der Zusammenfassung ohne Tausender-Trennzeichen anzeigen
  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toFixed(0)} kg`; 
  
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
        dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (flightDateFromData instanceof Date) { // Falls es direkt ein Date-Objekt ist
        dateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate());
    } else {
        dateObj = new Date('Invalid Date'); // Ungültiges Datum
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
    'Export': "Nein", // Initialwert für Export
    'Import': "Nein"  // Initialwert für Import
  } : requestData[originalIndex]; 

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = ""; 

  const section = (title, contentHTML) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-section";
    wrap.innerHTML = `<h3>${title}</h3>` + contentHTML;
    return wrap;
  };

  const renderFields = (fields) => {
    // Helper function to format numbers for display
    const formatNumberForDisplay = (num, minFractionDigits = 0, maxFractionDigits = 0) => {
      // Ensure num is a valid number, default to 0 if not
      // NEU: Zuerst das 'VAL:'-Präfix entfernen, wenn vorhanden
      let valueToParse = String(num);
      if (valueToParse.startsWith('VAL:')) {
          valueToParse = valueToParse.substring(4);
      }
      // Dann Komma durch Punkt ersetzen und parsen
      const numericVal = parseFloat(valueToParse.replace(',', '.') || "0") || 0;
      // Dann für die Anzeige im deutschen Format (Komma als Dezimaltrennzeichen) formatieren
      return numericVal.toLocaleString('de-DE', {
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits
      });
    };

    return fields.map(({ label, key, type }) => {
      let value = r[key];
      if (value === undefined || value === null) value = "";
      
      const isAlwaysReadOnlyField = [
          "Ref", "Created At", "Acceptance Timestamp", "Accepted By Name", "Email Request"
      ].includes(key);

      let readOnlyAttr = '';
      let styleAttr = '';

      if (isAlwaysReadOnlyField) {
          readOnlyAttr = 'readonly';
          styleAttr = 'background-color:#eee; cursor: not-allowed;';
      } else if (currentUser && currentUser.role === 'viewer') {
          // Viewer dürfen alles außer den immer schreibgeschützten Feldern bearbeiten
          // Hier können Sie entscheiden, ob Viewer die Eingabefelder sehen, aber nicht bearbeiten dürfen
          // Wenn sie gar nicht angezeigt werden sollen, geschieht das in der Bedingung weiter unten.
          readOnlyAttr = ''; 
          styleAttr = ''; 
      }
      
      // Spezielle Handhabung für Price-related fields, damit sie für Viewer nicht angezeigt werden
      const isPriceRelatedField = [ 
        'Rate', 'Security charges', 'Dangerous Goods', 
        '10ft consumables', '20ft consumables', 'Zusatzkosten' 
      ].includes(key);

      // Überspringe das Rendern dieser Felder für Viewer
      if (isPriceRelatedField && currentUser.role === 'viewer') {
          return ''; // Leerer String, um das Feld zu überspringen
      }


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
            } else if (value instanceof Date) { // Falls Date-Objekt
                timeValue = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            }
        }
        return `<label>${label}:</label><input type="time" name="${key}" value="${timeValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") { 
          // Immer einen grünen Haken anzeigen, da der Kunde die AGB akzeptieren MUSS, um eine Anfrage zu senden.
          const icon = '&#10004;'; // Grüner Haken
          const color = 'green';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if ( (key === "Vorfeldbegleitung" || key === "Export" || key === "Import") && type === "checkbox") { // Hier Export/Import als Checkboxen behandeln
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (key === 'Tonnage') { // Tonnage darf Viewer sehen und bearbeiten
          // Tonnage: keine Dezimalstellen
          return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 0, 0)}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (['Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(key)) {
          // Rate und andere Verbrauchsmaterialien: 2 Dezimalstellen
          return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 2, 2)}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (key === "Dangerous Goods") { // Separate handling for Dangerous Goods
          const options = ["Ja", "Nein"];
          let selectHTML = `<label>${label}:</label><select name="${key}" ${readOnlyAttr} style="${styleAttr}">`;
          options.forEach(option => {
              const selected = (value === option) ? "selected" : "";
              selectHTML += `<option value="${option}" ${selected}>${option}</option>`;
          });
          selectHTML += `</select>`;
          return selectHTML;
      } else if (key === "Zusatzkosten") { // Spezialbehandlung für Zusatzkosten in der Detailansicht
            return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      } else if (key === "Email Request") { // HIER DIE ÄNDERUNG FÜR E-MAIL REQUEST
          return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
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
    { label: "E-Mail Request", key: "Email Request" },
    { label: "Export", key: "Export", type: "checkbox" }, // NEU: Export-Checkbox
    { label: "Import", key: "Import", type: "checkbox" }  // NEU: Import-Checkbox
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

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  
  // Preisdetails nur für Admins anzeigen
  if (currentUser && currentUser.role === 'admin') { 
    // Erstellen des HTML für Preisdetails
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
        let value = r[key] || "";
        if (key === "Zusatzkosten") {
            // Sicherstellen, dass die textarea für Zusatzkosten korrekt gerendert wird
            return `<label>${label}:</label><textarea name="${key}" placeholder="Labeln, Fotos" style="height:80px">${value}</textarea>`;
        } else if (key === "Dangerous Goods") { // Handle Dangerous Goods as a select dropdown
            const options = ["Ja", "Nein"];
            let selectHTML = `<label>${label}:</label><select name="${key}">`;
            options.forEach(option => {
                const selected = (value === option) ? "selected" : "";
                selectHTML += `<option value="${option}" ${selected}>${option}</option>`;
            });
            selectHTML += `</select>`;
            return selectHTML;
        } else {
            // Verwenden Sie formatNumberForDisplay für Rate und andere Verbrauchsmaterialien
            return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 2, 2)}" />`;
        }
    }).join("");
    
    modalBody.appendChild(section("Preisdetails", priceDetailsHTML));
  } else {
    // Wenn nicht Admin, keine Preisdetails anzeigen (der Section selbst wird nicht hinzugefügt)
  }

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
  }
});

async function saveDetails() {
  // Statt alert() eine benutzerdefinierte Bestätigung verwenden
  const isConfirmed = confirm('Sind Sie sicher, dass Sie diese Änderungen speichern möchten?');
  if (!isConfirmed) {
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled]), #modalBody select[name]:not([disabled])"); // Add select to query
  const data = {};
  inputs.forEach(i => {
    if (i.name === "Flight Date") {
        data[i.name] = i.value; 
    } else if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(i.name)) { // Remove Dangerous Goods from this list
        // Tonnage und Preis-Felder: Kommas durch Punkte ersetzen und Euro-Symbol sowie Leerzeichen entfernen
        // Hier wird der Wert für das Senden an die API vorbereitet.
        // `replace(/,/g, '.')` stellt sicher, dass Dezimalpunkte verwendet werden.
        data[i.name] = i.value.replace(/,/g, '.').replace('€', '').trim() || "";
    } else { // Wichtig: Für 'Zusatzkosten', 'Export', 'Import' (textarea/checkbox) kommt der Wert einfach als String.
        if (i.type === "checkbox") {
            data[i.name] = i.checked ? "Ja" : "Nein";
        } else {
            data[i.name] = i.value;
        }
    }
  });

  // Specifically handle Dangerous Goods dropdown, its value is directly its string
  const dangerousGoodsSelect = document.querySelector("#modalBody select[name='Dangerous Goods']");
  if (dangerousGoodsSelect) {
      data['Dangerous Goods'] = dangerousGoodsSelect.value;
  }

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
        let dayHasExport = false; // Flag für Export
        let dayHasImport = false; // Flag für Import

        // Check if current day is today and add 'today' class
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            cellClasses.push('today');
        }

        if (flightsForDay.length > 0) {
          cellClasses.push('has-flights'); 
          
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
              `\nTonnage: ${tonnageValue.toFixed(0)} kg` // Tonnage hier auch ohne Tausender-Trennzeichen
            );
            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true; 
            }
            // Export/Import Flags setzen
            if (f['Export'] && String(f['Export']).toLowerCase() === 'ja') {
                dayHasExport = true;
            }
            if (f['Import'] && String(f['Import']).toLowerCase() === 'ja') {
                dayHasImport = true;
            }
          });
          simpleTitleContent = `Flüge: ${flightsForDay.length}`; 
        }
        
        // Klassen für Kalenderfarben hinzufügen
        if (dayHasExport) {
            cellClasses.push('calendar-export');
        }
        if (dayHasImport) {
            cellClasses.push('calendar-import');
        }

        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;'); 
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        // Added styling for 'today' class here
        const dayNumberClass = cellClasses.includes('today') ? 'font-bold text-lg' : '';

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
  
  // Die fetchData-Polling wird erst gestartet, nachdem der Benutzer authentifiziert wurde (in checkAuthStatus)
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
      
      // Nur für Viewer-Rolle sensible Informationen schwärzen
      if (currentUser && currentUser.role === 'viewer' && typeof detailsContent === 'string') {
        const sensitiveFieldPrefixes = [
          'Rate:', 
          'Security charges:', 
          'Dangerous Goods:', 
          '10ft consumables:', 
          '20ft consumables:',
          'Zusatzkosten:' // Dieses Feld wird nun auch durch die Schleife verarbeitet
        ];
        
        let processedDetailsParts = [];
        // Teilen Sie den Details-String in einzelne Änderungen auf (basierend auf Semikolon als Trennzeichen)
        const detailParts = detailsContent.split(';').map(part => part.trim()).filter(part => part !== '');

        detailParts.forEach(part => {
            let redactedPart = part;
            for (const prefix of sensitiveFieldPrefixes) {
                if (part.startsWith(prefix)) {
                    // NEU: Präfix 'VAL:' entfernen, bevor es geschwärzt wird (falls im Audit-Log noch vorhanden)
                    let displayValue = part.substring(prefix.length).trim();
                    if (displayValue.startsWith('VAL:')) {
                        displayValue = displayValue.substring(4);
                    }
                    redactedPart = `${prefix} [GESCHWÄRZT]`;
                    break; // Präfix gefunden und geschwärzt, gehe zum nächsten Teil
                }
            }
            processedDetailsParts.push(redactedPart);
        });
        // Füge die verarbeiteten Teile wieder zusammen
        detailsContent = processedDetailsParts.join('; ');
      }
      
      try {
          // Versuchen, gelöschte Daten zu parsen, wenn es ein JSON-String ist
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              // NEU: Im gelöschten JSON-Detail ebenfalls VAL: entfernen
              const cleanedParsedDetails = {};
              for (const key in parsedDetails) {
                  let val = parsedDetails[key];
                  if (typeof val === 'string' && val.startsWith('VAL:')) {
                      val = val.substring(4);
                  }
                  cleanedParsedDetails[key] = val;
              }
              detailsContent = 'Gelöschte Daten: <pre>' + JSON.stringify(cleanedParsedDetails, null, 2) + '</pre>';
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

// Initialisiere Auth-Status, sobald das DOM geladen ist.
// Dies wird nach dem window.onload Event, aber vor dem Polling ausgeführt.
checkAuthStatus();
