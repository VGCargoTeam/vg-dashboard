// Charter Dashboard Script – Vollständige Version mit neuen Features
const API_URL = 'https://script.google.com/macros/s/AKfycbzo-FgxA6TMJYK4xwLbrsRnNTAU_AN-FEJJoZH6w7aJ3BlcsaB751LjdUJ9nieGtu1P/exec';

let currentUser = null; // Speichert den aktuell angemeldeten Benutzer
let requestData = []; // Speichert alle abgerufenen Charterdaten
let customerData = []; // NEU: Speichert Kundendaten für die Datenbankfunktion
let allUsers = []; // NEU: Speichert alle Benutzer für die Verwaltung
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

// Globale Variablen für Chart-Instanzen
let tonnagePerMonthChartInstance = null;
let tonnagePerCustomerChartInstance = null;

// Variable zum Speichern der aktuell im Modal angezeigten Daten
let currentModalData = null;

// NEU: Variablen für die Tabellensortierung
let currentSort = {
    column: 'Flight Date',
    direction: 'desc'
};

// === AUTHENTIFIZIERUNG UND BENUTZERVERWALTUNG ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    updateUIBasedOnUserRole();
    fetchData(); // Daten laden, wenn angemeldet
  } else {
    window.location.href = 'login.html';
  }
}

function updateUIBasedOnUserRole() {
  const adminElements = document.querySelectorAll(".admin-only");
  const editorElements = document.querySelectorAll(".editor-only"); // NEU: Für Editoren
  const loggedInUsernameSpan = document.getElementById('loggedInUsername');
  const loggedInUserRoleSpan = document.getElementById('loggedInUserRole');

  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;

    // Admin sieht alles
    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = ""); 
      editorElements.forEach(el => el.style.display = "");
    } 
    // NEU: Editor-Rolle
    else if (currentUser.role === 'editor') {
      adminElements.forEach(el => el.style.display = "none");
      editorElements.forEach(el => el.style.display = "");
    }
    // Viewer sieht am wenigsten
    else {
      adminElements.forEach(el => el.style.display = "none");
      editorElements.forEach(el => el.style.display = "none");
    }
  } else {
    // Fallback, falls kein Benutzer
    adminElements.forEach(el => el.style.display = "none");
    editorElements.forEach(el => el.style.display = "none");
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'N/A';
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = 'N/A';
  }
}

function openProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.style.display = 'flex';
    document.getElementById('newPasswordInput').value = '';
    document.getElementById('confirmPasswordInput').value = '';
    document.getElementById('passwordChangeMessage').textContent = '';
  }
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
}

async function changePassword() {
  const oldPass = prompt("Please enter your current password to confirm the change:");
  if (oldPass === null) return;

  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;
  const messageElem = document.getElementById('passwordChangeMessage');

  if (!newPass || !confirmPass) {
    messageElem.textContent = 'Bitte beide Passwortfelder ausfüllen.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'Neue Passwörter stimmen nicht überein.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) {
      messageElem.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.';
      messageElem.style.color = 'red';
      return;
  }

  const payload = {
      mode: 'updatePassword',
      username: currentUser.username,
      oldPassword: oldPass,
      newPassword: newPass,
      user: currentUser.name
  };

  try {
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload)
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
          messageElem.textContent = 'Passwort erfolgreich geändert! Bitte melden Sie sich neu an.';
          messageElem.style.color = 'green';
          setTimeout(logoutUser, 2000);
      } else {
          messageElem.textContent = result.message || 'Fehler beim Ändern des Passworts.';
          messageElem.style.color = 'red';
      }
  } catch (error) {
      console.error('Passwortänderungsfehler:', error);
      messageElem.textContent = 'Ein Netzwerkfehler ist aufgetreten.';
      messageElem.style.color = 'red';
  }
}

function logoutUser() {
  localStorage.removeItem('currentUser');
  currentUser = null;
  window.location.href = 'login.html';
}

