import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io("online-timer-backend-production.up.railway.app", {
  transports: ["websocket"],
});

// --- LOGIN ---
if (window.location.pathname.endsWith("login.html")) {
  const loginButton = document.querySelector("#loginButton");
  if (loginButton) {
    const usernameInput = document.querySelector("#username");
    const passwordInput = document.querySelector("#password");

    loginButton.addEventListener("click", () => {
      const username = usernameInput.value;
      const password = passwordInput.value;

      socket.emit("login", username, password); // Invia nome e password al server
    });

    socket.on("loginSuccess", (userData) => {
      console.log("Login effettuato con successo!", userData);
      const userId = userData.userId;
      window.location.href = `timer.html?userId=${encodeURIComponent(userId)}`;
    });

    socket.on("loginError", (errorMessage) => {
      console.error("Errore di login: ", errorMessage);
      showMessage(errorMessage, "error");
    });
  }
}

// Gestione della registrazione
if (window.location.pathname.endsWith("register.html")) {
  const registerButton = document.querySelector("#registerButton");
  if (registerButton) {
    const usernameInput = document.querySelector("#username");
    const passwordInput = document.querySelector("#password");

    registerButton.addEventListener("click", () => {
      const username = usernameInput.value;
      const password = passwordInput.value;

      if (!username || !password) {
        showMessage("Inserisci un username e una password.", "error");
        return;
      }

      socket.emit("register", username, password);
    });

    socket.on("registerSuccess", (message) => {
      showMessage(message, "success");
      window.location.href = "login.html"; // Reindirizza alla pagina di login
    });

    socket.on("registerError", (errorMessage) => {
      showMessage(errorMessage, "error");
    });
  }
}

// --- USER ID ---
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userId");

