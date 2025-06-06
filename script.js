let requestData = [];

function populateRows() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  requestData.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button class="ref-link" onclick="openDetails('${r.ref}')">${r.ref}</button></td>
  <td>${r.flightNumber || "-"}</td>
  <td>${r.date.toLocaleDateString('de-DE')}</td>
  <td>${r.airline}</td>
  <td>${r.tonnage.toLocaleString('de-DE')}</td>
  <td><button class="delete-btn" onclick="deleteRequest('${r.ref}')">Delete</button></td>`;
    table.appendChild(row);
  });
  filterTable();
  renderCalendars();
}

function filterTable() {
  const refVal = document.getElementById("refSearch").value.toLowerCase();
  const airlineVal = document.getElementById("airlineSearch").value.toLowerCase();
  const flightVal = document.getElementById("flightSearch")?.value?.toLowerCase() || "";

  const startDate = new Date(document.getElementById("startDate").value);
  const endDate = new Date(document.getElementById("endDate").value);
  const showArchive = document.getElementById("showArchive").checked;

  const rows = document.querySelectorAll("#dataTable tr");
  let totalFlights = 0;
  let totalTonnage = 0;

  rows.forEach(row => {
    const cells = row.children;
    const ref = cells[0].textContent.toLowerCase();
    const flight = cells[1].textContent.toLowerCase();
    const date = new Date(cells[2].textContent.split('.').reverse().join('-'));
    const airline = cells[3].textContent.toLowerCase();
    const tonnage = parseFloat(cells[4].textContent.replace(/\./g, '').replace(/,/g, '.'));

    let show = true;

    if (refVal && !ref.includes(refVal)) show = false;
    if (airlineVal && !airline.includes(airlineVal)) show = false;
    if (flightVal && !flight.includes(flightVal)) show = false;

    if (!isNaN(startDate.getTime()) && date < startDate) show = false;
    if (!isNaN(endDate.getTime()) && date > endDate) show = false;

    if (!showArchive && date < new Date().setHours(0,0,0,0)) show = false;

    row.style.display = show ? "" : "none";
    if (show) {
      totalFlights++;
      totalTonnage += tonnage;
    }
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalTonnage.toLocaleString('de-DE')} kg`;
}

function deleteRequest(ref) {
  if (confirm("Are you sure you want to delete this request?")) {
    // 1. Lokal entfernen
    const index = requestData.findIndex(r => r.ref === ref);
    if (index !== -1) requestData.splice(index, 1);
    populateRows();

    // 2. Anfrage ans Google Apps Script zum Löschen im Sheet
    const url = "https://script.google.com/macros/s/AKfycbyRaUcp6c0skDO_AKFbn6z2JVsdid1A-UWDRLYh_ayd3IJOUyz8bPhejpSbx4POwMuL/exec";
    const formData = new URLSearchParams();
    formData.append("mode", "delete");
    formData.append("ref", ref);

    fetch(url, {
      method: "POST",
      body: formData
    })
    .then(response => response.text())
    .then(result => {
      console.log("Löschergebnis:", result);
      alert("Anfrage wurde erfolgreich gelöscht!");
    })
    .catch(error => {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen!");
    });
  }
}

