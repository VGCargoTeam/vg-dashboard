
const SHEET_URL = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';
const POST_URL = 'https://script.google.com/macros/s/AKfycbw4kB0t6-K2oLpC8oOMhMsLvFa-bziRGmt589yC9rMjSO15vpgHzDZwgOQpHkxfykOw/exec';
let requestData = [];

function fetchData() {
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      requestData = data;
      populateTable();
    });
}

function populateTable() {
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  requestData.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><button onclick="openModal(${idx})">${row.Ref}</button></td>
      <td>${row['Flight Date']}</td>
      <td>${row.Airline || "-"}</td>
      <td>${row.Tonnage || "-"}</td>
      <td>${row['Contact Email'] || "-"}</td>
      <td><button onclick="openModal(${idx})">View</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function openModal(index) {
  const row = requestData[index];
  const modal = document.getElementById("detailModal");
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = Object.keys(row).map(key => {
    if (key === "Email Request") {
      return `<p><strong>${key}:</strong><br><textarea disabled>${row[key]}</textarea></p>`;
    }
    return `<p><strong>${key}:</strong><br><input name="${key}" value="${row[key] || ""}" /></p>`;
  }).join('') + `<input type="hidden" name="Ref" value="${row.Ref}" />`;
  modal.style.display = "flex";
}

function saveDetails() {
  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled])");
  const data = {};
  inputs.forEach(i => data[i.name] = i.value);
  fetch(POST_URL, {
    method: 'POST',
    body: new URLSearchParams({ mode: "updateExtras", ...data })
  }).then(() => {
    alert("Gespeichert!");
    document.getElementById("detailModal").style.display = "none";
    fetchData();
  });
}

document.addEventListener("DOMContentLoaded", fetchData);