if (userId) {
  socket.emit("sendUserId", userId);
}
// --- TIMER MANAGEMENT ---
if (window.location.pathname.endsWith("timer.html")) {
  // Verifica se gli elementi di timer.html esistono prima di aggiungere gli event listener
  const timerContainer = document.querySelector(".timerContainer");
  let clientTimerIds = new Set();

  function updateEmptyMessage() {
    const emptyMessage = document.querySelector(".emptyCard");
    const timers = timerContainer.querySelectorAll(".timer");

    if (timers.length === 0) {
      if (!emptyMessage) {
        const message = document.createElement("div");
        message.classList.add("emptyCard");
        message.innerHTML = `
          <h3>Nessun Timer trovato</h3>
          <p>Aggiungi un nuovo Timer per iniziare!</p>
        `;
        timerContainer.appendChild(message);
      }
    } else {
      if (emptyMessage) emptyMessage.remove();
    }
  }

  timerContainer.addEventListener("click", (event) => {
    let timerId = Number(event.target.id.replace(/^\D+/g, ""));
    if (event.target.classList.contains("startStop")) {
      socket.emit("startStop", userId, timerId);
    }
    if (event.target.classList.contains("reset")) {
      socket.emit("resetTimer", userId, timerId);
    }
    if (event.target.classList.contains("delete")) {
      socket.emit("deleteTimer", userId, timerId);
    }
  });

  socket.on("updateTimer", (timerId, timerValue) => {
    if (clientTimerIds.has(timerId)) {
      const formattedTime = formatTime(timerValue); // Marcello
      document.querySelector("#timer" + timerId).textContent = formattedTime;
    }
  });

  socket.on("initializeTimers", (timers) => {
    timerContainer.innerHTML = "";
    clientTimerIds.clear(); // Marcello


    timers.forEach((timer) => {
      if (!clientTimerIds.has(timer.id)) {
        clientTimerIds.add(timer.id);
        
        const formattedTime = formatTime(timer.value); // Marcello
        const htmlContent = `
          <div class="timer">
            <p id='timer${timer.id}'>${formattedTime}</p>
            <div class="timer-buttons">
              <button id='startStop${timer.id}' class='startStop'>Start  Stop</button>
              <button id='reset${timer.id}' class='reset'>Reset</button>
              <button id='delete${timer.id}' class='delete'>Delete</button>
            </div>
          </div>
        `;
        timerContainer.insertAdjacentHTML("beforeend", htmlContent);
      }
    });

    updateEmptyMessage();
  });

  socket.on("addClientTimer", (serverUserId, timerId, timerValue) => {
    if (userId == serverUserId && !clientTimerIds.has(timerId)) {
      clientTimerIds.add(timerId);
      const formattedTime = formatTime(timerValue);
      const htmlContent = `
        <div class="timer">
          <p id='timer${timerId}' class='timer-text'>${formattedTime}</p>
          <div class="timer-buttons">
            <button id='startStop${timerId}' class='startStop'>Start  Stop</button>
            <button id='reset${timerId}' class='reset'>Reset</button>
            <button id='delete${timerId}' class='delete'>Delete</button>
          </div>
        </div>
      `;
      timerContainer.insertAdjacentHTML("beforeend", htmlContent);
      updateEmptyMessage();
    }
  });

  socket.on("deleteClientTimer", (timerId) => {
    const timerElement = document.querySelector(`.timer:has(#timer${timerId})`);
    if (timerElement) {
      timerElement.remove();
      clientTimerIds.delete(timerId);
    }
    updateEmptyMessage();
  });

  document.querySelector("#addTimerBtn")?.addEventListener("click", () => {
    const newTimer = document.createElement("div");
    newTimer.classList.add("timer");

    newTimer.innerHTML = `
      <div class="time-inputs">
        <input type="number" class="timePart" id="inputHours" min="0" max="99" placeholder="hh">
        <span>:</span>
        <input type="number" class="timePart" id="inputMinutes" min="0" max="59" placeholder="mm">
        <span>:</span>
        <input type="number" class="timePart" id="inputSeconds" min="0" max="59" placeholder="ss">
        <span>:</span>
        <input type="number" class="timePart" id="inputMilliseconds" min="0" max="9999" placeholder="cs">
      </div>
      <div class="actions">
        <button class="saveNewTimer">Save timer</button>
        <button class="cancelNewTimer">Delete</button>
      </div>
    `;

    timerContainer.appendChild(newTimer);
    updateEmptyMessage();

    newTimer.querySelector(".saveNewTimer").addEventListener("click", () => {
      const h = parseInt(newTimer.querySelector("#inputHours").value) || 0;
      const m = parseInt(newTimer.querySelector("#inputMinutes").value) || 0;
      const s = parseInt(newTimer.querySelector("#inputSeconds").value) || 0;
      const cs =
        parseInt(newTimer.querySelector("#inputMilliseconds").value) || 0;
      const totalMilliseconds = h * 3600000 + m * 60000 + s * 1000 + cs;

      if (totalMilliseconds > 0) {
        socket.emit("addTimer", userId, totalMilliseconds);
        newTimer.remove();
      } else {
        showMessage("Inserisci un tempo valido.", "error");
      }

      updateEmptyMessage();
    });

    newTimer.querySelector(".cancelNewTimer").addEventListener("click", () => {
      newTimer.remove();
      updateEmptyMessage();
    });
  });
}

