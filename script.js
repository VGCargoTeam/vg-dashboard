// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
// Aktualisierte API_URL aus deinen letzten Uploads
const API_URL = 'https://script.google.com/macros/s/AKfycbxlkY1f94D26BKvs7oeiNUhOJHEycsox3J61kb4iN7z_3frXRzfB8sCuCnWQVbFgk88/exec'; // <-- Überprüfen Sie, ob dies die aktuelle URL Ihrer bereitgestellten Web-App ist!

let isAdmin = false; // Initialisiere isAdmin als false
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

// Setze das heutige Datum (nur den Tag, ohne Zeit), um Zeitzonenprobleme beim Vergleich zu minimieren.
const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

// NEU: Globaler Variable für den eingeloggten Benutzer
let currentLoggedInUser = "Unbekannt"; 

// NEUE FUNKTION: Admin-Status aus localStorage lesen
function getAdminStatusFromLocalStorage() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (currentUser) {
    currentLoggedInUser = currentUser.name; // Benutzername für Audit-Log speichern
    if (currentUser.role === "admin") {
      isAdmin = true;
    } else {
      isAdmin = false;
    }
  } else {
    isAdmin = false;
    currentLoggedInUser = "Gast"; // Falls kein Benutzer angemeldet ist
  }
  console.log("Admin Status aus localStorage geladen:", isAdmin); // Zum Debuggen
  console.log("Aktueller Benutzer:", currentLoggedInUser); // Zum Debuggen
  
  // Elemente basierend auf Admin-Status sichtbar/unsichtbar machen
  updateUIBasedOnAdminStatus();
}

