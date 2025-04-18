import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io("http://localhost:3000", {
    transports: ["websocket"]
});

const submitUserId = document.querySelector("#submitUserId");
const submitGroupId = document.querySelector("#submitGroupId");
let userId = document.querySelector("#userId");
let clientTimerIds = new Set();



document.querySelector(".timerContainer").addEventListener('click',(event)=>{
    let timerId = Number(event.target.id.replace(/^\D+/g, ''));
    if (event.target.classList.contains("startStop")){
        console.log(timerId);
        socket.emit("startStop", userId, timerId);
    }
    if (event.target.classList.contains("reset")){
        socket.emit("resetTimer",userId, timerId);
    }
    if (event.target.classList.contains("delete")){
        socket.emit("deleteTimer",userId, timerId);
    }
});


submitUserId.addEventListener('click', ()=>{
    userId = userId.value;
    //----------------
    socket.emit('sendUserId', userId);
    //----------------
});


submitGroupId.addEventListener('click', ()=>{
    let groupId = document.querySelector("#groupId").value;
    userId = userId.value;
    socket.emit("enterGroup", groupId, userId);
});


function formatTime(milliseconds) {
    let hours = Math.floor(milliseconds / 3600000);
    let minutes = Math.floor((milliseconds % 3600000) / 60000);
    let seconds = Math.floor((milliseconds % 60000) / 1000);
    let ms = milliseconds % 1000;

    // Aggiungi uno zero davanti a numeri inferiori a 10
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    seconds = seconds < 10 ? '0' + seconds : seconds;
    ms = ms < 10 ? '000' + ms : ms < 100 ? '00' + ms : ms < 1000 ? '0' + ms : ms;

    return `${hours}:${minutes}:${seconds}:${ms}`;
}


socket.on('updateTimer', (timerId, timerValue) => {
    if(clientTimerIds.has(timerId)){
        const formattedTime = formatTime(timerValue);
        document.querySelector("#timer"+timerId).textContent = formattedTime;
    }
});


socket.on("initializeTimers", (timers)=>{
    console.log(timers);
    timers.forEach(timer=>{
        if(!clientTimerIds.has(timer.id)){
            clientTimerIds.add(timer.id);
            const formattedTime = formatTime(timer.value);
            let htmlContent = `<p id='timer${timer.id}'>${formattedTime}</p>
            <button id='startStop${timer.id}' class='startStop'>Start / Stop</button>
            <button id='reset${timer.id}' class='reset'>Reset</button>
            <button id='delete${timer.id}' class='delete'>Delete</button>`;
            const newTimer =document.createElement('div');
            newTimer.classList.add("timer");
            newTimer.innerHTML = htmlContent;
            document.querySelector(".timerContainer").appendChild(newTimer);
        }
    })
})

/* document.querySelector("#add").addEventListener('click', ()=>{
    let timerValue = document.querySelector("#timerValue").value;
    socket.emit("addTimer", userId, timerValue);

}); */



document.querySelector("#addTimerBtn").addEventListener("click", () => {
    // Crea un nuovo timer editabile
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

    document.querySelector(".timerContainer").appendChild(newTimer);

    // Salva il nuovo timer
    newTimer.querySelector(".saveNewTimer").addEventListener("click", () => {
        const h = parseInt(newTimer.querySelector("#inputHours").value) || 0;
        const m = parseInt(newTimer.querySelector("#inputMinutes").value) || 0;
        const s = parseInt(newTimer.querySelector("#inputSeconds").value) || 0;
        const ms = parseInt(newTimer.querySelector("#inputMilliseconds").value) || 0;

        const totalMilliseconds = h * 3600000 + m * 60000 + s * 1000 + ms;

        if (totalMilliseconds > 0) {
            socket.emit("addTimer", userId, totalMilliseconds);
            newTimer.remove(); // Rimuove il timer editabile
        } else {
            alert("Inserisci un tempo valido.");
        }
    });

    // Annulla (elimina il timer prima di salvarlo)
    newTimer.querySelector(".cancelNewTimer").addEventListener("click", () => {
        newTimer.remove();
    });
});


socket.on('addClientTimer', (serverUserId, timerId, timerValue)=>{
    console.log(serverUserId);
    if(userId == serverUserId && !clientTimerIds.has(timerId)){
        clientTimerIds.add(timerId);
        const formattedTime = formatTime(timerValue);
        let htmlContent = `<p id='timer${timerId}'>${formattedTime}</p>
        <button id='startStop${timerId}' class='startStop'>Start / Stop</button>
        <button id='reset${timerId}' class='reset'>Reset</button>
        <button id='delete${timerId}' class='delete'>Delete</button>`;
        const newTimer =document.createElement('div');
        newTimer.classList.add("timer");
        newTimer.innerHTML = htmlContent;
        document.querySelector(".timerContainer").appendChild(newTimer);
    }
});


socket.on("deleteClientTimer", timerId=>{
    document.querySelector(".timerContainer").removeChild(document.querySelector(`.timer:has(#timer${timerId})`));
    clientTimerIds.delete(timerId);
});