// === DATENABRUF UND TABELLEN-RENDERUNG ===
function fetchData() {
  showSaveFeedback("Lade Daten...", true);
  // NEU: Lade Kunden- und Charterdaten parallel
  Promise.all([
    fetch(API_URL + "?mode=read").then(r => r.json()),
    fetch(API_URL + "?mode=readCustomers").then(r => r.json())
  ]).then(([charterResult, customerResult]) => {
    if (charterResult.status === 'success') {
      requestData = charterResult.data;
    } else {
      throw new Error(charterResult.message || "Fehler beim Laden der Charterdaten.");
    }

    if (customerResult.status === 'success') {
      customerData = customerResult.data;
    } else {
      console.warn(customerResult.message || "Fehler beim Laden der Kundendaten.");
    }
    
    filterTable(); // Ruft filterTable auf, um Tabellen und Kalender zu aktualisieren
    showSaveFeedback("Daten geladen!", true);
  }).catch(error => {
    console.error("Fehler beim Laden der Daten:", error);
    showSaveFeedback("Fehler beim Laden der Daten!", false);
  });
}

// NEU: Funktion zum Sortieren der Tabellen
function sortTable(column, headerElement) {
    const isAsc = currentSort.column === column && currentSort.direction === 'asc';
    currentSort.direction = isAsc ? 'desc' : 'asc';
    currentSort.column = column;

    // Update header styles
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });
    headerElement.classList.add(isAsc ? 'sorted-desc' : 'sorted-asc');

    filterTable(); // Filter und Sortierung neu anwenden
}

function renderRequestTables(dataToRender = requestData) {
    const unconfirmedTbody = document.querySelector("#unconfirmedTable tbody");
    const confirmedTbody = document.querySelector("#confirmedTable tbody");

    if (!unconfirmedTbody || !confirmedTbody) {
        console.error("Tabellen für Anfragen nicht gefunden.");
        return;
    }

    unconfirmedTbody.innerHTML = "";
    confirmedTbody.innerHTML = "";

    let unconfirmedFlights = 0, unconfirmedWeight = 0;
    let confirmedFlights = 0, confirmedWeight = 0;

    const createRowHTML = (r) => {
        const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0;
        const originalIndex = requestData.findIndex(item => item.Ref === r.Ref);
        let displayFlightDate = r['Flight Date'] ? new Date(r['Flight Date']).toLocaleDateString('de-DE') : "-";
        
        // Admins und Editoren können löschen
        const deleteButtonHTML = (currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor')) ? `<button class="btn btn-delete" onclick="deleteRow(this)">Delete</button>` : '';
        const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';
        const confirmationIcon = isConfirmed ? '<span class="text-green-500 ml-1">&#10004;</span>' : '';

        const row = document.createElement("tr");
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
        return { row, ton };
    };

    dataToRender.forEach(r => {
        const { row, ton } = createRowHTML(r);
        const isConfirmed = String(r['Final Confirmation Sent'] || '').toLowerCase() === 'ja';

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

    document.getElementById("unconfirmedSummaryInfo").textContent = `Total Flights: ${unconfirmedFlights} | Total Tonnage: ${unconfirmedWeight.toLocaleString('de-DE')} kg`;
    document.getElementById("confirmedSummaryInfo").textContent = `Total Flights: ${confirmedFlights} | Total Tonnage: ${confirmedWeight.toLocaleString('de-DE')} kg`;

    updateUIBasedOnUserRole();
}

function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearch = document.getElementById("flightNumberSearch").value.toLowerCase();
  const fromDateInput = document.getElementById("fromDate").value;
  const toDateInput = document.getElementById("toDate").value;
  const showArchive = document.getElementById("archiveCheckbox").checked;

  let filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch);

    let matchesDateRange = true;
    let isPastFlight = false;
    let flightDateObj = r['Flight Date'] ? new Date(r['Flight Date']) : null;

    if (flightDateObj && !isNaN(flightDateObj.getTime())) {
      flightDateObj.setHours(0, 0, 0, 0);
      if (flightDateObj < today) isPastFlight = true;
      if (fromDateInput) {
          const fromDateObj = new Date(fromDateInput);
          fromDateObj.setHours(0,0,0,0);
          if (flightDateObj < fromDateObj) matchesDateRange = false;
      }
      if (toDateInput) {
          const toDateObj = new Date(toDateInput);
          toDateObj.setHours(0,0,0,0);
          if (flightDateObj > toDateObj) matchesDateRange = false;
      }
    }
    const passesPastFlightFilter = showArchive || !isPastFlight;
    return matchesRef && matchesAirline && matchesFlightNumber && matchesDateRange && passesPastFlightFilter;
  });

  // NEU: Sortierung anwenden
  filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      // Handle different data types
      if (currentSort.column === 'Tonnage') {
          valA = parseFloat(String(valA).replace(',', '.') || '0');
          valB = parseFloat(String(valB).replace(',', '.') || '0');
      } else if (currentSort.column === 'Flight Date') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
      } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
  });

  renderRequestTables(filtered);
  renderCalendars();
}