function openDetails(ref) {
  const r = requestData.find(r => r.ref === ref);
  if (!r) return;
  document.getElementById("modalRef").value = r.ref;
  document.getElementById("viewRef").textContent = r.ref;
  document.getElementById("viewAirline").textContent = r.airline;
  document.getElementById("viewDate").textContent = r.date.toLocaleDateString('de-DE');
  document.getElementById("viewTonnage").textContent = `${r.tonnage.toLocaleString('de-DE')} kg (urspr.)${r.manifestWeight ? ` → ${r.manifestWeight.toLocaleString('de-DE')} kg (Manifest)` : ''}`;
  document.getElementById("viewBillingCompany").textContent = r.billingCompany || "-";
  document.getElementById("viewBillingAddress").textContent = r.billingAddress || "-";
  document.getElementById("viewTaxNumber").textContent = r.taxNumber || "-";
  document.getElementById("viewContactName").textContent = r.contactName || "-";
  document.getElementById("viewContactEmail").textContent = r.contactEmail || "-";
  document.getElementById("viewEmailRequest").textContent = r.emailRequest || "-";
  document.getElementById("flightTime").value = r.flightTime || "";
  document.getElementById("manifestWeight").value = r.manifestWeight || "";
  document.getElementById("rate").value = r.rate || "";
  document.getElementById("otherPrices").value = r.otherPrices || "";
  document.getElementById("apronSupport").checked = r.apronSupport || false;
  document.getElementById("detailModal").style.display = "block";
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

function saveDetails() {
  const ref = document.getElementById("modalRef").value;
  const r = requestData.find(r => r.ref === ref);
  if (!r) return;

  const finalWeight = parseFloat(document.getElementById("manifestWeight").value) || 0;
  const extraCharges = document.getElementById("otherPrices").value;
  const rate = parseFloat(document.getElementById("rate").value) || 0;
  const departureTime = document.getElementById("flightTime").value;
  const escort = document.getElementById("apronSupport").checked;
  const flightNumber = document.getElementById("flightNumberInput").value;

  // Lokale Anzeige aktualisieren (optional)
  r.manifestWeight = finalWeight;
  r.otherPrices = extraCharges;
  r.rate = rate;
  r.flightTime = departureTime;
  r.apronSupport = escort;
  r.flightNumber = flightNumber;

  // ❌ NICHT mehr: r.tonnage = r.manifestWeight;

  // In Google Sheet speichern
  saveExtrasToGoogleSheet(ref, finalWeight, extraCharges, rate, departureTime, escort, flightNumber);

  closeModal();
  populateRows();
}

function updateClock() {
  const now = new Date();
  const options = {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  const dateOptions = {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  const time = new Intl.DateTimeFormat('de-DE', options).format(now);
  const dateParts = new Intl.DateTimeFormat('de-DE', dateOptions).format(now).split('.');
  const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

  document.getElementById("clock").textContent = "Time: " + time;
  document.getElementById("currentDate").textContent = "Date: " + formattedDate;
}

let calendarBase = new Date();
function shiftCalendar(offset) {
  calendarBase.setMonth(calendarBase.getMonth() + offset);
  renderCalendars();
}

function renderCalendars() {
  const container = document.getElementById("calendarArea");
  container.innerHTML = "";
  for (let i = 0; i < 2; i++) {
    const current = new Date(calendarBase.getFullYear(), calendarBase.getMonth() + i);
    container.innerHTML += generateCalendar(current.getFullYear(), current.getMonth());
  }
}

function generateCalendar(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  let html = `<div class="calendar-table"><h4>${monthName} ${year}</h4><table><thead><tr><th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;
  let day = 1;
  let started = false;

  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 1; j <= 7; j++) {
      const realDay = (j + 6) % 7;
      if (!started && realDay === firstDay) started = true;

      if (started && day <= daysInMonth) {
        const matches = requestData.filter(x => x.date.getDate() === day && x.date.getMonth() === month && x.date.getFullYear() === year);
        const hasEscort = matches.some(m => m.apronSupport);
const marked = matches.length ? "marked" : "";
const apron = hasEscort ? "apron" : "";
        const tooltip = matches.length
  ? matches.map(m =>
      `✈️ ${m.ref} – ${m.airline}
Flugnummer: ${m.flightNumber || '–'}
Geplante Zeit: ${m.flightTime || '–'}
Tonnage: ${m.tonnage.toLocaleString('de-DE')} kg`
    ).join('\n')
  : "";
        const onclick = matches.length ? `onclick=\"openDetails('${matches[0].ref}')\"` : "";
        html += `<td class="${marked} ${apron}" title="${tooltip}" style="cursor:pointer;" ${onclick}>${day}</td>`;
        day++;
      } else {
        html += "<td></td>";
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';
  fetch(url)
    .then(response => response.json())
    .then(data => {
      requestData = data.map(row => ({
        ref: row["Ref"],
          flightNumber: row["Flugnummer"],
        date: new Date(row["Flight Date"]),
        airline: row["Airline"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"]) || 0,
        apronSupport: row["Vorfeldbegleitung"] === "TRUE" // oder "Ja"
      }));
      populateRows();
    })
    .catch(error => console.error("Fehler beim Laden:", error));

  setInterval(updateClock, 1000);
  updateClock();
});

function saveExtrasToGoogleSheet(ref, finalWeight, extraCharges, rate, departureTime, escort, flightNumber) {
  const url = "https://script.google.com/macros/s/AKfycbw2c2PSZlsKNGnQXFjhtpmezSSB_67D1BD3gt1jgVveY791Bb8inDIg4y0yb1Zhq_rm/exec";

  const formData = new URLSearchParams();
  formData.append("mode", "updateExtras");
  formData.append("ref", ref);
  formData.append("finalWeight", finalWeight);
  formData.append("extraCharges", extraCharges);
  formData.append("rate", rate);
  formData.append("departureTime", departureTime);
  formData.append("escort", escort ? "Ja" : "Nein");
  formData.append("flightnumber", flightNumber);

  fetch(url, {
    method: "POST",
    body: formData
  })
    .then(response => response.text())
    .then(result => {
      console.log("Gespeichert:", result);
      alert("Änderungen gespeichert!");
    })
    .catch(error => {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern!");
    });
}
// ESC zum Schließen des Detailmodals
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
  }
});