// Verifica se siamo nella pagina group.html
if (window.location.pathname.endsWith("group.html")) {
  const notificationsContainer = document.querySelector(
    "#notificationsContainer"
  );
  const userGroupsContainer = document.querySelector("#userGroupsContainer");

  let selectedUserIds = new Set();

  // Richiedi la lista degli utenti al server
  if (userId) {
    socket.emit("getNotifications", userId);
    socket.emit("getUserGroups", userId);
  }

  // Ricevi notifiche di invito
  socket.on(`groupInvite_${userId}`, ({ groupId, groupName, senderId }) => {
    const accept = confirm(
      `Sei stato invitato al gruppo "${groupName}" da userId ${senderId}. Accetti?`
    );
    if (accept) {
      socket.emit("acceptGroupInvite", groupId, userId);
    } else {
      socket.emit("declineGroupInvite", groupId, userId);
    }
  });

  socket.on("acceptInviteSuccess", (message) => {
    showMessage(message, "success");
  });

  socket.on("acceptInviteError", (errorMessage) => {
    showMessage(errorMessage, "error");
  });

  socket.on("declineInviteSuccess", (message) => {
    showMessage(message, "success");
  });

  socket.on("declineInviteError", (errorMessage) => {
    showMessage(errorMessage, "error");
  });

  // Ricevi e visualizza le notifiche
  socket.on("notificationsList", (notifications) => {
    console.log(notifications);
    notificationsContainer.innerHTML = "";
    if (notifications.length === 0) {
      notificationsContainer.innerHTML = `
           <div class="emptyCard">
    <h3>Nessuna notifica</h3>
    <p>Invita utenti per iniziare a ricevere notifiche!</p>
  </div>
        `;
      return;
    }

    notifications.forEach((notification) => {
      const notificationElement = document.createElement("div");
      notificationElement.classList.add("notificationItem");

      // Marcello
      notificationElement.innerHTML = ` 
                <div class="notificationCard">
                  <p> Sei stato invitato al gruppo: <strong>${notification.group_name}</strong> </p>
                  <div class="notificationActions">
                    <button class="acceptNotification" data-notification-id="${notification.id}">Accetta</button>
                    <button class="declineNotification" data-notification-id="${notification.id}">Rifiuta</button>
                  </div>
                </div>
            `;

      notificationsContainer.appendChild(notificationElement);
    });

    // Aggiungi event listener ai pulsanti
    document.querySelectorAll(".acceptNotification").forEach((button) => {
      button.addEventListener("click", (event) => {
        const notificationId = event.target.dataset.notificationId;
        socket.emit("acceptNotification", notificationId, userId);
      });
    });

    document.querySelectorAll(".declineNotification").forEach((button) => {
      button.addEventListener("click", (event) => {
        const notificationId = event.target.dataset.notificationId;
        socket.emit("declineNotification", notificationId, userId);
      });
    });
  });

  socket.on("notificationsError", (errorMessage) => {
    console.error("Errore:", errorMessage);
    showMessage(errorMessage, "error");
  });

  socket.on("notificationActionSuccess", (message) => {
    showMessage(message, "success");
    // Ricarica le notifiche dopo l'azione
    socket.emit("getNotifications", userId);
    socket.emit("getUserGroups", userId); // Marcello
  });

  socket.on("notificationActionError", (errorMessage) => {
    showMessage(errorMessage, "error");
  });

  // Ricevi la lista dei gruppi dal server
  socket.on("userGroupsList", (groups) => {
    const userGroupsContainer = document.getElementById("userGroupsContainer");
    const searchInput = document.getElementById("searchGroupInput"); // Marcello

    userGroupsContainer.innerHTML = "";

    if (groups.length === 0) {
      // Marcello
      userGroupsContainer.innerHTML += `
        <div class="emptyCard">
          <h3> Nessun gruppo trovato</h3>
          <p>
            Crea un nuovo gruppo per iniziare!
          </p>
        </div>
      `;

      // Nascondi la barra di ricerca
      searchInput.style.display = "none";
    } else {
      // Mostra la barra di ricerca
      searchInput.style.display = "block";
      groups.forEach((group) => {
        if(group.user_id !== undefined){

        const groupElement = document.createElement("div");
        groupElement.classList.add("groupItem");
        // Marcello
        groupElement.innerHTML = `
                  <div class="groupTile">
                    <h3>${group.name}</h3> 
                  <button class="enterGroup" data-group-id="${group.id}">
                    Entra
                  </button>
                  ${parseInt(group.user_id) === parseInt(userId) ? "<button class='deleteGroup' data-group-id="+ group.id + ">Elimina</button>": ""}
                  </div>`;
        userGroupsContainer.appendChild(groupElement);
        }
      });

      // Aggiungi event listener ai pulsanti "Entra"
      document.querySelectorAll(".enterGroup").forEach((button) => {
        button.addEventListener("click", (event) => {
          const groupId = event.target.dataset.groupId;
          const userId = new URLSearchParams(window.location.search).get(
            "userId"
          );
          window.location.href = `groupTimer.html?userId=${encodeURIComponent(
            userId
          )}&groupId=${encodeURIComponent(groupId)}`;
        });
      });

      // Aggiungi event listener ai pulsanti "Elimina"
      document.querySelectorAll(".deleteGroup").forEach((button) => {
        button.addEventListener("click", (event) => {
          const groupId = event.target.dataset.groupId;
          socket.emit("deleteGroup", groupId);
        });
      });
    }
  });

  socket.on("userGroupsError", (errorMessage) => {
    console.error("Errore:", errorMessage);
    showMessage(errorMessage, "error");
  });

  socket.on("deleteClientGroup", groupId=>{
    const groupItem = document.querySelector(`.groupItem:has(button[data-group-id="${groupId}"])`);
    const groupContainer = document.querySelector(".userGroupsContainer");
    if(groupItem !== null)
        groupItem.parentNode.removeChild(groupItem);
  });

}