// === MODAL FUNKTIONEN ===
function openModal(originalIndex) {
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
    'Zusatzkosten': "", 'Email Request': "", 'Internal Notes': "", // NEU
    'AGB Accepted': "Ja", 'Service Description Accepted': "Ja",
    'Accepted By Name': "", 'Acceptance Timestamp': "",
    'Final Confirmation Sent': "Nein", 'Flight Type Import': "Nein",
    'Flight Type Export': "Nein", 'Origin': '', 'Destination': ''
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

  // NEU: Kunden-Dropdown für neue Anfragen
  let customerSectionHTML = '';
  if (isNewRequest) {
      customerSectionHTML += `<label>Bestehenden Kunden auswählen:</label>
          <select id="customerSelect" onchange="populateCustomerDetails(this.value)">
              <option value="">-- Neuen Kunden anlegen --</option>
              ${customerData.map(c => `<option value="${c['Billing Company']}">${c['Billing Company']}</option>`).join('')}
          </select>`;
  }

  const renderFields = (fields) => {
    return fields.map(({ label, key, type, role }) => {
      // Rollenbasierte Anzeige
      if (role === 'admin' && currentUser.role !== 'admin') return '';
      if (role === 'editor' && !['admin', 'editor'].includes(currentUser.role)) return '';

      let value = r[key] || "";
      const isReadOnly = ['Ref', 'Created At', 'Acceptance Timestamp', 'Accepted By Name', 'Final Confirmation Sent'].includes(key) || 
                         (currentUser.role === 'viewer'); // Viewer kann nichts bearbeiten
      const isPriceField = ['Rate', 'Security charges', '10ft consumables', '20ft consumables', 'Zusatzkosten', 'Dangerous Goods'].includes(key);
      
      // Editor darf keine Preisdetails sehen/bearbeiten
      if (isPriceField && currentUser.role === 'editor') return '';

      const readOnlyAttr = isReadOnly ? 'readonly' : '';
      const styleAttr = isReadOnly ? 'background-color:#eee; cursor: not-allowed;' : '';

      if (type === 'textarea') {
          return `<label>${label}:</label><textarea name="${key}" rows="4" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      }
      if (type === 'date') {
          let dateValue = "";
          if (value) {
              try {
                  dateValue = new Date(value).toISOString().split('T')[0];
              } catch (e) { console.error("Invalid date for input:", value); }
          }
          return `<label>${label}</label><input type="date" name="${key}" value="${dateValue}" ${readOnlyAttr} style="${styleAttr}">`;
      }
      if (type === 'time') {
          return `<label>${label}:</label><input type="time" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}">`;
      }
      
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}" />`;
    }).join("");
  };

  const customerFields = [
    { label: "Ref", key: "Ref" },
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" },
    { label: "Final Confirmation Sent", key: "Final Confirmation Sent" }
  ];
  const flightFields = [
    { label: "Airline", key: "Airline" },
    { label: "Aircraft Type", key: "Aircraft Type" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Flight Date", key: "Flight Date", type: "date" },
    { label: "Abflugzeit", key: "Abflugzeit", type: "time" },
    { label: "Tonnage", key: "Tonnage" }
  ];
  const priceFields = [
    { label: "Rate", key: "Rate", role: 'admin' },
    { label: "Security charges", key: "Security charges", role: 'admin' },
    { label: "Dangerous Goods", key: "Dangerous Goods", role: 'admin' },
    { label: "10ft consumables", key: "10ft consumables", role: 'admin' },
    { label: "20ft consumables", key: "20ft consumables", role: 'admin' },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea", role: 'admin' }
  ];
  const notesFields = [
      { label: "Interne Notizen", key: "Internal Notes", type: "textarea", role: 'editor' }
  ];

  modalBody.appendChild(section("Kundendetails", customerSectionHTML + renderFields(customerFields), 'bg-blue-50'));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields), 'bg-green-50'));
  if (currentUser.role === 'admin') {
      modalBody.appendChild(section("Preisdetails", renderFields(priceFields), 'bg-yellow-50'));
  }
  if (['admin', 'editor'].includes(currentUser.role)) {
      modalBody.appendChild(section("Interne Notizen", renderFields(notesFields), 'bg-gray-50'));
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "w-full flex justify-center gap-4 mt-5";

  // Nur Admins und Editoren können speichern
  if (['admin', 'editor'].includes(currentUser.role)) {
    buttonContainer.innerHTML += `<button class="btn bg-green-500 text-white" onclick="saveDetails()">Speichern</button>`;
  }
  buttonContainer.innerHTML += `<button class="btn bg-blue-500 text-white" onclick="showHistory(currentModalData.Ref)">History</button>`;
  if (!isNewRequest) {
      buttonContainer.innerHTML += `<button class="btn bg-indigo-500 text-white" onclick="openEmailConfirmationModal(currentModalData)">Final Charter Confirmation senden</button>`;
  }
  // Nur Admins können löschen
  if (currentUser.role === 'admin' && !isNewRequest) {
    buttonContainer.innerHTML += `<button class="btn btn-delete" onclick="deleteRowFromModal(currentModalData.Ref)">Eintrag löschen</button>`;
  }
  modalBody.appendChild(buttonContainer);
  modal.style.display = "flex";
}

