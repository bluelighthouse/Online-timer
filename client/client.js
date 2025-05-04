import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io("http://localhost:3000", {
    transports: ["websocket"]
});

// --- LOGIN ---
const loginButton = document.querySelector("#loginButton");
if (loginButton) {
    const usernameInput = document.querySelector("#username");
    const passwordInput = document.querySelector("#password");

    loginButton.addEventListener("click", () => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        socket.emit("login", username, password);
    });

    socket.on("loginSuccess", (userData) => {
        console.log("Login effettuato con successo!", userData);
        const userId = userData.userId;
        window.location.href = `index.html?userId=${encodeURIComponent(userId)}`;
    });

    socket.on("loginError", (errorMessage) => {
        console.error("Errore di login: ", errorMessage);
        showMessage(errorMessage, "error");
    });
}

// --- USER ID ---
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get("userId");

if (userId) {
    socket.emit('sendUserId', userId);
}

// --- TIMER MANAGEMENT ---
const submitGroupId = document.querySelector("#submitGroupId");
const timerContainer = document.querySelector(".timerContainer");

if (submitGroupId && timerContainer) {
    let clientTimerIds = new Set();

    submitGroupId.addEventListener('click', () => {
        let groupId = document.querySelector("#groupId").value;
        socket.emit("enterGroup", groupId, userId);
    });

    timerContainer.addEventListener('click', (event) => {
        let timerId = Number(event.target.id.replace(/^\D+/g, ''));
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

    function formatTime(milliseconds) {
        let hours = Math.floor(milliseconds / 3600000);
        let minutes = Math.floor((milliseconds % 3600000) / 60000);
        let seconds = Math.floor((milliseconds % 60000) / 1000);
        let ms = milliseconds % 1000;

        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        ms = ms.toString().padStart(4, '0');

        return `${hours}:${minutes}:${seconds}:${ms}`;
    }

    socket.on('updateTimer', (timerId, timerValue) => {
        if (clientTimerIds.has(timerId)) {
            const formattedTime = formatTime(timerValue);
            document.querySelector("#timer" + timerId).textContent = formattedTime;
        }
    });

    socket.on("initializeTimers", (timers) => {
        timers.forEach(timer => {
            if (!clientTimerIds.has(timer.id)) {
                clientTimerIds.add(timer.id);
                const formattedTime = formatTime(timer.value);
                let htmlContent = `<p id='timer${timer.id}'>${formattedTime}</p>
                <div class="timer-buttons">
                <button id='startStop${timer.id}' class='startStop'>Start  Stop</button>
                <button id='reset${timer.id}' class='reset'>Reset</button>
                <button id='delete${timer.id}' class='delete'>Delete</button>
                </div> `;
                const newTimer = document.createElement('div');
                newTimer.classList.add("timer");
                newTimer.innerHTML = htmlContent;
                timerContainer.appendChild(newTimer);
            }
        });
    });

    socket.on('addClientTimer', (serverUserId, timerId, timerValue) => {
        if (userId == serverUserId && !clientTimerIds.has(timerId)) {
            clientTimerIds.add(timerId);
            const formattedTime = formatTime(timerValue);
            let htmlContent = `<p id='timer${timerId}'class='timer-text'>${formattedTime}</p>
            <div class="timer-buttons">
            <button id='startStop${timerId}' class='startStop'>Start  Stop</button>
            <button id='reset${timerId}' class='reset'>Reset</button>
            <button id='delete${timerId}' class='delete'>Delete</button>
            </div> `;
            const newTimer = document.createElement('div');
            newTimer.classList.add("timer");
            newTimer.innerHTML = htmlContent;
            timerContainer.appendChild(newTimer);
        }
    });

    socket.on("deleteClientTimer", timerId => {
        const timerElement = document.querySelector(`.timer:has(#timer${timerId})`);
        if (timerElement) {
            timerContainer.removeChild(timerElement);
            clientTimerIds.delete(timerId);
        }
    });

    // NUOVO: Aggiunta Timer Manuale con input
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
                <input type="number" class="timePart" id="inputMilliseconds" min="0" max="9999" placeholder="ms">
            </div>
            <div class="actions">
                <button class="saveNewTimer">Save timer</button>
                <button class="cancelNewTimer">Delete</button>
            </div>
        `;
        timerContainer.appendChild(newTimer);

        newTimer.querySelector(".saveNewTimer").addEventListener("click", () => {
            const h = parseInt(newTimer.querySelector("#inputHours").value) || 0;
            const m = parseInt(newTimer.querySelector("#inputMinutes").value) || 0;
            const s = parseInt(newTimer.querySelector("#inputSeconds").value) || 0;
            const ms = parseInt(newTimer.querySelector("#inputMilliseconds").value) || 0;

            const totalMilliseconds = h * 3600000 + m * 60000 + s * 1000 + ms;
            if (totalMilliseconds > 0) {
                socket.emit("addTimer", userId, totalMilliseconds);
                newTimer.remove();
            } else {
                showMessage("Inserisci un tempo valido.", "error");
            }
        });

        newTimer.querySelector(".cancelNewTimer").addEventListener("click", () => {
            newTimer.remove();
        });
    });
}

// Verifica se siamo nella pagina group.html
if (window.location.pathname.endsWith("group.html")) {
    const createGroupButton = document.querySelector("#createGroup");
    const groupNameInput = document.querySelector("#groupName");
    const userListContainer = document.querySelector("#userListContainer");
    const notificationsContainer = document.querySelector("#notificationsContainer");

    let selectedUserIds = new Set();

    // Richiedi la lista degli utenti al server
    if (userId) {
        socket.emit("getUsers", userId);
        socket.emit("getNotifications", userId);
    }

    // Ricevi la lista degli utenti dal server
    socket.on("usersList", (users) => {
        userListContainer.innerHTML = "<h3>Lista utenti:</h3>";
        users.forEach(user => {
            const userElement = document.createElement("div");
            userElement.classList.add("userItem");

            // Aggiungi un checkbox accanto al nome dell'utente
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("styled-checkbox"); // Marcello
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
        const groupName = groupNameInput.value;

        if (!groupName || selectedUserIds.size === 0) {
            showMessage("Inserisci un nome per il gruppo e seleziona almeno un utente.", "error");
            return;
        }

        socket.emit("createGroup", groupName, userId, Array.from(selectedUserIds));
    });

    socket.on("groupCreated", (groupId, groupName, timerId) => {
        showMessage(`Gruppo "${groupName}" creato con successo!`, "success");
    });

    socket.on("groupCreationError", (errorMessage) => {
        showMessage(errorMessage, "error");
    });

    // Ricevi notifiche di invito
    socket.on(`groupInvite_${userId}`, ({ groupId, groupName, senderId }) => {
        const accept = confirm(`Sei stato invitato al gruppo "${groupName}" da userId ${senderId}. Accetti?`);
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
        notificationsContainer.innerHTML = "<h3>Notifiche:</h3>";
        notifications.forEach(notification => {
            const notificationElement = document.createElement("div");
            notificationElement.classList.add("notificationItem");

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
        document.querySelectorAll(".acceptNotification").forEach(button => {
            button.addEventListener("click", (event) => {
                const notificationId = event.target.dataset.notificationId;
                socket.emit("acceptNotification", notificationId, userId);
            });
        });

        document.querySelectorAll(".declineNotification").forEach(button => {
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
    });

    socket.on("notificationActionError", (errorMessage) => {
        showMessage(errorMessage, "error");
    });

}
    function showMessage(message, type = "success", duration = 3000) {
        const box = document.getElementById("messageBox");
        box.textContent = message;
        box.className = `message-box ${type}`;
        box.classList.remove("hidden");
    
        setTimeout(() => {
            box.classList.add("hidden");
        }, duration);
    }