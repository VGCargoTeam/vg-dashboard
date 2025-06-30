// Charter Dashboard Script – 3-spaltige strukturierte Detailansicht
const API_URL = 'https://script.google.com/macros/s/AKfycbxlkY1f94D26BKvs7oeiNUhOJHEycsox3J61kb4iN7z_3frXRzfB8sCuCnWQVbFgk88/exec'; // <<< VERIFIZIERE DIESE URL

// !!! WICHTIG: Die users.js-Importzeile wird entfernt, da die Benutzerdaten nun aus Google Sheets kommen. !!!
// import { users } from './users.js'; 

let currentUser = null; // Stores the currently logged-in user
let requestData = []; // Stores all fetched charter data
let baseMonth = new Date().getMonth(); // Current month (0-indexed)
let baseYear = new Date().getFullYear(); // Current year

const today = new Date();
today.setHours(0, 0, 0, 0); // Sets the time to midnight for comparison

// === AUTHENTICATION AND USER MANAGEMENT ===
function checkAuthStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    // Since user data now comes from Google Sheets, we no longer need a users file check here.
    // We trust that the currentUser object is valid if it's in localStorage.
    updateUIBasedOnUserRole();
    fetchData(); // Load data if logged in
  } else {
    // If not logged in, redirect to the login page
    window.location.href = 'login.html'; 
  }
}

function updateUIBasedOnUserRole() {
  const adminElements = document.querySelectorAll(".admin-only");
  const loggedInUsernameSpan = document.getElementById('loggedInUsername');
  const loggedInUserRoleSpan = document.getElementById('loggedInUserRole');

  if (currentUser) {
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = currentUser.name;
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = currentUser.role;

    if (currentUser.role === 'admin') {
      adminElements.forEach(el => el.style.display = ""); // Standard display
    } else {
      adminElements.forEach(el => el.style.display = "none"); // Hide
    }
  } else {
    // If no user is logged in (should be caught by checkAuthStatus)
    adminElements.forEach(el => el.style.display = "none");
    if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = 'N/A';
    if (loggedInUserRoleSpan) loggedInUserRoleSpan.textContent = 'N/A';
  }
}

function openProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) { // Ensure the modal exists
    profileModal.style.display = 'flex'; // Show modal
    // Set initial values
    const newPassInput = document.getElementById('newPasswordInput');
    const confirmPassInput = document.getElementById('confirmPasswordInput');
    const passwordChangeMessage = document.getElementById('passwordChangeMessage');
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
    if (passwordChangeMessage) passwordChangeMessage.textContent = '';
  } else {
    console.warn("Profile modal (id='profileModal') not found.");
  }
}

function closeProfileModal() {
  const profileModal = document.getElementById('profileModal');
  if (profileModal) {
    profileModal.style.display = 'none'; // Close modal
  }
}

async function changePassword() {
  const oldPass = prompt("Please enter your current password to confirm the change:"); // For security, ask for current password
  if (oldPass === null) { // User cancelled
      return;
  }

  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;
  const messageElem = document.getElementById('passwordChangeMessage');

  if (!messageElem) {
    console.error("Password change message element not found.");
    return;
  }

  if (newPass === '' || confirmPass === '') {
    messageElem.textContent = 'Please fill in both password fields.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass !== confirmPass) {
    messageElem.textContent = 'New passwords do not match.';
    messageElem.style.color = 'red';
    return;
  }
  if (newPass.length < 6) { // Example: Minimum length
      messageElem.textContent = 'Password must be at least 6 characters long.';
      messageElem.style.color = 'red';
      return;
  }
  if (currentUser.username === undefined) {
      messageElem.textContent = 'Username for password change not available.';
      messageElem.style.color = 'red';
      return;
  }

  const payload = {
      mode: 'updatePassword',
      username: currentUser.username, // The user whose password is to be changed
      oldPassword: oldPass, // Current password for verification
      newPassword: newPass, // New password
      user: currentUser.name // For audit log
  };

  try {
      const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
          messageElem.textContent = 'Password changed successfully! Please log in again.';
          messageElem.style.color = 'green';
          // Clear fields after successful change
          const newPassInput = document.getElementById('newPasswordInput');
          const confirmPassInput = document.getElementById('confirmPasswordInput');
          if (newPassInput) newPassInput.value = '';
          if (confirmPassInput) confirmPassInput.value = '';
          
          // Optional: Automatic logout after successful password change
          setTimeout(() => {
              logoutUser(); 
          }, 2000);

      } else {
          messageElem.textContent = result.message || 'Error changing password.';
          messageElem.style.color = 'red';
      }
  } catch (error) {
      console.error('Password change error:', error);
      messageElem.textContent = 'An error occurred while changing the password. Please try again later.';
      messageElem.style.display = 'block'; // Make sure the message is visible
  }
}