// Verifica se siamo nella pagina group.html
// if (window.location.pathname.endsWith("group.html")) {
//     const notificationsContainer = document.querySelector("#notificationsContainer");
//     const userGroupsContainer = document.querySelector("#userGroupsContainer");

//     let selectedUserIds = new Set();

//     // Richiedi la lista degli utenti al server
//     if (userId) {
//         socket.emit("getNotifications", userId);
//         socket.emit("getUserGroups", userId);
//     }

//     // Ricevi notifiche di invito
//     socket.on(`groupInvite_${userId}`, ({ groupId, groupName, senderId }) => {
//         const accept = confirm(`Sei stato invitato al gruppo "${groupName}" da userId ${senderId}. Accetti?`);
//         if (accept) {
//             socket.emit("acceptGroupInvite", groupId, userId);
//         } else {
//             socket.emit("declineGroupInvite", groupId, userId);
//         }
//     });

//     socket.on("acceptInviteSuccess", (message) => {
//         alert(message);
//     });

//     socket.on("acceptInviteError", (errorMessage) => {
//         alert(errorMessage);
//     });

//     socket.on("declineInviteSuccess", (message) => {
//         alert(message);
//     });

//     socket.on("declineInviteError", (errorMessage) => {
//         alert(errorMessage);
//     });

//     // Ricevi e visualizza le notifiche
//     socket.on("notificationsList", (notifications) => {
//         notificationsContainer.innerHTML = "";
//         notifications.forEach(notification => {
//             const notificationElement = document.createElement("div");
//             notificationElement.classList.add("notificationItem");

//             notificationElement.innerHTML = `
//                 <p>Sei stato invitato al gruppo: <strong>${notification.group_name}</strong>
//                 <button class="acceptNotification" data-notification-id="${notification.id}">Accetta</button>
//                 <button class="declineNotification" data-notification-id="${notification.id}">Rifiuta</button></p>
//             `;

//             notificationsContainer.appendChild(notificationElement);
//         });

//         // Aggiungi event listener ai pulsanti
//         document.querySelectorAll(".acceptNotification").forEach(button => {
//             button.addEventListener("click", (event) => {
//                 const notificationId = event.target.dataset.notificationId;
//                 socket.emit("acceptNotification", notificationId, userId);
//             });
//         });

//         document.querySelectorAll(".declineNotification").forEach(button => {
//             button.addEventListener("click", (event) => {
//                 const notificationId = event.target.dataset.notificationId;
//                 socket.emit("declineNotification", notificationId, userId);
//             });
//         });
//     });

//     socket.on("notificationsError", (errorMessage) => {
//         console.error("Errore:", errorMessage);
//         alert(errorMessage);
//     });

//     socket.on("notificationActionSuccess", (message) => {
//         alert(message);
//         // Ricarica le notifiche dopo l'azione
//         socket.emit("getNotifications", userId);
//     });

//     socket.on("notificationActionError", (errorMessage) => {
//         alert(errorMessage);
//     });

//     // Ricevi la lista dei gruppi dal server

//     socket.on("userGroupsError", (errorMessage) => {
//         console.error("Errore:", errorMessage);
//         alert(errorMessage);
//     });
// }

