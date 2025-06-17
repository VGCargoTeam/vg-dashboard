// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbze83ir9HARMC2Vcaf1vUJ6nv5vY1eoCULHEY-U5pWhkQtYA_VHOoY6_UNs0UV8AyoM/exec';
const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

// Setze das heutige Datum (nur den Tag, ohne Zeit), um Zeitzonenprobleme beim Vergleich zu minimieren.
// Dies ist wichtig, da die Abflugzeit am Tag selbst liegt.
const today = new Date();
today.setHours(0, 0, 0, 0); // Setzt die Zeit auf Mitternacht für den Vergleich

// === DATENABRUF UND TABELLEN-RENDERUNG ===
function fetchData() {
  fetch(API_URL + "?mode=read")
    .then(r => r.json())
    .then(d => {
      requestData = d;
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
    const originalIndex = requestData.indexOf(requestData.find(item => item.Ref === r.Ref)); 

    // Datum für die Anzeige in der Tabelle formatieren (Stellt sicher, dass es YYYY-MM-DD ist)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        // Wenn es ein ISO-String ist (z.B. 2025-06-22T00:00:00.000Z), nimm nur den Datumsteil
        if (String(displayFlightDate).includes('T')) {
            displayFlightDate = String(displayFlightDate).split('T')[0];
        }
        // Wenn es bereits YYYY-MM-DD ist, bleibt es so
    }

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString('de-DE')}</td> <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button> 
        <button class="btn btn-delete" onclick="deleteRow(this)">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString('de-DE')} kg`; // 'de-DE' für Anzeige
}

// Filterfunktion
function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const fromDateInput = document.getElementById("fromDate").value; // String YYYY-MM-DD
  const toDateInput = document.getElementById("toDate").value;     // String YYYY-MM-DD

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);

    let matchesDateRange = true; // Ob das Datum im From/To-Bereich liegt
    let isPastFlight = false;    // Ob der Flug in der Vergangenheit liegt

    const flightDateFromData = r['Flight Date'] ? (String(r['Flight Date']).includes('T') ? String(r['Flight Date']).split('T')[0] : String(r['Flight Date'])) : '';

    if (flightDateFromData) {
      // Datum aus den Daten in ein Date-Objekt umwandeln
      // WICHTIG: Erstelle das Date-Objekt in der lokalen Zeitzone, um Mitternacht zu repräsentieren.
      const flightDateObj = new Date(flightDateFromData);
      flightDateObj.setHours(0, 0, 0, 0); // Auch auf Mitternacht setzen für konsistenten Vergleich

      // Überprüfen, ob der Flug in der Vergangenheit liegt (oder heute und bereits abgeflogen ist)
      if (flightDateObj < today) {
          isPastFlight = true;
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
                  isPastFlight = true;
              }
          }
      }

      // Filterung nach 'From' und 'To' Datum
      if (fromDateInput && flightDateFromData < fromDateInput) matchesDateRange = false;
      if (toDateInput && flightDateFromData > toDateInput) matchesDateRange = false;
    }

    // Bestimme, ob irgendein Filter aktiv ist (außer der automatischen "Vergangenheit"-Filterung)
    const isExplicitlyFiltered = refSearch || airlineSearch || fromDateInput || toDateInput;

    // Logik für die Anzeige:
    // Wenn kein expliziter Filter gesetzt ist, zeige nur zukünftige Flüge UND solche, die den Ref/Airline-Filtern entsprechen.
    if (!isExplicitlyFiltered) {
        return matchesRef && matchesAirline && !isPastFlight;
    } else {
        // Wenn ein expliziter Filter gesetzt ist, zeige alle Flüge, die DIESEN Filtern entsprechen,
        // unabhängig davon, ob sie in der Vergangenheit liegen.
        return matchesRef && matchesAirline && matchesDateRange;
    }
  });
  renderTable(filtered); // Übergibt die gefilterten Daten an renderTable
  renderCalendars(); // Rendert die Kalender immer neu, auch wenn nur gefiltert wurde (oder keine Filter aktiv)
}


// === MODAL FUNKTIONEN ===
function openModal(originalIndex) {
  // Wenn originalIndex -1 ist, erstellen wir einen neuen leeren Request
  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toISOString(),
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Vorfeldbegleitung': "Nein", // Standardwert "Nein" für Checkbox
    'Rate': "", 'Security charges': "", 'Dangerous Goods': "",
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': ""
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
      let value = r[key]; // Den Rohwert nehmen
      if (value === undefined || value === null) value = ""; // Stellt sicher, dass es nie undefined/null ist
      
      if (key === "Flight Date") {
        // Extrahiere nur das Datum im Format 'YYYY-MM-DD' für den Date-Input
        if (String(value).includes('T')) {
            value = String(value).split('T')[0];
        } else if (String(value).match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Wert ist bereits YYYY-MM-DD
        } else {
            // Fallback, wenn das Datum ein anderes unerwartetes Format hat (z.B. wenn es leer oder ungültig ist)
            try {
                // Versuche, ein gültiges Datum zu parsen und zu formatieren
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) { // Überprüfe, ob das Datum gültig ist
                    value = parsedDate.toISOString().split('T')[0];
                } else {
                    value = ""; // Ungültiges Datum
                }
            } catch (e) {
                value = ""; // Ungültiges Datum
            }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${value}">`;
      } else if (key === "Abflugzeit") {
        // Extrahiere nur die Uhrzeit im Format 'HH:mm'
        if (String(value).includes('T')) { // Wenn es ein ISO-Datum/Zeit-String ist
            const dateObj = new Date(value);
            //toLocaleTimeString mit de-DE für HH:mm (ohne Sekunden)
            value = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (String(value).length === 5 && String(value).includes(':')) {
            // Es ist bereits im HH:mm Format
        } else {
            value = ""; // Ungültige Zeit
        }
        return `<label>${label}</label><input type="time" name="${key}" value="${value}">`;
      } else if (type === "checkbox") {
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}> ${label}</label>`;
      } else if (key === "Created At") {
        // Für "Created At" immer das Datum im YYYY-MM-DD HH:MM:SS Format anzeigen, nicht bearbeitbar
        if (value) {
            const dateObj = new Date(value);
            // Locale String für de-DE ist gut für YYYY-MM-DD HH:MM:SS (könnte Formatierungsprobleme haben, sv-SE ist robuster für ISO)
            // Bleiben wir bei sv-SE für konsistente, leicht parsebare Strings, es sei denn, spezifische dt. Formatierung ist gefordert
            value = dateObj.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        return `<label>${label}:</label><input name="${key}" value="${value}" readonly style="background-color:#eee;"/>`;
      } else if (key === "Ref" && originalIndex !== -1) {
          return `<label>${label}:</label><input name="${key}" value="${value}" readonly style="background-color:#eee;"/>`;
      } else if (key === "Tonnage" || key === "Rate" || key === "Security charges" || key === "Dangerous Goods" || key === "10ft consumables" || key === "20ft consumables") {
          // Für numerische Felder: Formatiere Punkt zu Komma für die Anzeige im Modal
          return `<label>${label}:</label><input type="text" name="${key}" value="${String(value).replace('.', ',')}" />`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" />`; // Standardmäßig Text-Input
    }).join("");
  };

  const customerFields = [
    { label: "Ref", key: "Ref" },
    { label: "Created At", key: "Created At" },
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name Invoicing", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail Invoicing", key: "Contact E-Mail Invoicing" }
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
    <textarea name="Zusatzkosten" placeholder="Labeln, Fotos" style="height:80px">${r["Zusatzkosten"] || ""}</textarea>
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px">${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(section("Kundendetails", renderFields(customerFields)));
  modalBody.appendChild(section("Flugdetails", renderFields(flightFields)));
  modalBody.appendChild(section("Preisdetails", renderFields(priceFields) + priceExtra));

  const saveButton = document.createElement("button");
  saveButton.textContent = "Speichern";
  saveButton.onclick = saveDetails;
  saveButton.style.margin = "10px auto 0";
  saveButton.style.padding = "10px 20px";
  saveButton.style.fontWeight = "bold";
  saveButton.style.backgroundColor = "#28a745";
  saveButton.style.color = "white";
  saveButton.style.border = "none";
  saveButton.style.borderRadius = "6px";
  saveButton.style.cursor = "pointer";
  modalBody.appendChild(saveButton);

  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") closeModal();
});

