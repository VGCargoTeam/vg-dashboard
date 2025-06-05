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
        tonnage: parseFloat(row["Tonnage"]) || 0
      }));
      populateRows(); // aus index.html
    })
    .catch(error => console.error("Fehler beim Laden:", error));
});
