
const SHEET_URL = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';
const POST_URL = 'https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec';
const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";
let requestData = [];
let baseMonth = new Date().getMonth();
let baseYear = new Date().getFullYear();

function fetchData() {
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      requestData = data;
      renderTable();
      renderCalendars();
    });
}

function renderTable() {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  let totalFlights = 0;
  let totalWeight = 0;

  requestData.forEach((r, i) => {
    const row = document.createElement("tr");
    const ton = parseFloat(r.Tonnage || "0") || 0;
    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${i})">${r.Ref}</a></td>
      <td>${r['Flight Date'] || "-"}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toLocaleString()}</td>
      <td>${r['Contact Email'] || "-"}</td>
      <td><button class="btn btn-view" onclick="openModal(${i})">View</button> <button class="btn btn-delete" onclick="deleteRow(this)">Delete</button></td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toLocaleString()} kg`;
}

function openModal(i) {
  const r = requestData[i];
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = "";

  const leftFields = [
    { label: "Ref", key: "Ref" },
    { label: "Datum", key: "Flight Date" },
    { label: "Billing Company", key: "Billing Company" },
    { label: "Billing Address", key: "Billing Address" },
    { label: "Tax Number", key: "Tax Number" },
    { label: "Contact Name (Invoicing)", key: "Contact Name Invoicing" },
    { label: "Contact E-Mail (Invoicing)", key: "Contact E-Mail Invoicing" }
  ];

  const rightFields = [
    { label: "Airline", key: "Airline" },
    { label: "Flugzeugtyp", key: "1" },
    { label: "Flugnummer", key: "Flugnummer" },
    { label: "Flight Date", key: "Flight Date" },
    { label: "Abflugzeit", key: "Abflugzeit" },
    { label: "Tonnage", key: "Tonnage" },
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" }
  ];

  const left = document.createElement("div");
  left.className = "modal-col";
  leftFields.forEach(({ label, key }) => {
    const value = r[key] || "";
    left.innerHTML += `
      <label>${label}:</label>
      <input name="${key}" value="${value}" />
    `;
  });

  const right = document.createElement("div");
  right.className = "modal-col";
  rightFields.forEach(({ label, key, type }) => {
    const value = r[key] || "";
    if (type === "checkbox") {
      const checked = value.toLowerCase() === "ja" ? "checked" : "";
      right.innerHTML += `
        <label><input type="checkbox" name="${key}" ${checked} /> ${label}</label>
      `;
    } else {
      right.innerHTML += `
        <label>${label}:</label>
        <input name="${key}" value="${value}" />
      `;
    }
  });

  const wrapper = document.createElement("div");
  wrapper.id = "modalBody";
  wrapper.appendChild(left);
  wrapper.appendChild(right);

  const email = document.createElement("div");
  email.style.width = "100%";
  email.innerHTML = `
    <label>E-Mail Request:</label>
    <textarea name="Email Request" style="height:150px">${r["Email Request"] || ""}</textarea>
  `;

  modalBody.appendChild(wrapper);
  modalBody.appendChild(email);

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
  inputs.forEach(i => data[i.name] = i.type === "checkbox" ? (i.checked ? "Ja" : "Nein") : i.value);
  data.mode = "updateExtras";

  fetch(POST_URL, {
    method: 'POST',
    body: new URLSearchParams(data)
  }).then(() => {
    alert("Gespeichert!");
    closeModal();
    fetchData();
  });
}

function deleteRow(btn) {
  btn.closest("tr").remove();
}

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

function generateCalendarHTML(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th><th>Su</th></tr></thead><tbody>`;
  let day = 1;
  for (let i = 0; i < 6; i++) {
    html += "<tr>";
    for (let j = 1; j <= 7; j++) {
      const realDay = (j + 6) % 7;
      if ((i === 0 && realDay < firstDay) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const match = requestData.find(r => r['Flight Date'] === dateStr);
        const tooltip = match ? `${match['Flugnummer'] || ''} ${match['Abflugzeit'] || ''}` : "";
        const mark = match ? "marked" : "";
        html += `<td class='${mark}' title='${tooltip}'>${day}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break;
  }
  html += "</tbody></table></div>";
  return html;
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);
  fetchData();
});

function updateClock() {
  const now = new Date();
  const local = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  document.getElementById('currentDate').textContent = "Date: " + local.toISOString().substr(0, 10);
  document.getElementById('clock').textContent = "Time: " + local.toISOString().substr(11, 8);
}