// Verifica se siamo nella pagina newgroup.html
if (window.location.pathname.endsWith("newgroup.html")) {
    const createGroupButton = document.querySelector("#createGroup");
    const userListContainer = document.querySelector("#userListContainer");

    let selectedUserIds = new Set();

    // Richiedi la lista degli utenti al server
    if (userId) {
        socket.emit("getUsers", userId);
    }

    // Ricevi la lista degli utenti dal server
    socket.on("usersList", (users) => {
        userListContainer.innerHTML = "<h3>Seleziona utenti da aggiungere:</h3>";
        users.forEach(user => {
            const userElement = document.createElement("div");
            userElement.classList.add("userItem");

            // Aggiungi un checkbox accanto al nome dell'utente
            const checkbox = document.createElement("input");
            checkbox.classList.add("styled-checkbox"); // Marcello
            checkbox.type = "checkbox";
            checkbox.dataset.userId = user.id;

            // Gestisci la selezione/deselezione tramite checkbox
            checkbox.addEventListener("change", (event) => {
                const userId = event.target.dataset.userId;
                if (event.target.checked) {
                    selectedUserIds.add(userId);
                } else {
                    selectedUserIds.delete(userId);
                }
            });

            userElement.appendChild(checkbox);
            userElement.appendChild(document.createTextNode(` ${user.name} (ID: ${user.id})`));
            userListContainer.appendChild(userElement);
        });
    });

    socket.on("usersError", (errorMessage) => {
        console.error("Errore:", errorMessage);
        showMessage(errorMessage, "error");
    });

    // Crea un gruppo e invia gli inviti
    createGroupButton.addEventListener("click", () => {
      const groupName = document.querySelector("#groupName").value;
      const h = parseInt(document.querySelector("#inputHours").value) || 0;
      const m = parseInt(document.querySelector("#inputMinutes").value) || 0;
      const s = parseInt(document.querySelector("#inputSeconds").value) || 0;
      const cs =
        parseInt(document.querySelector("#inputMilliseconds").value) || 0;
      const groupTimerValue = h * 3600000 + m * 60000 + s * 1000 + cs;

        if (!groupName || selectedUserIds.size === 0 || isNaN(groupTimerValue) || groupTimerValue <= 0) {
          showMessage(
            "Inserisci un nome per il gruppo e seleziona almeno un utente.",
            "error"
          );return;
        }

        socket.emit("createGroup", groupName, userId, Array.from(selectedUserIds), groupTimerValue);
    });

    socket.on("groupCreated", (groupId, groupName, timerId) => {
      showMessage(`Gruppo "${groupName}" creato con successo!`, "success");
    });

    socket.on("groupCreationError", (errorMessage) => {
      showMessage(errorMessage, "error");
    });

}