// NEU: Funktion zum Befüllen der Kundendetails
function populateCustomerDetails(companyName) {
    if (!companyName) {
        // Reset fields if "Neuen Kunden anlegen" is selected
        document.querySelector('[name="Billing Company"]').value = '';
        document.querySelector('[name="Billing Address"]').value = '';
        document.querySelector('[name="Tax Number"]').value = '';
        document.querySelector('[name="Contact Name Invoicing"]').value = '';
        document.querySelector('[name="Contact E-Mail Invoicing"]').value = '';
        return;
    }
    const customer = customerData.find(c => c['Billing Company'] === companyName);
    if (customer) {
        document.querySelector('[name="Billing Company"]').value = customer['Billing Company'] || '';
        document.querySelector('[name="Billing Address"]').value = customer['Billing Address'] || '';
        document.querySelector('[name="Tax Number"]').value = customer['Tax Number'] || '';
        document.querySelector('[name="Contact Name Invoicing"]').value = customer['Contact Name Invoicing'] || '';
        document.querySelector('[name="Contact E-Mail Invoicing"]').value = customer['Contact E-Mail Invoicing'] || '';
    }
}

async function saveDetails() {
  const isConfirmed = confirm('Sind Sie sicher, dass Sie diese Änderungen speichern möchten?');
  if (!isConfirmed) return;

  const inputs = document.querySelectorAll("#modalBody input, #modalBody textarea, #modalBody select");
  const data = {};
  inputs.forEach(i => {
    if (i.name) {
        if (i.type === "checkbox") {
            data[i.name] = i.checked ? "Ja" : "Nein";
        } else {
            data[i.name] = i.value;
        }
    }
  });

  data.Ref = currentModalData.Ref; // Ref immer mitsenden
  data.mode = "write";
  data.user = currentUser.name;
  data.role = currentUser.role; // Rolle für Berechtigungsprüfung im Backend

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });
    const responseData = await response.json();
    if (responseData.status === "success") {
      showSaveFeedback("Gespeichert!", true);
      closeModal();
      fetchData(); // Daten neu laden, um Änderungen und ggf. neue Kunden zu sehen
    } else {
      showSaveFeedback(`Fehler: ${responseData.message || 'Unbekannter Fehler'}`, false);
    }
  } catch (err) {
    showSaveFeedback("Netzwerkfehler beim Speichern!", false);
    console.error(err);
  }
}

