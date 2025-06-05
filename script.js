
document.addEventListener('DOMContentLoaded', function () {
  const url = 'https://opensheet.elk.sh/1kCifgCFSK0lnmkqKelekldGwnMqFDFuYAFy2pepQvlo/CharterRequest';
  const tbody = document.querySelector('tbody');

  fetch(url)
    .then(response => response.json())
    .then(data => {
      tbody.innerHTML = '';
      data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>{row['Reference'] || ''}</td>
          <td>{row['Planned Flight Date'] || ''}</td>
          <td>{row['Airline'] || ''}</td>
          <td>{row['Contact Email'] || ''}</td>
          <td>{row['Tonnage (kg)'] || ''}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      tbody.innerHTML = '<tr><td colspan="5">Fehler beim Laden der Daten.</td></tr>';
      console.error('Datenladefehler:', error);
    });
});
