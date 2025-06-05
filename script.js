
document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';

  fetch(url)
    .then(response => response.json())
    .then(data => {
      requestData = data.map(row => ({
        ref: row["Ref"],
        date: row["Datum"],
        airline: row["Airline"],
        billingCompany: row["Billing Company"],
        billingAddress: row["Billing Address"],
        taxNumber: row["Tax Number"],
        contactName: row["Contact Name"],
        contactEmail: row["Contact Email"],
        emailRequest: row["Email Request"],
        tonnage: parseFloat(row["Tonnage"]) || 0,
        rampSupport: row["Ramp Support"] === "Ja"
      }));
      populateRows();
    })
    .catch(error => console.error("Fehler beim Laden:", error));
});

window.openDetails = function(ref) {
  const r = requestData.find(r => r.ref === ref);
  if (r) {
    document.getElementById("modalRef").value = r.ref;
    document.getElementById("viewRef").textContent = r.ref;
    document.getElementById("viewAirline").textContent = r.airline;
    document.getElementById("viewDate").textContent = r.date;
    document.getElementById("viewTonnage").textContent = r.tonnage + " kg";
    document.getElementById("viewBillingCompany").textContent = r.billingCompany || "-";
    document.getElementById("viewBillingAddress").textContent = r.billingAddress || "-";
    document.getElementById("viewTaxNumber").textContent = r.taxNumber || "-";
    document.getElementById("viewContactName").textContent = r.contactName || "-";
    document.getElementById("viewContactEmail").textContent = r.contactEmail || "-";
    document.getElementById("viewEmailRequest").textContent = r.emailRequest || "-";

    if (document.getElementById("fieldRamp")) {
      document.getElementById("fieldRamp").checked = r.rampSupport === true;
    }

    document.getElementById("detailModal").style.display = "block";
  }
};
