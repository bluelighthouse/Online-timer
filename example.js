/*

TODO:
    - Rendi tutte le funzioni del database await/async
*/

// Open the socket connection
const io = require('socket.io')(3000,{
     cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// connect to DB
let mysql = require("mysql2");
var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
});

// Collect

async function getUserTimers(connection,userId){
    timers = [];
    // insert statment
    let sql = `SELECT * FROM timer.timers WHERE user_id=? AND isGroup=0`;
      
    // execute the insert statment
    return new Promise((resolve, reject) => {
        connection.query(sql, [userId], (error, results) => {
            if (error) {
                console.error(error.message);
                reject(error);
                return;
            }

            // it surely doesn't work, change this code.
            const timers = results.map(result => ({id: result["id"], value: result["time"]}));
            console.log(timers);
            resolve(timers);
        });
    });
}

/* Struttura JSON-like:
    userid=>{
        timerIds = [ ]
        intervals = [ ]
    }
*/
let userTimers = {};

io.on("connection", socket => {
    console.log(`Client connesso: ${socket.id}`); 

    // Gestisce l'autenticazione
    socket.on('login', (username, password) => {
        const sql = `SELECT * FROM timer.users WHERE name = ? AND password = ?`;
        connection.query(sql, [username, password], (error, results) => {
            if (error) {
                console.error('Errore nel server: ', error.message);
                socket.emit('loginError', 'Errore nel server');
                return;
            }

            if (results.length === 0) {
                socket.emit('loginError', 'Nome utente o password non corretti');
                return;
            }

            const user = results[0];
            socket.emit('loginSuccess', { userId: user.id, username: user.name });
        });
    });



    socket.on('sendUserId', async (userId)=>{
            try{
                await connection.connect();
                let timers = await getUserTimers(connection, userId);
                if(userTimers[userId] === undefined){
                    userTimers[userId] = { 
                        startValue: {},
                        currentValue: {},
                        intervals: {}
                    }
                }

                // initialize the timer the user is not logged
                timers.forEach(timer => {
                    if(userTimers[userId].startValue[timer.id] === undefined){
                        userTimers[userId].startValue[timer.id] = timer.value;
                        userTimers[userId].currentValue[timer.id] = timer.value;
                    }else{
                        // set the starting lenght of the timers as the values used in the already open clients
                        timer.value = userTimers[userId].currentValue[timer.id];
                    }
                });
                
                socket.emit('initializeTimers', timers);
            }catch(err){
                console.error("Errore: ", err);
            }
    });

    socket.on("addTimer", (userId, timerValue) =>{
        connection.connect(()=>{
            let sql = "INSERT INTO timer.timers VALUES (NULL, ?, ?,0)"; 
            connection.query(sql, [Number(timerValue), Number(userId)], (error, results)=>{
                if(error) console.log(error);

                if (!userTimers[userId]) {
                    userTimers[userId] = {
                        startValue: {}, 
                        currentValue: {},
                        intervals: {},

                    };
                }

                userTimers[userId].startValue[results.insertId] = timerValue;
                userTimers[userId].currentValue[results.insertId] = timerValue;
                io.emit("addClientTimer", userId, results.insertId, timerValue);
            });
        });
    });

    // Invia il timer attuale al nuovo client connesso
    socket.on("startStop", ( userId, timerId) => {
            if(!userTimers[userId]) return;

            if (userTimers[userId].intervals[timerId]) {
                clearInterval(userTimers[userId].intervals[timerId]);
                userTimers[userId].intervals[timerId] = null;
            } else {
                userTimers[userId].intervals[timerId] = setInterval(() => {
                if (userTimers[userId].currentValue[timerId] > 0) {
                    userTimers[userId].currentValue[timerId] -= 1;
                    io.emit('updateTimer', timerId, userTimers[userId].currentValue[timerId]);
                } else {
                    clearInterval(userTimers[userId].intervals[timerId]);
                    userTimers[userId].intervals[timerId] = null;
                }
                }, 1);
            }
        
    });



    socket.on("resetTimer", (userId, timerId) => {

        if (!userTimers[userId]) return;
    
        userTimers[userId].currentValue[timerId] = userTimers[userId].startValue[timerId];
    
        if (userTimers[userId].intervals[timerId]) {
            clearInterval(userTimers[userId].intervals[timerId]);
            userTimers[userId].intervals[timerId] = null;
        }
    
        io.emit("updateTimer", timerId, userTimers[userId].currentValue[timerId]);
    });

    socket.on("deleteTimer", (userId, timerId) => {
        let sql = "DELETE FROM timer.timers WHERE id=?";
        connection.query(sql, [timerId], (err, results) => {
            if (err) console.log(err);

            // Rimuovi il timer dall'array dell'utente
            if (userTimers[userId]){
                // Ferma l'intervallo del timer
                clearInterval(userTimers[userId].intervals[timerId]);
                delete userTimers[userId].startValue[timerId];
                delete userTimers[userId].currentValue[timerId]
                delete userTimers[userId].intervals[timerId];
            }

            io.emit("deleteClientTimer", timerId);
        });
    });


    // Search if the user belongs to the group
    socket.on("enterGroup", (groupId, userId) =>{
        // Needs the check for the user belonging to the group.

        let sql = "SELECT groups.*, timers.* FROM timer.groups INNER JOIN timer.timers ON groups.fk_timer = timers.id WHERE groups.id = ?";
        connection.query(sql, [groupId, userId], (err, results)=>{
            if(err) console.log(err);

            let groupCreatorId = results[0].user_id;
            let timerId = results[0].id;
            if(userTimers[groupCreatorId] === undefined){
                userTimers[groupCreatorId] = { 
                    startValue: {},
                    currentValue: {},
                    intervals: {}
                }
            }
            if(userTimers[groupCreatorId].startValue[timerId] === undefined){  
                // initialize the timer the user is not logged
                userTimers[groupCreatorId].startValue[timerId] = results[0].time;
                userTimers[groupCreatorId].currentValue[timerId] = results[0].time;
            }else{
                // set the starting lenght of the timers as the values used in the already open clients
                    results[0].time = userTimers[groupCreatorId].currentValue[timerId];
            }
            socket.emit('initializeTimers', [{id: timerId, value: results[0].time}]);
            console.log(userTimers);
        })
    });

});