function logoutUser() {
  localStorage.removeItem('currentUser'); // End session
  currentUser = null;
  window.location.href = 'login.html'; // Redirect to login page
}

// === DATA RETRIEVAL AND TABLE RENDERING ===
function fetchData() {
  fetch(API_URL + "?mode=read")
    .then(r => {
      if (!r.ok) {
        throw new Error(`HTTP error! Status: ${r.status}`);
      }
      return r.json();
    })
    .then(d => {
      requestData = d.data; // Stores the array of data
      console.log("Raw data from API:", JSON.parse(JSON.stringify(d.data))); // For debugging
      filterTable(); // Calls filterTable to update both table and calendar
    })
    .catch((error) => {
      console.error("Error loading data:", error);
      showSaveFeedback("Error loading data!", false);
    });
}

function renderTable(dataToRender = requestData) { // Allows rendering of filtered data
  const tbody = document.querySelector("#dataTable tbody");
  tbody.innerHTML = "";
  let totalFlights = 0;
  let totalWeight = 0;

  dataToRender.forEach((r) => { // Use dataToRender
    const row = document.createElement("tr");
    // Remove VAL: prefix and then replace comma with dot for parseFloat
    const ton = parseFloat(String(r.Tonnage).replace('VAL:', '').replace(',', '.') || "0") || 0; 
    
    const originalIndex = requestData.findIndex(item => item.Ref === r.Ref); 

    // Format date correctly for display (DD.MM.YYYY)
    let displayFlightDate = r['Flight Date'] || "-";
    if (displayFlightDate !== "-") {
        try {
            // Robust date parsing to avoid timezone issues
            let dateObj;
            if (typeof displayFlightDate === 'string' && displayFlightDate.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
                const parts = displayFlightDate.split('-');
                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else if (displayFlightDate instanceof Date) { // If it's directly a Date object (rare, but for safety)
                dateObj = new Date(displayFlightDate.getFullYear(), displayFlightDate.getMonth(), displayFlightDate.getDate());
            } else {
                dateObj = new Date('Invalid Date'); // Invalid date
            }

            // Ensure time is set to midnight for consistency
            dateObj.setHours(0, 0, 0, 0); 
            
            console.log(`[renderTable] Original: "${r['Flight Date']}", Parsed (Local): ${dateObj}`); // For debugging

            if (!isNaN(dateObj.getTime())) { 
                displayFlightDate = dateObj.toLocaleDateString('de-DE'); 
                console.log(`[renderTable] Formatted (de-DE): ${displayFlightDate}`);
            }
        } catch (e) {
             console.error("Error converting date for table display:", displayFlightDate, e);
        }
    }

    const deleteButtonHTML = (currentUser && currentUser.role === 'admin') ? `<button class="btn btn-delete admin-only" onclick="deleteRow(this)">Delete</button>` : '';

    row.innerHTML = `
      <td><a href="javascript:void(0);" onclick="openModal(${originalIndex})" class="text-blue-600 hover:text-blue-800 hover:underline font-semibold">${r.Ref}</a></td>
      <td>${displayFlightDate}</td>
      <td>${r.Airline || "-"}</td>
      <td>${ton.toString()}</td> <td>
        <button class="btn btn-view" onclick="openModal(${originalIndex})">View</button> 
        ${deleteButtonHTML}
      </td>
    `;
    tbody.appendChild(row);
    totalFlights++;
    totalWeight += ton;
  });

  // Display tonnage in summary without thousands separator
  document.getElementById("summaryInfo").textContent =
    `Total Flights: ${totalFlights} | Total Tonnage: ${totalWeight.toFixed(0)} kg`; 
  
  updateUIBasedOnUserRole();
}

function filterTable() {
  const refSearch = document.getElementById("refSearch").value.toLowerCase();
  const airlineSearch = document.getElementById("airlineSearch").value.toLowerCase();
  const flightNumberSearchInput = document.getElementById("flightNumberSearch");
  const flightNumberSearch = flightNumberSearchInput ? flightNumberSearchInput.value.toLowerCase() : '';
  const fromDateInput = document.getElementById("fromDate").value; 
  const toDateInput = document.getElementById("toDate").value;     
  const showArchive = document.getElementById("archiveCheckbox") ? document.getElementById("archiveCheckbox").checked : false; // Archive checkbox, if present

  const filtered = requestData.filter(r => {
    const matchesRef = (r.Ref || '').toLowerCase().includes(refSearch);
    const matchesAirline = (r.Airline || '').toLowerCase().includes(airlineSearch);
    const matchesFlightNumber = (r.Flugnummer || '').toLowerCase().includes(flightNumberSearch); 

    let matchesDateRange = true; 
    let isPastOrTodayAndGoneFlight = false;    

    let flightDateFromData = r['Flight Date'];
    let flightDateObj; // Corrected: Use flightDateObj consistently

    // Robust date parsing to avoid timezone issues
    if (typeof flightDateFromData === 'string' && flightDateFromData.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
        const parts = flightDateFromData.split('-');
        flightDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])); // Corrected: Assign to flightDateObj
    } else if (flightDateFromData instanceof Date) { // If it's directly a Date object
        flightDateObj = new Date(flightDateFromData.getFullYear(), flightDateFromData.getMonth(), flightDateFromData.getDate()); // Corrected: Assign to flightDateObj
    } else {
        flightDateObj = new Date('Invalid Date'); // Invalid date // Corrected: Assign to flightDateObj
    }
    
    // This line will now always have a defined flightDateObj
    flightDateObj.setHours(0, 0, 0, 0); 
    console.log(`[filterTable] Original: "${flightDateFromData}", Parsed (Local): ${flightDateObj}`);


    if (flightDateObj && !isNaN(flightDateObj.getTime())) {
      if (flightDateObj < today) {
          isPastOrTodayAndGoneFlight = true;
      } else if (flightDateObj.getTime() === today.getTime()) {
          const abflugzeit = r['Abflugzeit']; 
          if (abflugzeit) {
              // Departure time must also be parsed as a local time for comparison
              let flightTimeAsDate = new Date();
              if (typeof abflugzeit === 'string' && abflugzeit.match(/^\d{2}:\d{2}$/)) { // Expects HH:MM from backend
                  const [hours, minutes] = abflugzeit.split(':').map(Number);
                  flightTimeAsDate.setHours(hours, minutes, 0, 0);
              } else if (abflugzeit instanceof Date) {
                  flightTimeAsDate = abflugzeit; // If already a Date object
              } else {
                 flightTimeAsDate = new Date('Invalid Date');
              }
              
              const now = new Date(); 
              now.setSeconds(0, 0); 
              now.setMilliseconds(0); 

              if (!isNaN(flightTimeAsDate.getTime()) && flightTimeAsDate <= now) { 
                  isPastOrTodayAndGoneFlight = true;
              }
          }
      }

      // Filter by date range
      if (fromDateInput) {
          const fromDateParts = fromDateInput.split('-');
          const fromDateObj = new Date(parseInt(fromDateParts[0]), parseInt(fromDateParts[1]) - 1, parseInt(fromDateParts[2]));
          fromDateObj.setHours(0,0,0,0); // Also set filter date to midnight
          if (flightDateObj < fromDateObj) matchesDateRange = false;
      }
      if (toDateInput) {
          const toDateParts = toDateInput.split('-');
          const toDateObj = new Date(parseInt(toDateParts[0]), parseInt(toDateParts[1]) - 1, parseInt(toDateParts[2]));
          toDateObj.setHours(0,0,0,0); // Also set filter date to midnight
          if (flightDateObj > toDateObj) matchesDateRange = false;
      }
    } else {
        isPastOrTodayAndGoneFlight = false; 
    }

    const passesPastFlightFilter = showArchive || !isPastOrTodayAndGoneFlight;

    return matchesRef && matchesAirline && matchesFlightNumber && matchesDateRange && passesPastFlightFilter;
  });
  renderTable(filtered); 
  renderCalendars(); 
}

