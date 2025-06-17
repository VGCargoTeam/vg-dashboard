// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbx6bQ5tXj-PfqS5W6I_bkJsNXpj3l7YND8E2kayE80pO1vhuwe82GJmSLvJFc8DQFeu/exec';
const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
let requestData = []; // Speichert alle abgerufenen Charterdaten
let baseMonth = new Date().getMonth(); // Aktueller Monat (0-indexed)
let baseYear = new Date().getFullYear(); // Aktuelles Jahr

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
    });
}

function renderTable(dataToRender = requestData) { // Erlaubt das Rendern von gefilterten Daten
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  let totalFlights = 0;
  let totalWeight = 0;

  dataToRender.forEach((r) => { // dataToRender verwenden
    const row = document.createElement("tr");
    const ton = parseFloat(r.Tonnage || "0") || 0;
    
    // Finde den ursprünglichen Index im requestData Array
    const originalIndex = requestData.indexOf(requestData.find(item => item.Ref === r.Ref)); 

    // Datum für die Anzeige in der Tabelle formatieren
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            // Nur den Datumsteil (YYYY-MM-DD) extrahieren
            displayFlightDate = new Date(displayFlightDate).toISOString().split('T')[0];
        } catch (e) {
            console.warn("Konnte Flugdatum nicht parsen:", r['Flight Date'], e);
            // Bleibt beim Originalwert, wenn das Parsen fehlschlägt
        }
    }

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})">${r.Ref}</a></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString()}</td>
      <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button> 
        <button class="btn btn-delete" onclick="deleteRow(this)">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString()} kg`;
}

// Filterfunktion
function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);

    let matchesDate = true;
    const flightDateForComparison = r['Flight Date'] ? new Date(r['Flight Date']).toISOString().split('T')[0] : '';

    if (fromDate && flightDateForComparison && flightDateForComparison < fromDate) matchesDate = false;
    if (toDate && flightDateForComparison && flightDateForComparison > toDate) matchesDate = false;

    return matchesRef && matchesAirline && matchesDate;
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
      let value = r[key] || "";
      if (key === "Flight Date") {
        // Extrahiere nur das Datum im Format 'YYYY-MM-DD'
        // Dies ist für die Anzeige im Input-Feld
        if (value) {
            value = new Date(value).toISOString().split('T')[0];
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${value}">`;
      } else if (key === "Abflugzeit") {
        // Extrahiere nur die Uhrzeit im Format 'HH:mm'
        if (value) {
            if (value.includes('T') && value.includes('Z')) { 
                const dateObj = new Date(value);
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                value = `${hours}:${minutes}`;
            } else if (value.length === 5 && value.includes(':')) {
                // Es ist bereits im HH:mm Format
            } 
        }
        return `<label>${label}</label><input type="time" name="${key}" value="${value}">`;
      } else if (type === "checkbox") {
        const checked = value.toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked}> ${label}</label>`;
      }
      if (key === "Created At") {
        return `<label>${label}:</label><input name="${key}" value="${value}" readonly style="background-color:#eee;"/>`;
      }
      if (key === "Ref" && originalIndex !== -1) {
          return `<label>${label}:</label><input name="${key}" value="${value}" readonly style="background-color:#eee;"/>`;
      }
      return `<label>${label}:</label><input name="${key}" value="${value}" />`;
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
    // Spezielle Handhabung für das Flight Date, um nur YYYY-MM-DD zu senden
    if (i.name === "Flight Date") {
        data[i.name] = i.value; // i.value ist bereits YYYY-MM-DD vom input type="date"
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
  .then(() => {
    showSaveFeedback("Gespeichert!", true);
    closeModal();
    fetchData(); // Daten neu laden, um Änderungen anzuzeigen
  })
  .catch((err) => {
    showSaveFeedback("Fehler!", false);
    console.error(err);
  });
}

function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ Ref: ref, mode: "delete" })
  })
  .then(() => {
    fetchData(); // Daten neu laden, um die gelöschte Zeile zu entfernen
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
  for (let i = 0; i < 2; i++) {
    const m = baseMonth + i;
    const y = baseYear + Math.floor(m / 12);
    const month = (m % 12 + 12) % 12; 
    container.innerHTML += generateCalendarHTML(y, month);
  }
}

function openCalendarDayFlights(year, month, day) {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const flightsOnThisDay = requestData.filter(r => r['Flight Date'] && r['Flight Date'].startsWith(dateStr));

  if (flightsOnThisDay.length > 0) {
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.indexOf(firstFlight); 
    if (originalIndex !== -1) {
      openModal(originalIndex);
    }
  } 
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;

  const flightsByDay = new Map(); 
  requestData.forEach((r) => { // i wurde entfernt, da es nicht mehr für originalIndex hier benötigt wird
    const flightDate = r['Flight Date']; 
    if (flightDate) {
      const [fYear, fMonth, fDay] = flightDate.split('T')[0].split('-').map(Number);
      if (fYear === year && fMonth === (month + 1)) { 
        if (!flightsByDay.has(fDay)) { 
          flightsByDay.set(fDay, []); 
        }
        flightsByDay.get(fDay).push(r); // Füge direkt das Flugobjekt hinzu
      }
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

        if (flightsForDay.length > 0) {
          cellClasses.push('has-flights'); 
          
          flightsForDay.forEach(f => { // Iteriere direkt über die Flugobjekte
            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlugnummer: ${f.Flugnummer || '-'}` + 
              `\nAbflugzeit: ${f['Abflugzeit'] || '-'}` +
              `\nTonnage: ${parseFloat(f.Tonnage || '0').toLocaleString()} kg`
            );
            if (f['Vorfeldbegleitung'] && f['Vorfeldbegleitung'].toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true; 
            }
          });
          simpleTitleContent = `Flüge: ${flightsForDay.length}`; 
        }

        const dataTooltipContent = tooltipContentArray.join('\n\n'); 
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        // Hier ist die wichtige Änderung: die `data-tooltip` kann nun sehr lang sein
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
  fetchData(); 
});

function updateClock() {
  const now = new Date();
  const local = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // +2 Stunden für CEST (Sommerzeit)
  // Zeigt nur den Datumsteil an (YYYY-MM-DD)
  document.getElementById('currentDate').textContent = "Date: " + local.toISOString().split('T')[0];
  document.getElementById('clock').textContent = "Time: " + local.toISOString().substr(11, 8);
}

// === NEUE ANFRAGE ERSTELLEN ===
function generateReference() {
  const now = new Date();
  const timestamp = now.toISOString().split('T')[0].replace(/-/g, ''); // `YYYYMMDD`
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 zufällige Zeichen
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