async function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;
  const isConfirmed = confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen?`);
  if (!isConfirmed) return;

  const data = { Ref: ref, mode: "delete", user: currentUser.name, role: currentUser.role };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });
    const responseData = await response.json();
    if (responseData.status === "success") {
      showSaveFeedback("Eintrag gelöscht!", true);
      fetchData();
    } else {
      showSaveFeedback(`Fehler: ${responseData.message}`, false);
    }
  } catch (err) {
    showSaveFeedback("Netzwerkfehler beim Löschen!", false);
  }
}

async function deleteRowFromModal(ref) {
    deleteRow({ closest: () => ({ querySelector: () => ({ textContent: ref }) }) });
    closeModal();
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
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
  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const flightsOnThisDay = requestData.filter(r => r['Flight Date'] === clickedDateStr);

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
    if (r['Flight Date']) {
        const flightDate = new Date(r['Flight Date']);
        if (flightDate.getFullYear() === year && flightDate.getMonth() === month) {
            const fDay = flightDate.getDate();
            if (!flightsByDay.has(fDay)) flightsByDay.set(fDay, []);
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
        const flightsForDay = flightsByDay.get(day) || [];
        let cellClasses = ['calendar-day'];
        let tooltipContent = flightsForDay.map(f => `Ref: ${f.Ref}\nAirline: ${f.Airline}`).join('\n\n');
        
        let hasImport = flightsForDay.some(f => String(f['Flight Type Import']).toLowerCase() === 'ja');
        let hasExport = flightsForDay.some(f => String(f['Flight Type Export']).toLowerCase() === 'ja');

        if (hasImport && hasExport) cellClasses.push('import-export');
        else if (hasImport) cellClasses.push('import-only');
        else if (hasExport) cellClasses.push('export-only');
        else if (flightsForDay.length > 0) cellClasses.push('has-flights');

        let dayNumberClass = currentCalendarDayForCell.getTime() === todayCal.getTime() ? 'font-bold text-lg today-red-text' : 'font-bold text-lg';
        
        html += `<td class='${cellClasses.join(' ')}' data-tooltip='${tooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})"><div class="${dayNumberClass}">${day}</div></td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

function updateClock() {
  const now = new Date();
  document.getElementById('currentDate').textContent = "Date: " + now.toLocaleDateString('de-DE');
  document.getElementById('clock').textContent = "Time: " + now.toLocaleTimeString('de-DE');
}

function generateReference() {
  const now = new Date();
  const timestamp = now.toLocaleDateString('de-DE').replace(/\./g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  openModal(-1);
}

function showSaveFeedback(message, success) {
  const feedback = document.createElement("div");
  feedback.textContent = message;
  feedback.className = `fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 ${success ? 'bg-green-500' : 'bg-red-500'}`;
  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 3000);
}

async function showHistory(ref) {
  const historyModal = document.getElementById("historyModal");
  const historyBody = document.getElementById("historyBody");
  document.getElementById("historyRef").textContent = ref;
  historyBody.innerHTML = '<p>Lade Verlauf...</p>';
  historyModal.style.display = "flex";

  try {
    const response = await fetch(API_URL + "?mode=readAuditLog");
    const auditResult = await response.json();
    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p>Kein Verlauf gefunden.</p>';
      return;
    }

    let historyHTML = '<ul>';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      historyHTML += `<li><strong>${new Date(log.Timestamp).toLocaleString('de-DE')} - ${log.User} - ${log.Action}</strong><br>${log.Details}</li>`;
    });
    historyHTML += '</ul>';
    historyBody.innerHTML = historyHTML;
  } catch (error) {
    historyBody.innerHTML = '<p class="text-red-500">Fehler beim Laden des Verlaufs.</p>';
  }
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

function openStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'flex';
    generateStatistics();
}
function closeStatisticsModal() {
    document.getElementById('statisticsModal').style.display = 'none';
}
function generateStatistics() { /* ... Implementierung ... */ }
function downloadStatisticsToCSV() { /* ... Implementierung ... */ }


function openEmailConfirmationModal(data) {
    currentModalData = data;
    document.getElementById('emailConfirmationModal').style.display = 'flex';
    document.getElementById('recipientEmailInput').value = data['Contact E-Mail Invoicing'] || '';
}
function closeEmailConfirmationModal() {
    document.getElementById('emailConfirmationModal').style.display = 'none';
}
async function generateEmailPreview() { /* ... Implementierung ... */ }
function closeEmailPreviewModal() {
    document.getElementById('emailPreviewModal').style.display = 'none';
}
async function markAsSentManually() {
    if (!currentModalData || !currentModalData.Ref) return;
    const isConfirmed = confirm(`Manuell als gesendet markieren?`);
    if (!isConfirmed) return;

    const payload = {
        mode: 'markAsSent',
        ref: currentModalData.Ref,
        user: currentUser.name,
        sendEmail: 'false'
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback("Als gesendet markiert!", true);
            closeEmailPreviewModal();
            closeModal();
            fetchData();
        } else {
            showSaveFeedback(`Fehler: ${result.message}`, false);
        }
    } catch (err) {
        showSaveFeedback("Netzwerkfehler.", false);
    }
}

// === BENUTZERVERWALTUNG (NEU) ===
function openUserAdminModal() {
    const modal = document.getElementById('userAdminModal');
    const body = document.getElementById('userAdminBody');
    body.innerHTML = '<p>Lade Benutzer...</p>';
    document.getElementById('userFormContainer').innerHTML = ''; // Formular leeren
    modal.style.display = 'flex';

    fetch(API_URL + "?mode=readUsers")
        .then(res => res.json())
        .then(result => {
            if (result.status === 'success') {
                allUsers = result.data;
                renderUserTable();
            } else {
                body.innerHTML = `<p class="text-red-500">${result.message}</p>`;
            }
        }).catch(err => {
            body.innerHTML = `<p class="text-red-500">Fehler beim Laden der Benutzer.</p>`;
            console.error(err);
        });
}

function closeUserAdminModal() {
    document.getElementById('userAdminModal').style.display = 'none';
}

function renderUserTable() {
    const body = document.getElementById('userAdminBody');
    let tableHTML = `<button class="btn bg-green-500 text-white mb-4" onclick="showAddUserForm()">Neuen Benutzer anlegen</button>
                     <table class="w-full">
                         <thead><tr><th>Username</th><th>Name</th><th>Rolle</th><th>Aktionen</th></tr></thead>
                         <tbody>`;
    allUsers.forEach(user => {
        tableHTML += `<tr>
                        <td>${user.username}</td>
                        <td>${user.name}</td>
                        <td>${user.role}</td>
                        <td>
                            <button class="btn bg-yellow-500 text-white" onclick="showEditUserForm('${user.username}')">Bearbeiten</button>
                            <button class="btn btn-delete" onclick="deleteUser('${user.username}')">Löschen</button>
                        </td>
                      </tr>`;
    });
    tableHTML += `</tbody></table>`;
    body.innerHTML = tableHTML;
}

function showAddUserForm() {
    showUserForm();
}

function showEditUserForm(username) {
    const user = allUsers.find(u => u.username === username);
    if (user) {
        showUserForm(user);
    }
}

function showUserForm(user = {}) {
    const isEdit = !!user.username;
    const formContainer = document.getElementById('userFormContainer');
    formContainer.innerHTML = `
        <div class="user-form">
            <h4 class="text-xl font-bold mb-2">${isEdit ? 'Benutzer bearbeiten' : 'Neuen Benutzer anlegen'}</h4>
            <label>Username:</label>
            <input type="text" id="userFormUsername" value="${user.username || ''}" ${isEdit ? 'readonly style="background:#eee;"' : ''}>
            <label>Name:</label>
            <input type="text" id="userFormName" value="${user.name || ''}">
            <label>Passwort ${isEdit ? '(leer lassen, um nicht zu ändern)' : ''}:</label>
            <input type="password" id="userFormPassword">
            <label>Rolle:</label>
            <select id="userFormRole">
                <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <div class="mt-4">
                <button class="btn bg-green-500 text-white" onclick="saveUser(${isEdit})">Speichern</button>
                <button class="btn bg-gray-500 text-white" onclick="document.getElementById('userFormContainer').innerHTML = ''">Abbrechen</button>
            </div>
        </div>`;
}