// Verifica se siamo nella pagina timer.html
if (window.location.pathname.endsWith("groupTimer.html")) {
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get("groupId");
  const userId = urlParams.get("userId");
  const timerGroupContainer = document.querySelector(".timerGroupContainer");

  if (groupId && userId) {
    socket.emit("enterGroup", groupId, userId);
    socket.emit("getSentNotifications", groupId, userId); // Richiedi le notifiche inviate
  }

  socket.on("initializeTimers", ({ groupName, timers }) => {
    // Marcello
    const titleElement = document.getElementById("groupTitle");
    if (titleElement) {
      titleElement.textContent = `${groupName}`;
    }

    if (timers.length > 0) {
      const timer = timers[0];
      const timerGroupContainer = document.querySelector(
        ".timerGroupContainer"
      );

      // Pulisce il contenitore se necessario
      timerGroupContainer.innerHTML = "";

      // Mostra il timer associato al gruppo
      const timerElement = document.createElement("div");
      timerElement.classList.add("timer");
      const formattedTime = formatTime(timer.value);
      timerElement.innerHTML = `<p id='timer${timer.id}'>${formattedTime}</p>`
        if(parseInt(timer.user_id) === parseInt(userId)){
            timerElement.innerHTML = timerElement.innerHTML +`<div class="timer-buttons">
            <button id='startStop${timer.id}' class='startStop'>Start Stop</button>
            <button id='reset${timer.id}' class='reset'>Reset</button>
            </div></div> `;
        }else{
            // Marcello
          timerElement.innerHTML += `
          <div class="timer-buttons">
            <button class='startStop no-permission'>Start Stop</button>
            <button class='reset no-permission'>Reset</button>
          </div>`;
        }

      timerGroupContainer.appendChild(timerElement);
    }
  });

  timerGroupContainer.addEventListener("click", (event) => {
    const target = event.target;
    // Marcello
    // Blocca l'azione se il pulsante è "finto"
    if (target.classList.contains("no-permission")) {
      event.preventDefault();
      showMessage("Non hai il permesso di usare questo timer.", "error");
      return; // esce dalla funzione
    }
  
    const timerId = target.id.replace(/^\D+/g, "");
  
    if (target.classList.contains("startStop")) {
      socket.emit("startStop", userId, timerId);
    }
  
    if (target.classList.contains("reset")) {
      socket.emit("resetTimer", userId, timerId);
    }
  });

  socket.on("updateTimer", (timerId, timerValue) => {
    const timerElement = document.querySelector(`#timer${timerId}`);
    const formattedTime = formatTime(timerValue); // Marcello
    if (timerElement) {
      timerElement.textContent = formattedTime;
    }
  });

  socket.on("groupAccessError", (errorMessage) => {
    showMessage(errorMessage, "error");
    window.location.href = `group.html?userId=${encodeURIComponent(userId)}`;
  });

  socket.on("groupAccessDenied", (errorMessage) => {
    showMessage(errorMessage, "error");
    window.location.href = `group.html?userId=${encodeURIComponent(userId)}`;
  });

  // Ricevi e visualizza le notifiche inviate
  socket.on("sentNotificationsList", (notifications) => {
    // Marcello
    const section = document.getElementById("section-2");
    const notificationsContainer = document.getElementById(
      "notificationsContainer"
    );

    if (notifications.length === 0) {
      // Nasconde completamente la section se non ci sono notifiche
      section.style.display = "none";
    } else {
      // Mostra la section e inserisce i dati
      section.style.display = "block";
      notificationsContainer.innerHTML = "";

      notifications.forEach((notification) => {
        console.log(notification.user_id);
        const notificationElement = document.createElement("div");
        notificationElement.classList.add("notificationItem");
        notificationElement.id = `user${notification.user_id}`;

        let iconClass = "";
        let statusClass = "";

        if (notification.status === "accepted") {
          iconClass = "fa-solid fa-check-circle";
          statusClass = "accepted";
        } else if (notification.status === "declined") {
          iconClass = "fa-solid fa-times-circle";
          statusClass = "declined";
        } else if (notification.status === "sent") {
          iconClass = "fa-solid fa-hourglass-half";
          statusClass = "sent";
        }

        notificationElement.innerHTML = `
  <p>
    ${notification.user_name} 
    <i class="${iconClass} status-icon ${statusClass}" aria-label="${notification.status}"></i>
  </p>
`;
        notificationsContainer.appendChild(notificationElement);
      });
    }
  });

  socket.on("userAccept", (serverGroupId, serverUserId)=>{
    console.log(serverUserId);
    if(parseInt(groupId) === serverGroupId){
        const acceptUser = document.querySelector(`#user${serverUserId}> p > i`);
        acceptUser.ariaLabel = "accepted";
        acceptUser.classList.remove("sent");
        acceptUser.classList.add("accepted");
        acceptUser.classList.remove("fa-solid","fa-hourglass-half");
        acceptUser.classList.add("fa-solid","fa-check-circle");
    }    
  });

  socket.on("userDecline", (serverGroupId, serverUserId)=>{
    if(parseInt(groupId) === serverGroupId){
      const deleteUser = document.querySelector(`#user${serverUserId}> p > i`);
      deleteUser.ariaLabel = "declined";
      deleteUser.classList.remove("sent");
      deleteUser.classList.add("declined");
      deleteUser.classList.remove("fa-solid","fa-hourglass-half");
      deleteUser.classList.add("fa-solid","fa-times-circle");
    }
  })
}

// Marcello
function formatTime(milliseconds) {
    let hours = Math.floor(milliseconds / 3600000);
    let minutes = Math.floor((milliseconds % 3600000) / 60000);
    let seconds = Math.floor((milliseconds % 60000) / 1000);
    let ms = milliseconds % 1000;
  
    hours = hours.toString().padStart(2, "0");
    minutes = minutes.toString().padStart(2, "0");
    seconds = seconds.toString().padStart(2, "0");
    ms = ms.toString().padStart(3, "0"); // max 3 cifre per i millisecondi
  
    return `${hours}:${minutes}:${seconds}.${ms}`; // punto invece dei due punti
  }

// Marcello
function showMessage(message, type = "success", duration = 5000) {
    const box = document.getElementById("messageBox");
  box.textContent = message;
  box.className = `message-box ${type}`;
  box.classList.remove("hidden");
  setTimeout(() => {
    box.classList.add("hidden");
  }, duration);
}

// Funzione per cercare gli utenti
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchUserInput");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const userElements = document.querySelectorAll(
      "#userListContainer .userItem"
    );

    userElements.forEach((user) => {
      const username = user.textContent.toLowerCase();
      user.style.display = username.includes(query) ? "block" : "none";
    });
  });
});

// Funzione per cercare i  gruppi
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchGroupInput");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const groupElements = document.querySelectorAll(
      "#userGroupsContainer .groupItem"
    );

    groupElements.forEach((group) => {
      const groupName = group.textContent.toLowerCase();
      group.style.display = groupName.includes(query) ? "block" : "none";
    });
  });
});
