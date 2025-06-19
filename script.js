// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbxlkY1f94D26BKvs7oeiNUhOJHEycsox3J61kb4iN7z_3frXRzfB8sCuCnWQVbFgk88/exec'; // <<< VERIFIZIERE DIESE URL

// Importiere das Benutzerobjekt aus users.js
import { users } from './users.js';

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
    // Überprüfe, ob der gespeicherte Benutzer noch im 'users'-Objekt existiert
    if (!users[currentUser.username]) {
        console.warn("Stored user not found in USERS data. Logging out.");
        logoutUser(); // Logout, wenn Benutzer nicht mehr existiert
        return;
    }
    // Aktualisiere currentUser mit den neuesten Daten aus dem users-Objekt (für den Fall, dass Rollen oder Namen sich ändern)
    currentUser.name = users[currentUser.username].name;
    currentUser.role = users[currentUser.username].role;

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
    console.warn("Profile Modal (id='profileModal') not found.");
  }
}

function closeProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.style.display = 'none'; // Modal schließen
  }
}

function changePassword() {
  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;
  const messageElem = document.getElementById('passwordChangeMessage');

  if (!messageElem) {
    console.error("Password change message element not found.");
    return;
  }

  if (newPass === '' || confirmPass === '') {
    messageElem.textContent = 'Bitte beide Passwortfelder ausfüllen.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'Passwörter stimmen nicht überein.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) { // Beispiel: Mindestlänge
      messageElem.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.';
      messageElem.style.color = 'red';
      return;
  }

  // Hier wird das Passwort im importierten 'users'-Objekt (im Speicher) geändert
  // und auch im localStorage.
  // BEACHTE: Bei einem Neuladen der Seite würde das Hardcoded-Passwort in users.js
  // wieder aktiv werden, es sei denn, users.js wird auch dynamisch aktualisiert
  // (was bei einer lokalen Datei nicht der Fall ist). Für Persistenz wäre ein Backend nötig.
  if (currentUser && users[currentUser.username]) {
    users[currentUser.username].password = newPass; // Update in hardcoded object (for demo)
    currentUser.password = newPass; // Update current session user
    localStorage.setItem('currentUser', JSON.stringify(currentUser)); // Update localStorage
    messageElem.textContent = 'Passwort erfolgreich geändert!';
    messageElem.style.color = 'green';
    // Leere die Felder nach erfolgreicher Änderung
    const newPassInput = document.getElementById('newPasswordInput');
    const confirmPassInput = document.getElementById('confirmPasswordInput');
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
  } else {
    messageElem.textContent = 'Fehler beim Ändern des Passworts. Benutzer nicht gefunden.';
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

    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            const dateObj = new Date(displayFlightDate);
            if (!isNaN(dateObj.getTime())) { 
                displayFlightDate = dateObj.toLocaleDateString('de-DE'); 
            }
        } catch (e) {
        }
    }

    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
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

    let flightDateFromData = r['Flight Date'] || '';
    if (typeof flightDateFromData === 'string' && flightDateFromData.includes('T')) {
        flightDateFromData = flightDateFromData.split('T')[0]; 
    } else if (flightDateFromData instanceof Date) { 
        flightDateFromData = flightDateFromData.toISOString().split('T')[0];
    }

    if (flightDateFromData) {
      const flightDateObj = new Date(flightDateFromData);
      flightDateObj.setHours(0, 0, 0, 0); 

      if (flightDateObj < today) {
          isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
          const abflugzeit = r['Abflugzeit']; 
          if (abflugzeit) {
              const [hours, minutes] = abflugzeit.split(':').map(Number);
              const flightTime = new Date(); 
              flightTime.setHours(hours, minutes, 0, 0);

              const now = new Date(); 
              now.setSeconds(0, 0); 
              now.setMilliseconds(0); 

              if (flightTime <= now) { 
                  isPastOrTodayAndGoneFlight = true;
              }
          }
      }

      if (fromDateInput && flightDateFromData < fromDateInput) matchesDateRange = false;
      if (toDateInput && flightDateFromData > toDateInput) matchesDateRange = false;
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
    'Vorfeldbegleitung': "Nein",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein", // Standardwert "Nein"
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Nein", // Standardwert "Nein"
    'Service Description Accepted': "Nein", // Standardwert "Nein"
    'Accepted By Name': "", 
    'Acceptance Timestamp': "" 
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
    return fields.map(({ label, key, type }) => {
      let value = r[key];
      if (value === undefined || value === null) value = "";
      
      const isPriceRelatedFieldOrFlightNumber = [ 
        'Rate', 'Security charges', 'Dangerous Goods', 
        '10ft consumables', '20ft consumables', 'Zusatzkosten', 'Email Request', 'Flugnummer' 
      ].includes(key);

      const isAlwaysReadOnlyField = [
          "Ref", "Created At", "Acceptance Timestamp", "Accepted By Name" 
      ].includes(key);

      let readOnlyAttr = '';
      if (isAlwaysReadOnlyField) {
          readOnlyAttr = 'readonly style="background-color:#eee; cursor: not-allowed;"';
      } else if (isPriceRelatedFieldOrFlightNumber) { 
          if (!currentUser || currentUser.role === 'viewer') {
              readOnlyAttr = 'readonly style="background-color:#eee; cursor: not-allowed;"';
          }
      }


      if (key === "Flight Date") {
        if (String(value).includes('T')) {
            value = String(value).split('T')[0];
        } else if (value instanceof Date) { 
            value = value.toISOString().split('T')[0];
        } else if (!String(value).match(/^\d{4}-\d{2}-\d{2}$/)) {
            try {
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                    value = parsedDate.toISOString().split('T')[0];
                } else {
                    value = "";
                }
            } catch (e) {
                value = "";
            }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${value}" ${readOnlyAttr}>`;
      } else if (key === "Abflugzeit") {
        if (value instanceof Date) { 
            value = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (String(value).includes('T')) {
            const dateObj = new Date(value);
            value = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (!(String(value).length === 5 && String(value).includes(':'))) {
            value = ""; 
        }
        return `<label>${label}</label><input type="time" name="${key}" value="${value}" ${readOnlyAttr}>`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") { 
          const isAccepted = String(value).toLowerCase() === "ja";
          const icon = isAccepted ? '&#10004;' : '&#10008;'; 
          const color = isAccepted ? 'green' : 'red';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if (key === "Vorfeldbegleitung" && type === "checkbox") { 
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr}> ${label}</label>`;
      } else if (['Tonnage', 'Rate', 'Security charges', 'Dangerous Goods', '10ft consumables', '20ft consumables'].includes(key)) {
          const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
          return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" ${readOnlyAttr} />`;
      } else if (key === "Created At" || key === "Acceptance Timestamp") { 
            return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} />`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} />`;
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
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" }
  ];

  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" }
  ];

  const priceExtra = `
    <label>Zusatzkosten:</label>
    <textarea name="Zusatzkosten" placeholder="Labeln, Fotos" style="height:80px" ${(currentUser && currentUser.role === 'viewer') ? 'readonly style="background-color:#eee; cursor: not-allowed;"' : ''}>${r["Zusatzkosten"] || ""}</textarea>
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px" ${(currentUser && currentUser.role === 'viewer') ? 'readonly style="background-color:#eee; cursor: not-allowed;"' : ''}>${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  
  if (currentUser && currentUser.role === 'admin') { 
    modalBody.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));
  } else {
    modalBody.appendChild(section("Preisdetails", "<p>Keine Berechtigung zur Ansicht dieser Details.</p>"));
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center"; 
  buttonContainer.style.gap = "10px"; 
  buttonContainer.style.marginTop = "20px";

  if (currentUser && currentUser.role === 'admin') {
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
  if (!confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
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
  const confirmSave = confirm('Sind Sie sicher, dass Sie diese Änderungen speichern möchten?');
  if (!confirmSave) {
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => {
    if (i.name === "Flight Date") {
        data[i.name] = i.value; 
    } else if (['Tonnage', 'Rate', 'Security charges', 'Dangerous Goods', '10ft consumables', '20ft consumables'].includes(i.name)) {
        data[i.name] = i.value.replace(/,/g, '.') || "";
    } else {
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

  if (!confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
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
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date'] || '';
    if (typeof flightDateFromData === 'string' && flightDateFromData.includes('T')) {
        flightDateFromData = flightDateFromData.split('T')[0];
    } else if (flightDateFromData instanceof Date) { 
        flightDateFromData = flightDateFromData.toISOString().split('T')[0];
    }
    return flightDateFromData === dateStr;
  });

  if (flightsOnThisDay.length > 0) {
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.indexOf(firstFlight);
    if (originalIndex !== -1) {
      openModal(originalIndex);
    } else {
      console.warn("Konnte den Originalindex des Fluges nicht finden:", firstFlight);
      openModal(requestData.indexOf(firstFlight)); 
    }
  }
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' }); 
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;

  const flightsByDay = new Map(); 
  requestData.forEach((r) => {
    let flightDate = r['Flight Date']; 
    if (typeof flightDate === 'string') {
        const parsedDate = new Date(flightDate); 
        if (!isNaN(parsedDate.getTime())) {
            flightDate = parsedDate;
        } else {
            flightDate = null; 
        }
    }

    if (flightDate && flightDate.getFullYear() === year && flightDate.getMonth() === month) { 
        const fDay = flightDate.getDate();
        if (!flightsByDay.has(fDay)) { 
          flightsByDay.set(fDay, []); 
        }
        flightsByDay.get(fDay).push(r); 
    }
  });

  for (let i = 0; i < 6; i++) { 
    html += "<tr>";
    for (let j = 0; j < 7; j++) { 
      if ((i === 0 && j < firstDayOfMonthWeekday) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const flightsForDay = flightsByDay.get(day) || []; 
        let cellClasses = ['calendar-day'];
        let tooltipContentArray = []; 
        let simpleTitleContent = ''; 
        let dayHasVorfeldbegleitung = false; 

        const currentCalendarDay = new Date(year, month, day);
        currentCalendarDay.setHours(0,0,0,0);
        if (currentCalendarDay.getTime() === today.getTime()) {
            cellClasses.push('today');
        }

        if (flightsForDay.length > 0) {
          cellClasses.push('has-flights'); 
          
          flightsForDay.forEach(f => {
            const tonnageValue = parseFloat(String(f.Tonnage).replace(',', '.') || "0") || 0;
            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlugnummer: ${f.Flugnummer || '-'}` + 
              `\nAbflugzeit: ${f['Abflugzeit'] || '-'}` +
              `\nTonnage: ${tonnageValue.toLocaleString('de-DE')} kg` 
            );
            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true; 
            }
          });
          simpleTitleContent = `Flüge: ${flightsForDay.length}`; 
        }

        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;'); 
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        html += `<td class='${cellClasses.join(' ')}' title='${simpleTitleContent}' data-tooltip='${dataTooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})">${day}${flightIcon}</td>`;
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
  historyBody.innerHTML = '<p style="text-align: center;">Loading history...</p>';
  historyModal.style.display = "flex";

  try {
    const response = await fetch(API_URL + "?mode=readAuditLog");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const auditResult = await response.json(); 

    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p style="text-align: center;">No history found for this reference.</p>';
      return;
    }

    let historyHTML = '<ul style="list-style-type: none; padding: 0;">';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      let detailsContent = log.Details || '-';
      
      if (currentUser && currentUser.role === 'viewer' && log.Action === 'update' && typeof detailsContent === 'string') {
        const sensitiveFields = [
          'Rate:', 'Security charges:', 'Dangerous Goods:', 
          '10ft consumables:', '20ft consumables:', 'Zusatzkosten:'
        ];
        
        let filteredDetails = detailsContent;
        sensitiveFields.forEach(field => {
          const regex = new RegExp(`(${field}[^;]*)`, 'g'); 
          filteredDetails = filteredDetails.replace(regex, `${field} [REDACTED]`); // Redact sensitive info for viewers
        });
        detailsContent = filteredDetails;
      }
      
      try {
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              detailsContent = 'Deleted data: <pre>' + JSON.stringify(parsedDetails, null, 2) + '</pre>';
          }
      } catch (e) {
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
    console.error("Error fetching audit log:", error);
    historyBody.innerHTML = '<p style="color: red; text-align: center;">Error loading history: ' + error.message + '</p>';
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
