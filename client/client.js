import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const socket = io("http://localhost:3000", {
    transports: ["websocket"]
});

const submitUserId = document.querySelector("#submitUserId");
const submitGroupId = document.querySelector("#submitGroupId");
let userId = document.querySelector("#userId");
const loginButton = document.querySelector("#loginButton");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
let clientTimerIds = new Set();

loginButton.addEventListener("click", () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    socket.emit("login", username, password); // Invia nome e password al server
});

socket.on("loginSuccess", (userData) => {
    console.log("Login effettuato con successo!", userData);
    window.location.href = "index.html"; // Reindirizza alla pagina index
    socket.emit('sendUserId', userData.userId);
});


socket.on("loginError", (errorMessage) => {
    console.error("Errore di login: ", errorMessage);
    alert(errorMessage);
});


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


socket.on('updateTimer', (timerId, timerValue) => {
    if(clientTimerIds.has(timerId)){
        document.querySelector("#timer"+timerId).textContent = timerValue;
    }
});


socket.on("initializeTimers", (timers)=>{
    console.log(timers);
    timers.forEach(timer=>{
        if(!clientTimerIds.has(timer.id)){
            clientTimerIds.add(timer.id);
            let htmlContent = `<p id='timer${timer.id}'>${timer.value}</p><button id='startStop${timer.id}' class='startStop'>Start</button>
            <button id='reset${timer.id}' class='reset'>reset</button>
            <button id='delete${timer.id}' class='delete'>delete</button>`;
            const newTimer =document.createElement('div');
            newTimer.classList.add("timer");
            newTimer.innerHTML = htmlContent;
            document.querySelector(".timerContainer").appendChild(newTimer);
        }
    })
})

document.querySelector("#add").addEventListener('click', ()=>{
    let timerValue = document.querySelector("#timerValue").value;
    socket.emit("addTimer", userId, timerValue);

});

socket.on('addClientTimer', (serverUserId, timerId, timerValue)=>{
    console.log(serverUserId);
    if(userId == serverUserId && !clientTimerIds.has(timerId)){
        clientTimerIds.add(timerId);
        let htmlContent = `<p id='timer${timerId}'>${timerValue}</p><button id='startStop${timerId}' class='startStop'>Start</button>
        <button id='reset${timerId}' class='reset'>reset</button>
        <button id='delete${timerId}' class='delete'>delete</button>`;
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