async function saveUser(isEdit) {
    const username = document.getElementById('userFormUsername').value;
    const name = document.getElementById('userFormName').value;
    const password = document.getElementById('userFormPassword').value;
    const role = document.getElementById('userFormRole').value;

    if (!username || !name || !role || (!isEdit && !password)) {
        showSaveFeedback("Bitte alle Felder ausfüllen.", false);
        return;
    }

    const payload = {
        mode: isEdit ? 'updateUser' : 'addUser',
        username, name, role,
        user: currentUser.name // Admin, der die Aktion ausführt
    };
    if (password) {
        payload.password = password;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showSaveFeedback("Benutzer gespeichert!", true);
            openUserAdminModal(); // Reload user list
        } else {
            showSaveFeedback(`Fehler: ${result.message}`, false);
        }
    } catch (err) {
        showSaveFeedback("Netzwerkfehler.", false);
    }
}

async function deleteUser(username) {
    if (!confirm(`Sind Sie sicher, dass Sie den Benutzer "${username}" löschen möchten?`)) return;

    const payload = {
        mode: 'deleteUser',
        username,
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
            showSaveFeedback("Benutzer gelöscht!", true);
            openUserAdminModal();
        } else {
            showSaveFeedback(`Fehler: ${result.message}`, false);
        }
    } catch (err) {
        showSaveFeedback("Netzwerkfehler.", false);
    }
}

// === WICHTIG: Alle globalen Funktionen zuweisen ===
document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal();
    closeProfileModal();
    closeStatisticsModal();
    closeEmailConfirmationModal();
    closeEmailPreviewModal();
    closeUserAdminModal();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus();
  updateClock();
  setInterval(updateClock, 1000);
  document.getElementById("archiveCheckbox")?.addEventListener('change', filterTable);
  document.getElementById('previewEmailBtn')?.addEventListener('click', generateEmailPreview);
  document.getElementById('markAsSentBtn')?.addEventListener('click', markAsSentManually);
  document.getElementById('sendEmailConfirmBtn')?.addEventListener('click', async () => {
    const recipientEmail = document.getElementById('recipientEmailInput').value.trim();
    if (!recipientEmail) {
        showSaveFeedback('Bitte E-Mail-Adresse eingeben.', false);
        return;
    }
    const payload = {
        mode: 'markAsSent', // sendConfirmationEmail wurde zu markAsSent konsolidiert
        sendEmail: 'true',
        recipient: recipientEmail,
        ref: currentModalData.Ref,
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
            showSaveFeedback('E-Mail gesendet und als bestätigt markiert!', true);
            closeEmailConfirmationModal();
            fetchData();
        } else {
            showSaveFeedback(`Fehler: ${result.message}`, false);
        }
    } catch (err) {
        showSaveFeedback('Netzwerkfehler.', false);
    }
  });
});

Object.assign(window, {
    openProfileModal, closeProfileModal, changePassword, logoutUser,
    fetchData, filterTable, sortTable,
    openModal, closeModal, saveDetails, deleteRow, deleteRowFromModal,
    createNewRequest, generateReference,
    populateCustomerDetails,
    shiftCalendar, renderCalendars, openCalendarDayFlights,
    showHistory, closeHistoryModal,
    openStatisticsModal, closeStatisticsModal, generateStatistics, downloadStatisticsToCSV,
    openEmailConfirmationModal, closeEmailConfirmationModal, generateEmailPreview, closeEmailPreviewModal, markAsSentManually,
    openUserAdminModal, closeUserAdminModal, renderUserTable, showAddUserForm, showEditUserForm, saveUser, deleteUser
});