// === MODAL FUNCTIONS ===
function openModal(originalIndex) {
  if (!currentUser) {
      console.error("Attempting to open modal without logged-in user. Redirecting to login.");
      window.location.href = 'login.html'; 
      return;
  }

  const r = originalIndex === -1 ? {
    Ref: generateReference(),
    'Created At': new Date().toLocaleString('de-DE'), 
    'Billing Company': "", 'Billing Address': "", 'Tax Number': "",
    'Contact Name Invoicing': "", 'Contact E-Mail Invoicing': "",
    'Airline': "", 'Aircraft Type': "", 'Flugnummer': "",
    'Flight Date': "", 'Abflugzeit': "", 'Tonnage': "",
    'Rate': "", 'Security charges': "", "Dangerous Goods": "Nein", // Default value "No"
    '10ft consumables': "", '20ft consumables': "",
    'Zusatzkosten': "", 'Email Request': "",
    'AGB Accepted': "Ja", // Default value "Yes" for new requests
    'Service Description Accepted': "Ja", // Default value "Yes" for new requests
    'Accepted By Name': "", 
    'Acceptance Timestamp': "",
    'Export': "Nein", // Initial value for Export
    'Import': "Nein"  // Initial value for Import
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
    // Helper function to format numbers for display
    const formatNumberForDisplay = (num, minFractionDigits = 0, maxFractionDigits = 0) => {
      // Ensure num is a valid number, default to 0 if not
      // NEW: First remove the 'VAL:' prefix if present
      let valueToParse = String(num);
      if (valueToParse.startsWith('VAL:')) {
          valueToParse = valueToParse.substring(4);
      }
      // Then replace comma with dot and parse (in case the backend sent a comma)
      const numericVal = parseFloat(valueToParse.replace(',', '.') || "0") || 0;
      // Then format for display in German format (comma as decimal separator)
      return numericVal.toLocaleString('de-DE', {
        minimumFractionDigits: minFractionDigits,
        maximumFractionDigits: maxFractionDigits
      });
    };

    return fields.map(({ label, key, type }) => {
      let value = r[key];
      if (value === undefined || value === null) value = "";
      
      const isAlwaysReadOnlyField = [
          "Ref", "Created At", "Acceptance Timestamp", "Accepted By Name", "Email Request"
      ].includes(key);

      let readOnlyAttr = '';
      let styleAttr = '';

      if (isAlwaysReadOnlyField) {
          readOnlyAttr = 'readonly';
          styleAttr = 'background-color:#eee; cursor: not-allowed;';
      } else if (currentUser && currentUser.role === 'viewer') {
          // Viewers are allowed to see but not edit all fields except always read-only fields
          readOnlyAttr = ''; 
          styleAttr = ''; 
      }
      
      // Special handling for price-related fields so they are not shown to Viewers
      const isPriceRelatedField = [ 
        'Rate', 'Security charges', 'Dangerous Goods', 
        '10ft consumables', '20ft consumables', 'Zusatzkosten' 
      ].includes(key);

      // Skip rendering these fields for viewers
      if (isPriceRelatedField && currentUser.role === 'viewer') {
          return ''; // Empty string to skip the field
      }


      if (key === "Flight Date") {
        let dateValue = "";
        if (value) {
            try {
                // Parse date to display correctly in the input (YYYY-MM-DD format)
                if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) { // Expects YYYY-MM-DD from backend
                    dateValue = value;
                } else if (value instanceof Date) {
                    dateValue = value.toISOString().split('T')[0]; // Convert Date object to YYYY-MM-DD
                }
            } catch (e) {
                console.error("Error parsing Flight Date for modal input:", value, e);
            }
        }
        return `<label>${label}</label><input type="date" name="${key}" value="${dateValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "Abflugzeit") {
        let timeValue = "";
        if (value) {
            if (typeof value === 'string' && value.match(/^\d{2}:\d{2}$/)) { // Expects HH:MM from backend
                timeValue = value;
            } else if (value instanceof Date) { // If Date object
                timeValue = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            }
        }
        return `<label>${label}:</label><input type="time" name="${key}" value="${timeValue}" ${readOnlyAttr} style="${styleAttr}">`;
      } else if (key === "AGB Accepted" || key === "Service Description Accepted") { 
          // Always display a green checkmark, as the customer MUST accept the terms to send a request.
          const icon = '&#10004;'; // Green checkmark
          const color = 'green';
          return `<label>${label}: <span style="color: ${color}; font-size: 1.2em; font-weight: bold;">${icon}</span></label>`;
      } else if ( (key === "Vorfeldbegleitung" || key === "Export" || key === "Import") && type === "checkbox") { // Handle Export/Import as checkboxes
        const checked = String(value).toLowerCase() === "ja" ? "checked" : "";
        return `<label><input type="checkbox" name="${key}" ${checked} ${readOnlyAttr} style="${styleAttr}"> ${label}</label>`;
      } else if (key === 'Tonnage') { // Tonnage can be seen and edited by Viewers
          // Tonnage: no decimal places
          return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 0, 0)}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (['Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(key)) {
          // Rate and other consumables: 2 decimal places
          return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 2, 2)}" ${readOnlyAttr} style="${styleAttr}" />`;
      } else if (key === "Dangerous Goods") { // Separate handling for Dangerous Goods
          const options = ["Ja", "Nein"];
          let selectHTML = `<label>${label}:</label><select name="${key}" ${readOnlyAttr} style="${styleAttr}">`;
          options.forEach(option => {
              const selected = (value === option) ? "selected" : "";
              selectHTML += `<option value="${option}" ${selected}>${option}</option>`;
          });
          selectHTML += `</select>`;
          return selectHTML;
      } else if (key === "Zusatzkosten") { // Special handling for Additional Costs in detail view
            return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      } else if (key === "Email Request") { // Handling for Email Request
          return `<label>${label}:</label><textarea name="${key}" rows="5" ${readOnlyAttr} style="${styleAttr}">${value}</textarea>`;
      }
      return `<label>${label}:</label><input type="text" name="${key}" value="${value}" ${readOnlyAttr} style="${styleAttr}" />`;
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
    { label: "AGB Accepted", key: "AGB Accepted" }, 
    { label: "Service Description Accepted", key: "Service Description Accepted" }, 
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
    { label: "Vorfeldbegleitung", key: "Vorfeldbegleitung", type: "checkbox" },
    { label: "E-Mail Request", key: "Email Request" },
    { label: "Export", key: "Export", type: "checkbox" }, // NEW: Export checkbox
    { label: "Import", key: "Import", type: "checkbox" }  // NEW: Import checkbox
  ];

  // Price-related fields, visible only to admins
  const priceFields = [
    { label: "Rate", key: "Rate" },
    { label: "Security charges (X-Ray, ETD, EDD)", key: "Security charges" },
    { label: "Dangerous Goods", key: "Dangerous Goods" },
    { label: "10ft consumables", key: "10ft consumables" },
    { label: "20ft consumables", key: "20ft consumables" },
    { label: "Zusatzkosten", key: "Zusatzkosten", type: "textarea" } // Additional costs as textarea
  ];

  modalBody.appendChild(section("Customer Details", renderFields(customerFields)));
  modalBody.appendChild(section("Flight Details", renderFields(flightFields)));
  
  // Display price details only for admins
  if (currentUser && currentUser.role === 'admin') { 
    // Create HTML for price details
    let priceDetailsHTML = priceFields.map(({ label, key, type }) => {
        let value = r[key] || "";
        if (key === "Zusatzkosten") {
            // Ensure textarea for additional costs is rendered correctly
            return `<label>${label}:</label><textarea name="${key}" placeholder="Labeling, Photos" style="height:80px">${value}</textarea>`;
        } else if (key === "Dangerous Goods") { // Handle Dangerous Goods as a select dropdown
            const options = ["Ja", "Nein"];
            let selectHTML = `<label>${label}:</label><select name="${key}">`;
            options.forEach(option => {
                const selected = (value === option) ? "selected" : "";
                selectHTML += `<option value="${option}" ${selected}>${option}</option>`;
            });
            selectHTML += `</select>`;
            return selectHTML;
        } else {
            // Use formatNumberForDisplay for Rate and other consumables
            return `<label>${label}:</label><input type="text" name="${key}" value="${formatNumberForDisplay(value, 2, 2)}" />`;
        }
    }).join("");
    
    modalBody.appendChild(section("Price Details", priceDetailsHTML));
  } else {
    // If not admin, do not display price details (the section itself is not added)
  }

  const buttonContainer = document.createElement("div");
  buttonContainer.style.width = "100%";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "center"; 
  buttonContainer.style.gap = "10px"; 
  buttonContainer.style.marginTop = "20px";

  // Save button is available for all logged-in users
  if (currentUser) {
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.onclick = saveDetails;
    saveButton.style.padding = "10px 20px";
    saveButton.style.fontWeight = "bold";
    saveButton.style.backgroundColor = "#28a745";
    saveButton.style.color = "white";
    saveButton.style.border = "none";
    saveButton.style.borderRadius = "6px";
    saveButton.style.cursor = "pointer";
    buttonContainer.appendChild(saveButton);
  }

  const historyButton = document.createElement("button");
  historyButton.textContent = "History";
  historyButton.style.padding = "10px 20px";
  historyButton.style.fontWeight = "bold";
  historyButton.style.backgroundColor = "#17a2b8"; 
  historyButton.style.color = "white";
  historyButton.style.border = "none";
  historyButton.style.borderRadius = "6px";
  historyButton.style.cursor = "pointer";
  historyButton.onclick = () => showHistory(r.Ref); 
  buttonContainer.appendChild(historyButton);

  if (currentUser && currentUser.role === 'admin' && originalIndex !== -1) { 
    const deleteButtonModal = document.createElement("button");
    deleteButtonModal.textContent = "Delete Entry";
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
  
  modalBody.appendChild(buttonContainer); 

  modal.style.display = "flex";
}

// New function that starts the deletion process from the modal and then closes the modal
async function deleteRowFromModal(ref) {
  // Instead of alert(), use a custom confirmation as alert() does not work well in iframes
  const isConfirmed = confirm(`Do you really want to delete the entry with reference "${ref}"? This action cannot be undone.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name 
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, 
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json(); 

    if (responseData && responseData.status === "success") { 
      showSaveFeedback("Entry deleted!", true);
    } else {
      showSaveFeedback(`Error deleting entry! ${responseData.message || ''}`, false);
      console.error("Deletion failed:", responseData);
    }
    closeModal(); 
    fetchData(); 
  } catch (err) {
    showSaveFeedback("Error deleting!", false);
    console.error(err);
  }
}

function closeModal() {
  document.getElementById("detailModal").style.display = "none";
}

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeHistoryModal(); 
    closeProfileModal(); 
  }
});

async function saveDetails() {
  // Instead of alert(), use a custom confirmation
  const isConfirmed = confirm('Are you sure you want to save these changes?');
  if (!isConfirmed) {
    return;
  }

  const inputs = document.querySelectorAll("#modalBody input[name]:not([disabled]), #modalBody textarea[name]:not([disabled]), #modalBody select[name]:not([disabled])"); // Add select to query
  const data = {};
  inputs.forEach(i => {
    if (i.name === "Flight Date") {
        data[i.name] = i.value; 
    } else if (['Tonnage', 'Rate', 'Security charges', '10ft consumables', '20ft consumables'].includes(i.name)) { // Remove Dangerous Goods from this list
        // Tonnage and price fields: Replace commas with dots and remove Euro symbol and spaces
        // Here the value is prepared for sending to the API.
        // `replace(/,/g, '.')` ensures that decimal points are used.
        data[i.name] = i.value.replace(/,/g, '.').replace('€', '').trim() || "";
    } else { // Important: For 'Additional Costs', 'Export', 'Import' (textarea/checkbox), the value simply comes as a string.
        if (i.type === "checkbox") {
            data[i.name] = i.checked ? "Ja" : "Nein";
        } else {
            data[i.name] = i.value;
        }
    }
  });

  // Specifically handle Dangerous Goods dropdown, its value is directly its string
  const dangerousGoodsSelect = document.querySelector("#modalBody select[name='Dangerous Goods']");
  if (dangerousGoodsSelect) {
      data['Dangerous Goods'] = dangerousGoodsSelect.value;
  }

  const refValue = document.querySelector("#modalBody input[name='Ref']").value;
  data.mode = "write"; 
  data.user = currentUser.name; 

  console.log('Payload for saving:', data); 
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") {
      showSaveFeedback("Saved!", true);
    } else {
      showSaveFeedback(`Error saving! ${responseData.message || ''}`, false);
      console.error("Save failed:", responseData);
    }
    closeModal();
    fetchData(); 
  } catch (err) {
    showSaveFeedback("Error saving!", false);
    console.error(err);
  }
}

async function deleteRow(btn) {
  const ref = btn.closest("tr").querySelector("a").textContent;

  // Instead of alert(), use a custom confirmation
  const isConfirmed = confirm(`Do you really want to delete the entry with reference "${ref}"? This action cannot be undone.`);
  if (!isConfirmed) {
    return;
  }

  const data = {
    Ref: ref,
    mode: "delete",
    user: currentUser.name 
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const responseData = await response.json();

    if (responseData && responseData.status === "success") { 
      showSaveFeedback("Entry deleted!", true);
    } else {
      showSaveFeedback(`Error deleting entry! ${responseData.message || ''}`, false);
      console.error("Deletion failed:", responseData);
    }
    fetchData(); 
  } catch (err) {
    showSaveFeedback("Error deleting!", false);
    console.error(err);
  }
}

// === CALENDAR FUNCTIONS ===
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
  console.log(`Clicked on calendar day: Year ${year}, Month ${month + 1}, Day ${day}`); 

  // Create the comparison date as a string (YYYY-MM-DD)
  const clickedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  const flightsOnThisDay = requestData.filter(r => {
    let flightDateFromData = r['Flight Date']; // This is already YYYY-MM-DD from the backend
    
    // Simple string comparison
    const isMatch = flightDateFromData === clickedDateStr;
    console.log(`  Comparison: Flight date "${flightDateFromData}" vs. clicked date "${clickedDateStr}" -> Match: ${isMatch}`);
    return isMatch;
  });

  console.log(`Flights found for this day (${clickedDateStr}):`, flightsOnThisDay); 

  if (flightsOnThisDay.length > 0) {
    // If multiple flights on the same day, open the first one found.
    // An optimal solution would be a list or selection, but for now we open the first one.
    const firstFlight = flightsOnThisDay[0];
    const originalIndex = requestData.findIndex(item => item.Ref === firstFlight.Ref); 
    console.log(`First Flight Ref: ${firstFlight.Ref}, Original Index: ${originalIndex}`); 

    if (originalIndex !== -1) {
      openModal(originalIndex);
    } else {
      console.warn("Could not find original index of flight:", firstFlight);
    }
  } else {
      console.log("No flights found for this day."); 
  }
}

function generateCalendarHTML(year, month) {
  const firstDayOfMonthWeekday = (new Date(year, month, 1).getDay() + 6) % 7; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('de-DE', { month: 'long' }); 
  let html = `<div class="calendar-block"><h3>${monthName} ${year}</h3><table><thead><tr><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th></tr></thead><tbody>`;
  let day = 1;

  const today = new Date(); // Get today's date
  today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison

  const flightsByDay = new Map(); 
  requestData.forEach((r) => {
    let flightDate = r['Flight Date']; 
    if (typeof flightDate === 'string' && flightDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [fYear, fMonth, fDay] = flightDate.split('-').map(Number);
        if (fYear === year && (fMonth - 1) === month) {
            if (!flightsByDay.has(fDay)) { 
              flightsByDay.set(fDay, []); 
            }
            flightsByDay.get(fDay).push(r); 
        }
    }
  });

  for (let i = 0; i < 6; i++) { 
    html += "<tr>";
    for (let j = 0; j < 7; j++) { 
      if ((i === 0 && j < firstDayOfMonthWeekday) || day > daysInMonth) {
        html += "<td class='empty'></td>";
      } else {
        const currentCalendarDayForCell = new Date(year, month, day);
        currentCalendarDayForCell.setHours(0,0,0,0);

        const flightsForDay = flightsByDay.get(day) || []; 
        let cellClasses = ['calendar-day'];
        let tooltipContentArray = []; 
        let simpleTitleContent = ''; 
        let dayHasVorfeldbegleitung = false; 
        let dayHasExport = false; // Flag for Export
        let dayHasImport = false; // Flag for Import

        // Check if current day is today and add 'today' class
        if (currentCalendarDayForCell.getTime() === today.getTime()) {
            cellClasses.push('today');
        }

        if (flightsForDay.length > 0) {
          cellClasses.push('has-flights'); 
          
          flightsForDay.forEach(f => {
            const tonnageValue = parseFloat(String(f.Tonnage).replace(',', '.') || "0") || 0;
            
            let formattedAbflugzeit = f['Abflugzeit'] || '-';
            if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.match(/^\d{2}:\d{2}$/)) {
            } else if (formattedAbflugzeit instanceof Date) {
                formattedAbflugzeit = formattedAbflugzeit.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            } else if (typeof formattedAbflugzeit === 'string' && formattedAbflugzeit.includes('T')) {
                try {
                    const timeObj = new Date(formattedAbflugzeit);
                    if (!isNaN(timeObj.getTime())) {
                        formattedAbflugzeit = timeObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    }
                } catch (e) {
                    console.error("Error formatting departure time for tooltip:", formattedAbflugzeit, e);
                }
            }


            tooltipContentArray.push(
              `Ref: ${f.Ref || '-'}` +
              `\nAirline: ${f.Airline || '-'}` +
              `\nFlight No.: ${f.Flugnummer || '-'}` + 
              `\nDeparture Time: ${formattedAbflugzeit}` + 
              `\nTonnage: ${tonnageValue.toFixed(0)} kg` // Tonnage here also without thousands separator
            );
            if (f['Vorfeldbegleitung'] && String(f['Vorfeldbegleitung']).toLowerCase() === 'ja') {
              dayHasVorfeldbegleitung = true; 
            }
            // Set Export/Import Flags
            if (f['Export'] && String(f['Export']).toLowerCase() === 'ja') {
                dayHasExport = true;
            }
            if (f['Import'] && String(f['Import']).toLowerCase() === 'ja') {
                dayHasImport = true;
            }
          });
          simpleTitleContent = `Flights: ${flightsForDay.length}`; 
        }
        
        // Add classes for calendar colors
        if (dayHasExport) {
            cellClasses.push('calendar-export');
        }
        if (dayHasImport) {
            cellClasses.push('calendar-import');
        }

        const dataTooltipContent = tooltipContentArray.join('\n\n').replace(/'/g, '&apos;').replace(/"/g, '&quot;'); 
        const flightIcon = dayHasVorfeldbegleitung ? ' <span class="flight-icon">&#9992;</span>' : '';

        // Added styling for 'today' class here
        const dayNumberClass = cellClasses.includes('today') ? 'font-bold text-lg' : '';

        html += `<td class='${cellClasses.join(' ')}' title='${simpleTitleContent}' data-tooltip='${dataTooltipContent}' onclick="openCalendarDayFlights(${year}, ${month}, ${day})"><div class="${dayNumberClass}">${day}</div>${flightIcon}</td>`;
        day++;
      }
    }
    html += "</tr>";
    if (day > daysInMonth) break; 
  }
  html += "</tbody></table></div>";
  return html;
}

// === TIME AND DATE ===
document.addEventListener("DOMContentLoaded", () => {
  checkAuthStatus(); 
  updateClock();
  setInterval(updateClock, 1000);
  
  // The fetchData polling is started only after the user is authenticated (in checkAuthStatus)
  // The event listener for archiveCheckbox must remain here, as it is not a global function.
  const archiveCheckbox = document.getElementById("archiveCheckbox");
  if (archiveCheckbox) {
      archiveCheckbox.addEventListener('change', filterTable);
  }
});

function updateClock() {
  const now = new Date();
  document.getElementById('currentDate').textContent = "Date: " + now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }); 
  document.getElementById('clock').textContent = "Time: " + now.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit', second:'2-digit'});
}

// === CREATE NEW REQUEST ===
function generateReference() {
  const now = new Date();
  const timestamp = now.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '').replace(/\//g, ''); 
  const random = Math.random().toString(36).substring(2, 6).toUpperCase(); 
  return `CC-${timestamp}-${random}`;
}

function createNewRequest() {
  openModal(-1);
}

// === DISPLAY FEEDBACK ===
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

// NEW FUNCTIONS FOR HISTORY MODAL
async function showHistory(ref) {
  const historyModal = document.getElementById("historyModal");
  const historyBody = document.getElementById("historyBody");
  const historyRefSpan = document.getElementById("historyRef");

  historyRefSpan.textContent = ref;
  historyBody.innerHTML = '<p style="text-align: center;">Loading History...</p>';
  historyModal.style.display = "flex";

  try {
    const response = await fetch(API_URL + "?mode=readAuditLog");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const auditResult = await response.json(); 

    const filteredLogs = auditResult.data.filter(log => log.Reference === ref);

    if (filteredLogs.length === 0) {
      historyBody.innerHTML = '<p style="text-align: center;">No history found for this reference.</p>';
      return;
    }

    let historyHTML = '<ul style="list-style-type: none; padding: 0;">';
    filteredLogs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)).forEach(log => {
      let detailsContent = log.Details || '-';
      
      // Censor sensitive information only for Viewer role
      if (currentUser && currentUser.role === 'viewer' && typeof detailsContent === 'string') {
        const sensitiveFieldPrefixes = [
          'Rate:', 
          'Security charges:', 
          'Dangerous Goods:', 
          '10ft consumables:', 
          '20ft consumables:',
          'Zusatzkosten:' // This field is now also processed by the loop
        ];
        
        let processedDetailsParts = [];
        // Split the details string into individual changes (based on semicolon as separator)
        const detailParts = detailsContent.split(';').map(part => part.trim()).filter(part => part !== '');

        detailParts.forEach(part => {
            let redactedPart = part;
            for (const prefix of sensitiveFieldPrefixes) {
                if (part.startsWith(prefix)) {
                    // NEW: Remove 'VAL:' prefix before blacking out (if still present in audit log)
                    let displayValue = part.substring(prefix.length).trim();
                    if (displayValue.startsWith('VAL:')) {
                        displayValue = displayValue.substring(4);
                    }
                    redactedPart = `${prefix} [REDACTED]`;
                    break; // Prefix found and redacted, move to next part
                }
            }
            processedDetailsParts.push(redactedPart);
        });
        // Reassemble the processed parts
        detailsContent = processedDetailsParts.join('; ');
      }
      
      try {
          // Attempt to parse deleted data if it's a JSON string
          const parsedDetails = JSON.parse(detailsContent);
          if (typeof parsedDetails === 'object' && parsedDetails !== null) {
              // NEW: Also remove VAL: in the deleted JSON detail
              const cleanedParsedDetails = {};
              for (const key in parsedDetails) {
                  let val = parsedDetails[key];
                  if (typeof val === 'string' && val.startsWith('VAL:')) {
                      val = val.substring(4);
                  }
                  cleanedParsedDetails[key] = val;
              }
              detailsContent = 'Deleted Data: <pre>' + JSON.stringify(cleanedParsedDetails, null, 2) + '</pre>';
          }
      } catch (e) {
          // Non-JSON strings are displayed directly as details
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


// --- IMPORTANT CORRECTION: Make functions globally accessible ---
// If script.js is loaded as type="module", functions are not
// available in the global "window" scope by default,
// unless explicitly exported or assigned.
// For HTML onclick attributes, assignment to "window" is required.
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.changePassword = changePassword;
window.logoutUser = logoutUser;
window.fetchData = fetchData;
window.renderTable = renderTable;
window.filterTable = filterTable;
window.openModal = openModal;
window.deleteRowFromModal = deleteRowFromModal;
window.closeModal = closeModal;
window.saveDetails = saveDetails;
window.deleteRow = deleteRow;
window.shiftCalendar = shiftCalendar;
window.renderCalendars = renderCalendars;
window.openCalendarDayFlights = openCalendarDayFlights;
window.generateCalendarHTML = generateCalendarHTML;
window.createNewRequest = createNewRequest;
window.showSaveFeedback = showSaveFeedback;
window.showHistory = showHistory;
window.closeHistoryModal = closeHistoryModal;

// Initialize Auth status as soon as the DOM is loaded.
// This is executed after the window.onload event, but before polling.
checkAuthStatus();