function saveDetails() {
  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => {
    // Für "Flight Date" nehmen wir den Wert direkt aus dem Input (YYYY-MM-DD)
    if (i.name === "Flight Date") {
        data[i.name] = i.value; 
    } else if (i.name === "Tonnage" || i.name === "Rate" || i.name === "Security charges" || i.name === "Dangerous Goods" || i.name === "10ft consumables" || i.name === "20ft consumables") {
        // Ersetze Kommas durch Punkte für numerische Felder vor dem Senden an Sheets
        data[i.name] = i.value.replace(/,/g, '.');
    } else {
        data[i.name] = i.type === "checkbox" ? (i.checked ? "Ja" : "Nein") : i.value;
    }
  });

  const refValue = document.querySelector("#modalBody input[name='Ref']").value;
  data.mode = requestData.find(r => r.Ref === refValue) ? "update" : "create";
  
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(data)
  })
  .then(res => res.json())
  .then((response) => {
    if (response && response.status === "success") {
      showSaveFeedback("Gespeichert!", true);
    } else {
      showSaveFeedback("Fehler beim Speichern des Eintrags!", false);
      console.error("Speichern fehlgeschlagen:", response);
    }
    closeModal();
    fetchData(); // Daten neu laden, um Änderungen anzuzeigen
  })
  .catch((err) => {
    showSaveFeedback("Fehler beim Speichern!", false);
    console.error(err);
  });
}