function updateUIBasedOnAdminStatus() {
  const adminElements = document.querySelectorAll(".admin-only");
  if (isAdmin) {
    adminElements.forEach(el => el.style.display = ""); // Standardanzeige wiederherstellen (block, inline-block etc.)
  } else {
    adminElements.forEach(el => el.style.display = "none");
  }
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
      // KORREKTUR HIER: Greife auf den 'data'-Schlüssel des Objekts zu
      // Da dein Google Apps Script jetzt ein Objekt der Form {status: "success", data: [...]} zurückgibt
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
    // Sicherstellen, dass Tonnage als Zahl mit Punkt gelesen und korrekt formatiert wird
    const ton = parseFloat(String(r.Tonnage).replace(',', '.') || "0") || 0; 
    
    // Finde den ursprünglichen Index im requestData Array
    // WICHTIG: originalIndex muss auf das ungefilterte requestData zugreifen
    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref); 

    // Datum für die Anzeige in der Tabelle formatieren (Stellt sicher, dass es YYYY-MM-DD ist)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        if (String(displayFlightDate).includes('T')) {
            displayFlightDate = String(displayFlightDate).split('T')[0];
        }
    }

    // Zeigen/Verstecken des Delete-Buttons basierend auf isAdmin (Klasse 'admin-only' verwenden)
    // Der Delete-Button ist jetzt Teil des HTML und wird per CSS/JS gesteuert
    const deleteButtonHTML = `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>`;

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
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString('de-DE')} kg`; // 'de-DE' für Anzeige
  
  // UI nach dem Rendern der Tabelle basierend auf Admin-Status aktualisieren
  updateUIBasedOnAdminStatus();
}

// Filterfunktion (unverändert)
function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const fromDateInput = document.getElementById("fromDate").value; // String YYYY-MM-DD
  const toDateInput = document.getElementById("toDate").value;     // String YYYY-MM-DD

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);

    let matchesDateRange = true; // Ob das Datum im From/To-Bereich liegt
    let isPastOrTodayAndGoneFlight = false;    // Ob der Flug in der Vergangenheit liegt oder heute und bereits abgeflogen ist

    const flightDateFromData = r['Flight Date'] ? (String(r['Flight Date']).includes('T') ? String(r['Flight Date']).split('T')[0] : String(r['Flight Date'])) : '';

    if (flightDateFromData) {
      // Datum aus den Daten in ein Date-Objekt umwandeln
      const flightDateObj = new Date(flightDateFromData);
      flightDateObj.setHours(0, 0, 0, 0); // Auch auf Mitternacht setzen für konsistenten Vergleich

      // Überprüfen, ob der Flug in der Vergangenheit liegt (oder heute und bereits abgeflogen ist)
      if (flightDateObj < today) {
          isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
          // Wenn der Flug heute ist, prüfen, ob die Abflugzeit bereits verstrichen ist
          const abflugzeit = r['Abflugzeit']; // HH:MM String
          if (abflugzeit) {
              const [hours, minutes] = abflugzeit.split(':').map(Number);
              const flightTime = new Date(); // Aktuelles Datum
              flightTime.setHours(hours, minutes, 0, 0);

              const now = new Date(); // Aktuelle Zeit
              now.setSeconds(0, 0); // Sekunden ignorieren für Vergleich
              now.setMilliseconds(0); // Millisekunden ignorieren

              if (flightTime <= now) { // Wenn Abflugzeit <= jetzige Zeit
                  isPastOrTodayAndGoneFlight = true;
              }
          }
      }

      // Filterung nach 'From' und 'To' Datum
      if (fromDateInput && flightDateFromData < fromDateInput) matchesDateRange = false;
      if (toDateInput && flightDateFromData > toDateInput) matchesDateRange = false;
    }

    const isExplicitlyFiltered = refSearch || airlineSearch || fromDateInput || toDateInput;

    if (!isExplicitlyFiltered) {
        // Wenn keine Filter aktiv sind, zeige nur zukünftige Flüge an
        return matchesRef && matchesAirline && !isPastOrTodayAndGoneFlight;
    } else {
        // Wenn Filter aktiv sind, zeige alle Flüge, die den Filtern entsprechen, unabhängig vom Datum
        return matchesRef && matchesAirline && matchesDateRange;
    }
  });
  renderTable(filtered); // Übergibt die gefilterten Daten an renderTable
  renderCalendars(); // Rendert die Kalender immer neu, auch wenn nur gefiltert wurde (oder keine Filter aktiv)
}

// === MODAL FUNKTIONEN ===
function openModal(originalIndex) {
  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toISOString(), // Speichert ISO-Format für Konsistenz
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Vorfeldbegleitung': "Nein",
    'Rate': "", 'Security charges': "", 'Dangerous Goods': "",
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Nein", // NEU
    'Service Description Accepted': "Nein", // NEU
    'Accepted By Name': "", // NEU
    'Acceptance Timestamp': "" // NEU
  } : requestData[originalIndex]; // Hier requestData direkt verwenden

  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = ""; // Inhalt leeren

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
      
      // Felder, die nur für Admins bearbeitbar sein sollen
      const isPriceRelatedField = [
        'Rate', 'Security charges', 'Dangerous Goods', 
        '10ft consumables', '20ft consumables', 'Zusatzkosten', 'Email Request'
      ].includes(key);

      let readOnlyAttr = '';
      if (key === "Ref" && originalIndex !== -1) { // Ref bleibt readonly, wenn es ein bestehender Eintrag ist
          readOnlyAttr = 'readonly style="background-color:#eee; cursor: not-allowed;"';
      } else if (key === "Created At" || key === "Acceptance Timestamp") { // Created At und Acceptance Timestamp bleiben immer readonly
           readOnlyAttr = 'readonly style="background-color:#eee; cursor: not-allowed;"';
      } else if (isPriceRelatedField && !isAdmin) { // Admin-Felder sind readonly, wenn kein Admin
          readOnlyAttr = 'readonly style="background-color:#eee; cursor: not-allowed;"';
      }


      if (key === "Flight Date") {
        // Stellt sicher, dass das Datum im YYYY-MM-DD Format ist
        if (String(value).includes('T')) {
            value = String(value).split('T')[0];
        } else if (!String(value).match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Wenn es kein ISO- oder YYYY-MM-DD-Format ist, versuchen Sie zu parsen
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
        // Stellt sicher, dass die Abflugzeit im HH:MM Format ist
        if (String(value).includes('T')) {
            const dateObj = new Date(value);
            value = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (!(String(value).length === 5 && String(value).includes(':'))) {
            value = ""; // Wenn nicht HH:MM, leeren
        }
        return `<label>${label}</label><input type="time" name="${key}" value="${value}" ${readOnlyAttr}>`;
      } else if (type === "checkbox") { // Hier wird der 'type' für die Checkboxen genutzt
        // Checkboxen AGB Accepted und Service Description Accepted sind editierbar
        // Vorfeldbegleitung wird auch als Checkbox behandelt
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}> ${label}</label>`;
      } else if (key === "Tonnage" || key === "Rate" || key === "Security charges" || key === "Dangerous Goods" || key === "10ft consumables" || key === "20ft consumables") {
          // Für numerische Felder: Formatiere Punkt zu Komma für die Anzeige im Modal
          const numericValue = parseFloat(String(value).replace(',', '.') || "0") || 0;
          return `<label>${label}:</label><input type="text" name="${key}" value="${numericValue.toLocaleString('de-DE', {useGrouping: false})}" ${readOnlyAttr} />`;
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
    // NEU HINZUGEFÜGT:
    { label: "AGB Accepted", key: "AGB Accepted", type: "checkbox" },
    { label: "Service Description Accepted", key: "Service Description Accepted", type: "checkbox" },
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
    <textarea name="Zusatzkosten" placeholder="Labeln, Fotos" style="height:80px" ${!isAdmin ? 'readonly style="background-color:#eee; cursor: not-allowed;"' : ''}>${r["Zusatzkosten"] || ""}</textarea>
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px" ${!isAdmin ? 'readonly style="background-color:#eee; cursor: not-allowed;"' : ''}>${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  
  // Hier wird der Preisdetails-Bereich nur für Admins sichtbar
  if (isAdmin) {
    modalBody.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));
  } else {
    // Optional: Wenn kein Admin, zeige eine Meldung an
    // modalBody.appendChild(section("Preisdetails", "<p>Keine Berechtigung zur Ansicht dieser Details.</p>"));
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center"; // Buttons zentrieren
  buttonContainer.style.gap = "10px"; // Abstand zwischen den Buttons
  buttonContainer.style.marginTop = "20px";

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

  // NEU: History Button im Modal
  const historyButton = document.createElement("button");
  historyButton.textContent = "History";
  historyButton.style.padding = "10px 20px";
  historyButton.style.fontWeight = "bold";
  historyButton.style.backgroundColor = "#17a2b8"; // Eine eigene Farbe für den History-Button
  historyButton.style.color = "white";
  historyButton.style.border = "none";
  historyButton.style.borderRadius = "6px";
  historyButton.style.cursor = "pointer";
  historyButton.onclick = () => showHistory(r.Ref); 
  buttonContainer.appendChild(historyButton);

  // Lösch-Button im Modal: Nur für Admins und nur bei bestehenden Einträgen
  if (isAdmin && originalIndex !== -1) { 
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
  
  modalBody.appendChild(buttonContainer); // Button-Container hinzufügen

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
    user: currentLoggedInUser // Aktuellen Benutzer senden
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, // Behalten für Dashboard-Anfragen
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP-Fehler! Status: ${response.status}`);
    }
    const responseData = await response.json(); // Muss response.json() sein

    if (responseData && responseData.status === "success") { 
      showSaveFeedback("Eintrag gelöscht!", true);
    } else {
      showSaveFeedback(`Fehler beim Löschen des Eintrags! ${responseData.message || ''}`, false);
      console.error("Löschen fehlgeschlagen:", responseData);
    }
    closeModal(); // Modal schließen nach dem Löschen
    fetchData(); // Daten neu laden
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
    closeHistoryModal(); // Auch History Modal schließen
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
    // Sicherstellen, dass readonly Felder trotzdem gesendet werden, da sie nicht disabled sind
    if (i.name === "Flight Date") {
        data[i.name] = i.value; 
    } else if (i.name === "Tonnage" || i.name === "Rate" || i.name === "Security charges" || i.name === "Dangerous Goods" || i.name === "10ft consumables" || i.name === "20ft consumables") {
        // Ersetze Komma durch Punkt für das Backend, falls es numerische Werte erwartet
        data[i.name] = i.value.replace(/,/g, '.') || "";
    } else {
        data[i.name] = i.type === "checkbox" ? (i.checked ? "Ja" : "Nein") : i.value;
    }
  });

  const refValue = document.querySelector("#modalBody input[name='Ref']").value;
  // Der Modus wird im Backend anhand der Existenz der Ref entschieden (Update vs. Create)
  // Wir müssen hier nur den 'write' Modus senden.
  data.mode = "write"; // Muss "write" sein, damit doPost den create/update-Pfad nimmt
  data.user = currentLoggedInUser; // Aktuellen Benutzer senden

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, // Behalten für Dashboard-Anfragen
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
    fetchData(); // Daten neu laden, um Änderungen anzuzeigen
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
    user: currentLoggedInUser // Aktuellen Benutzer senden
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, // Behalten für Dashboard-Anfragen
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
    fetchData(); // Daten neu laden, um die gelöschte Zeile zu entfernen
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
    const month = (m % 12 + 12) % 12; // Normalisiere den Monat auf 0-11
    container.innerHTML += generateCalendarHTML(y, month);
  }
}

function openCalendarDayFlights(year, month, day) {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  const flightsOnThisDay = requestData.filter(r => {
    const flightDateFromData = r['Flight Date'] ? (String(r['Flight Date']).includes('T') ? String(r['Flight Date']).split('T')[0] : String(r['Flight Date'])) : '';
    return flightDateFromData === dateStr;
  });

  if (flightsOnThisDay.length > 0) {
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.indexOf(firstFlight);
    if (originalIndex !== -1) {
      openModal(originalIndex);
    } else {
      console.warn("Konnte den Originalindex des Fluges nicht finden:", firstFlight);
      // Fallback: Wenn der Originalindex nicht gefunden wird, versuche das Modal mit den Daten des ersten Fluges zu öffnen.
      // Dies könnte passieren, wenn requestData gefiltert oder neu geordnet wurde.
      // Um ein direktes Problem zu vermeiden, könnte man hier -1 oder einen Klon des Objekts übergeben,
      // aber da die filterTable() jetzt requestData auf d.data setzt, sollte indexOf wieder zuverlässig sein.
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
    const flightDate = r['Flight Date']; 
    if (flightDate) {
      const datePart = String(flightDate).includes('T') ? String(flightDate).split('T')[0] : String(flightDate);
      const [fYear, fMonth, fDay] = datePart.split('-').map(Number);
      if (fYear === year && fMonth === (month + 1)) { 
        if (!flightsByDay.has(fDay)) { 
          flightsByDay.set(fDay, []); 
        }
        flightsByDay.get(fDay).push(r); 
      }
    }
  });

  for (let i = 0; i < 6; i++) { // Max 6 Zeilen für Wochen
    html += "<tr>";
    for (let j = 0; j < 7; j++) { // 7 Tage pro Woche
      if ((i === 0 && j < firstDayOfMonthWeekday) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const flightsForDay = flightsByDay.get(day) || []; 
        let cellClasses = ['calendar-day'];
        let tooltipContentArray = []; 
        let simpleTitleContent = ''; 
        let dayHasVorfeldbegleitung = false; 

        // Überprüfe, ob der aktuelle Tag der heutige Tag ist
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

        // Sicherstellen, dass data-tooltip HTML-Entities korrekt escapen
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
  getAdminStatusFromLocalStorage(); 
  updateClock();
  setInterval(updateClock, 1000);
  fetchData(); 
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
    const auditResult = await response.json(); // Muss response.json() sein

    // KORREKTUR HIER: Greife auf den 'data'-Schlüssel des Audit-Objekts zu
    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p style="text-align: center;">No history found for this reference.</p>';
      return;
    }

    let historyHTML = '<ul style="list-style-type: none; padding: 0;">';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      // Versuch, JSON-Strings in Details zu formatieren, falls vorhanden
      let detailsContent = log.Details || '-';
      try {
          // Prüfen, ob Details ein JSON-String von einem gelöschten Eintrag sein könnte
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              detailsContent = 'Gelöschte Daten: <pre>' + JSON.stringify(parsedDetails, null, 2) + '</pre>';
          }
      } catch (e) {
          // Nichts tun, wenn es kein JSON ist
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
