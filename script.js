document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';

  fetch(url)
    .then(response => response.json())
    .then(data => {
      window.requestData = data.map(row => ({
        ref: row["Ref"],
        date: row["Datum"],
        airline: row["Airline"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"].replace(",", ".")) || 0,
        apronEscort: row["Apron Escort"] || "Nein"
      }));

      populateRows();
      renderCalendars();
    })
    .catch(error => console.error("Fehler beim Laden der Daten:", error));
});

function populateRows() {
  const table = document.getElementById("dataTable");
  table.innerHTML = "";
  let totalTonnage = 0;

  window.requestData.forEach(r => {
    totalTonnage += r.tonnage;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a href="#" onclick="openDetails('${r.ref}')">${r.ref}</a></td>
      <td>${formatDateTime(r.date)}</td>
      <td>${r.airline}</td>
      <td>${formatTonnage(r.tonnage)}</td>
      <td><button class="delete-btn" onclick="deleteRequest('${r.ref}')">Delete</button></td>
    `;
    table.appendChild(row);
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${window.requestData.length} | Total Tonnage: ${formatTonnage(totalTonnage)}`;
}

// Format Tonnage: 12001,50
function formatTonnage(kg) {
  return kg.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + " kg";
}

// Format DateTime zu DD.MM.YYYY HH:mm:ss
function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE");
}

// Uhrzeit inkl. deutscher Zeitzone + DST
function updateClock() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'short',
    timeStyle: 'medium'
  });
  const parts = formatter.formatToParts(now);
  const date = parts.find(p => p.type === 'day').value + "." +
               parts.find(p => p.type === 'month').value + "." +
               parts.find(p => p.type === 'year').value;
  const time = parts.find(p => p.type === 'hour').value + ":" +
               parts.find(p => p.type === 'minute').value + ":" +
               parts.find(p => p.type === 'second').value;

  document.getElementById("clock").textContent = "Time: " + time;
  document.getElementById("currentDate").textContent = "Date: " + date;
}
setInterval(updateClock, 1000);
updateClock();

// Kalender mit Tooltip
function renderCalendars() {
  const calendarArea = document.getElementById("calendarArea");
  calendarArea.innerHTML = "";

  const base = new Date();
  for (let m = 0; m < 2; m++) {
    const month = new Date(base.getFullYear(), base.getMonth() + m, 1);
    calendarArea.appendChild(generateCalendar(month));
  }
}

function generateCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendar = document.createElement("div");
  calendar.className = "calendar-table";
  const monthName = date.toLocaleString("de-DE", { month: "long" });

  let html = `<h4>${monthName} ${year}</h4><table><thead><tr>
  <th>Mo</th><th>Di</th><th>Mi</th><th>Do</th><th>Fr</th><th>Sa</th><th>So</th></tr></thead><tbody>`;

  let day = 1;
  const start = new Date(year, month, 1).getDay();
  let started = false;

  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 1; j <= 7; j++) {
      const weekday = (j + 6) % 7;
      if (!started && weekday === start) started = true;

      if (started && day <= daysInMonth) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const match = window.requestData.find(x => x.date.startsWith(dateStr));
        const tooltip = match ? `${match.ref}\n${match.airline}\n${formatTonnage(match.tonnage)}` : "";
        const marked = match ? "marked" : "";
        html += `<td class='${marked}' title="${tooltip}">${day}</td>`;
        day++;
      } else {
        html += "<td></td>";
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }

  html += "</tbody></table>";
  calendar.innerHTML = html;
  return calendar;
}

// Dummy Funktion – hier kann später Google Sheets Delete eingebaut werden
function deleteRequest(ref) {
  if (confirm(`Möchtest du ${ref} wirklich löschen?`)) {
    window.requestData = window.requestData.filter(r => r.ref !== ref);
    populateRows();
    renderCalendars();
    // TODO: Google Sheets Delete per API
  }
}

// TODO: Funktion für Vorfeldbegleitung Checkbox beim openDetails()