function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;

  // NEU: Bestätigungsdialog hinzufügen
  if (!confirm(`Möchten Sie den Eintrag mit der Referenz "${ref}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
    return; // Wenn der Benutzer "Abbrechen" wählt, die Funktion beenden
  }

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ Ref: ref, mode: "delete" })
  })
  .then(res => res.json()) 
  .then((response) => { 
    if (response && response.status === "success") { 
      showSaveFeedback("Eintrag gelöscht!", true);
    } else {
      showSaveFeedback("Fehler beim Löschen des Eintrags!", false);
      console.error("Löschen fehlgeschlagen:", response);
    }
    fetchData(); // Daten neu laden, um die gelöschte Zeile zu entfernen
  })
  .catch((err) => {
    showSaveFeedback("Fehler beim Löschen!", false);
    console.error(err);
  });
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
  // Rendert zwei Monate: Aktuellen und nächsten Monat
  for (let i = 0; i < 2; i++) {
    const m = baseMonth + i;
    const y = baseYear + Math.floor(m / 12);
    const month = (m % 12 + 12) % 12; // Stellt sicher, dass der Monat zwischen 0-11 bleibt
    container.innerHTML += generateCalendarHTML(y, month);
  }
}

// NEUE FUNKTION: Öffnet das Modal für Flüge an einem bestimmten Kalendertag
function openCalendarDayFlights(year, month, day) {
  // Datum im Format `YYYY-MM-DD` erstellen
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Alle Flüge an diesem spezifischen Tag finden
  const flightsOnThisDay = requestData.filter(r => {
    const flightDateFromData = r['Flight Date'] ? (String(r['Flight Date']).includes('T') ? String(r['Flight Date']).split('T')[0] : String(r['Flight Date'])) : '';
    return flightDateFromData === dateStr;
  });

  if (flightsOnThisDay.length > 0) {
    // Wenn es mehrere Flüge gibt, öffne den ersten gefundenen im Modal
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.indexOf(firstFlight); // Finde den Index des ersten Flugs
    if (originalIndex !== -1) {
      openModal(originalIndex);
    }
  } else {
    // Optional: Wenn keine Flüge vorhanden sind, könnte man eine neue Anfrage für diesen Tag erstellen
    // alert(`Keine Flüge gefunden für ${dateStr}.`);
    // createNewRequestWithDate(dateStr); // Eine Funktion, die ein neues Modal mit vorausgefülltem Datum öffnet
  }
}

function generateCalendarHTML(year, month) {
  // getDay() gibt 0 für Sonntag, 1 für Montag zurück. Wir wollen 0 für Montag.
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' }); // Monatname auf Deutsch
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;

  const flightsByDay = new Map(); 
  requestData.forEach((r) => {
    const flightDate = r['Flight Date']; 
    if (flightDate) {
      // Stellen sicher, dass wir nur den Datumsteil für den Vergleich verwenden
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

  for (let i = 0; i < 6; i++) { // Max 6 Wochen im Monat
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

        if (flightsForDay.length > 0) {
          cellClasses.push('has-flights'); 
          
          flightsForDay.forEach(f => {
            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlugnummer: ${f.Flugnummer || '-'}` + 
              `\nAbflugzeit: ${f['Abflugzeit'] || '-'}` +
              `\nTonnage: ${parseFloat(String(f.Tonnage).replace(',', '.') || '0').toLocaleString('de-DE')} kg` // Komma durch Punkt für Anzeige
            );
            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true; 
            }
          });
          simpleTitleContent = `Flüge: ${flightsForDay.length}`; 
        }

        // escaped ' for HTML attribute
        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;'); 
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
  updateClock();
  setInterval(updateClock, 1000);
  fetchData(); // Daten beim Laden der Seite abrufen
});

function updateClock() {
  const now = new Date();
  // Nutzt die deutsche Lokalisierung für Datum und Uhrzeit
  document.getElementById('currentDate').textContent = "Date: " + now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }); 
  document.getElementById('clock').textContent = "Time: " + now.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

// === NEUE ANFRAGE ERSTELLEN ===
function generateReference() {
  const now = new Date();
  // Nutzt das deutsche Datum für den Zeitstempel im Referenzcode
  const timestamp = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '').replace(/\//g, ''); // dd.mm.yyyy -> ddmmyyyy oder dd/mm/yyyy -> ddmmyyyy
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 zufällige Zeichen
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  // Ruft openModal mit -1 auf, um einen neuen, leeren Eintrag zu signalisieren
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
