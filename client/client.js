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
        alert(errorMessage);
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
                <button id='startStop${timer.id}' class='startStop'>Start / Stop</button>
                <button id='reset${timer.id}' class='reset'>Reset</button>
                <button id='delete${timer.id}' class='delete'>Delete</button>`;
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
            let htmlContent = `<p id='timer${timerId}'>${formattedTime}</p>
            <button id='startStop${timerId}' class='startStop'>Start / Stop</button>
            <button id='reset${timerId}' class='reset'>Reset</button>
            <button id='delete${timerId}' class='delete'>Delete</button>`;
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
                alert("Inserisci un tempo valido.");
            }
        });

        newTimer.querySelector(".cancelNewTimer").addEventListener("click", () => {
            newTimer.remove();
        });
    });
}

// --- GROUP MANAGEMENT ---
const createGroupButton = document.querySelector("#createGroup");

if (createGroupButton) {
    createGroupButton.addEventListener("click", () => {
        const groupName = document.querySelector("#groupName").value;

        if (groupName.trim() === "") {
            alert("Group name cannot be empty.");
            return;
        }

        socket.emit("createGroup", groupName, userId);
    });

    socket.on("groupCreated", (groupId, groupName, timerId) => {
        alert(`Group "${groupName}" created successfully with ID: ${groupId} and Timer ID: ${timerId}`);
    });

    socket.on("groupCreationError", (errorMessage) => {
        alert(`Error creating group: ${errorMessage}`);
    });
}
