function login(event) {
  event.preventDefault();
  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  const user = users[username];
  if (user && user.password === password) {
    localStorage.setItem("currentUser", JSON.stringify({ name: user.name, role: user.role }));
    window.location.href = "index.html";
  } else {
    document.getElementById("loginMessage").textContent = "Login fehlgeschlagen!";
  }
  return false;
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  if (location.pathname.includes("index.html")) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) {
      window.location.href = "login.html";
    } else if (currentUser.role === "viewer") {
      document.querySelectorAll(".sensitive").forEach(el => el.style.display = "none");
    }
  }
});
