/*

TODO:
    - Rendi tutte le funzioni del database await/async
*/

function startStop(socket, userId, timerId) {
    if (userTimers[userId].currentValue[timerId] == null) {
      userTimers[userId].currentValue[timerId] = userTimers[userId].startValue[timerId];
    }
  
    // Pausa: se il timer è attivo, lo fermiamo
    if (userTimers[userId].intervals[timerId]) {
      clearInterval(userTimers[userId].intervals[timerId]);
      userTimers[userId].intervals[timerId] = null;
      return;
    }
  
    // Avvio o ripresa
    const resumeTime = Date.now();
    const initialRemaining = userTimers[userId].currentValue[timerId];
  
    userTimers[userId].intervals[timerId] = setInterval(() => {
      const elapsed = Date.now() - resumeTime;
      const remaining = initialRemaining - elapsed;
  
      if (remaining <= 0) {
        clearInterval(userTimers[userId].intervals[timerId]);
        userTimers[userId].intervals[timerId] = null;
        userTimers[userId].currentValue[timerId] = 0;
        io.emit("updateTimer", timerId, 0);
      } else {
        userTimers[userId].currentValue[timerId] = remaining;
        io.emit("updateTimer", timerId, Math.floor(remaining));
      }
    }, 1);
  }

// express
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// Serve i file statici dalla cartella "client"
app.use(express.static(path.join(__dirname, 'client')));

// Ritorna index.html per la root "/"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Crea un unico server
const server = http.createServer(app);

// Inizializza Socket.IO sul server creato
const io = new Server(server, {
  cors: {
    origin: "*", // 🔒 meglio usare l’URL Netlify in produzione
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});

  // connect to DB
  require("dotenv").config();
  const urlDB = `mysql://root:${process.env.MYSQLPASSWORD}@mysql.railway.internal:3306/railway`
  let mysql = require("mysql2");
  var connection = mysql.createConnection(urlDB);
  
  // Collect
  
  async function getGroupInfo(connection, groupId, userId){
    let sql = `
             SELECT g.name AS group_name, g.user_id , t.id AS timer_id, t.time AS timer_value, t.user_id AS timer_admin_id
             FROM timer.groups g
             INNER JOIN timer.timers t ON g.fk_timer = t.id
             WHERE g.id = ? AND (g.user_id = ? OR EXISTS (
                 SELECT 1
                 FROM timer.notifications n
                 WHERE n.fk_user = ? AND n.fk_group = g.id AND n.status = 'accepted'
             ))
         `;
    return new Promise((resolve, reject)=>{
        connection.query(sql, [groupId, userId, userId], (err, results) => {
            if (err) {
              console.error("Errore durante la verifica del gruppo:", err.message);
              reject(err);
            }
      
            if(results.length === 0){
                resolve(null);
            }
            // if (results.length === 0) {
            //   socket.emit(
            //     "groupAccessDenied",
            //     "Non sei autorizzato a entrare in questo gruppo."
            //   );
            //   return;
            // }
      
            const groupName = results[0].group_name;
            const groupCreatorId = results[0].user_id;
            const timerId = results[0].timer_id;
            const timerValue = results[0].timer_value;
            const timerAdminId = results[0].timer_admin_id;

            resolve([groupName, groupCreatorId, timerId, timerValue, timerAdminId]);
        });
    });

  }

  async function getUserTimers(connection, userId) {
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
  
  io.on("connection", (socket) => {
    console.log(`Client connesso: ${socket.id}`);
  
    // Gestisce l'autenticazione
    socket.on("login", (username, password) => {
      const sql = `SELECT * FROM timer.users WHERE name = ? AND password = SHA2(?, 256)`;
      connection.query(sql, [username, password], (error, results) => {
        if (error) {
          console.error("Errore nel server: ", error.message);
          socket.emit("loginError", "Errore nel server");
          return;
        }
  
        if (results.length === 0) {
          socket.emit("loginError", "Nome utente o password non corretti");
          return;
        }
  
        const user = results[0];
        socket.emit("loginSuccess", { userId: user.id, username: user.name });
      });
    });
  
    // Gestione della registrazione
    socket.on("register", (username, password) => {
      const checkUserSql = "SELECT * FROM timer.users WHERE name = ?";
      connection.query(checkUserSql, [username], (err, results) => {
        if (err) {
          console.error("Errore durante la registrazione:", err.message);
          socket.emit(
            "registerError",
            "Errore durante la registrazione. Riprova."
          );
          return;
        }
  
        if (results.length > 0) {
          socket.emit(
            "registerError",
            "Username già in uso. Scegli un altro username."
          );
          return;
        }
  
        // Inserimento dell'utente senza specificare l'ID
        const insertUserSql =
          "INSERT INTO timer.users (name, password) VALUES (?, SHA2(?, 256));";
        connection.query(
          insertUserSql,
          [username, password],
          (insertErr, insertResults) => {
            if (insertErr) {
              console.error(
                "Errore durante l'inserimento dell'utente:",
                insertErr.message
              );
              socket.emit(
                "registerError",
                "Errore durante la registrazione. Riprova."
              );
              return;
            }
  
            console.log("Utente registrato con ID:", insertResults.insertId);
            socket.emit(
              "registerSuccess",
              "Registrazione completata con successo! Ora puoi effettuare il login."
            );
          }
        );
      });
    });
  
    socket.on("sendUserId", async (userId) => {
      try {
        await connection.connect();
        let timers = await getUserTimers(connection, userId);
        if (userTimers[userId] === undefined) {
          userTimers[userId] = {
            startValue: {},
            currentValue: {},
            intervals: {},
          };
        }
  
        // initialize the timer the user is not logged
        timers.forEach((timer) => {
          if (userTimers[userId].startValue[timer.id] === undefined) {
            userTimers[userId].startValue[timer.id] = timer.value;
            userTimers[userId].currentValue[timer.id] = timer.value;
          } else {
            // set the starting lenght of the timers as the values used in the already open clients
            timer.value = userTimers[userId].currentValue[timer.id];
          }
        });
  
        socket.emit("initializeTimers", timers);
      } catch (err) {
        console.error("Errore: ", err);
      }
    });
  
    socket.on("addTimer", (userId, timerValue) => {
      connection.connect(() => {
        let sql = "INSERT INTO timer.timers VALUES (NULL, ?, ?,0)";
        connection.query(
          sql,
          [Number(timerValue), Number(userId)],
          (error, results) => {
            if (error) console.log(error);
  
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
          }
        );
      });
    });
  
    // Invia il timer attuale al nuovo client connesso
    socket.on("startStop", (userId, timerId) => {
        startStop(socket,userId,timerId);
    });
  
    socket.on("resetTimer", (userId, timerId) => {
      if (!userTimers[userId]) return;
  
      userTimers[userId].currentValue[timerId] =
        userTimers[userId].startValue[timerId];
  
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
        if (userTimers[userId]) {
          // Ferma l'intervallo del timer
          clearInterval(userTimers[userId].intervals[timerId]);
          delete userTimers[userId].startValue[timerId];
          delete userTimers[userId].currentValue[timerId];
          delete userTimers[userId].intervals[timerId];
        }
  
        io.emit("deleteClientTimer", timerId);
      });
    });
  
    // Search if the user belongs to the group
    socket.on("enterGroup", async (groupId, userId) => {
        try{
            await connection.connect();
            let groupInfo = await getGroupInfo(connection, groupId, userId);

            if(groupInfo === null){
                socket.emit(
                    "groupAccessDenied",
                    "Non sei autorizzato a entrare in questo gruppo."
                );
                return;
            }

            let groupName = groupInfo[0];
            let groupCreatorId = groupInfo[1];
            let timerId = groupInfo[2];
            let timerValue = groupInfo[3];
            let timerAdminId = groupInfo[4];

            if (!userTimers[groupCreatorId]) {
                userTimers[groupCreatorId] = {
                  startValue: {},
                  currentValue: {},
                  intervals: {},
                };
              }
        
              if (!userTimers[groupCreatorId].startValue[timerId]) {
                userTimers[groupCreatorId].startValue[timerId] = timerValue;
                userTimers[groupCreatorId].currentValue[timerId] = timerValue;
              } else {
                timerValue =
                  userTimers[groupCreatorId].currentValue[timerId];
              }
        
              socket.emit("initializeTimers", {
                groupName: groupName,
                timers: [{ id: timerId, value: timerValue, user_id: timerAdminId}],
              });

        }catch(err){
            console.log(err.message);
        }
    });
  

    socket.on("getUsers", (currentUserId) => {
      const sql = "SELECT id, name FROM timer.users WHERE id != ?";
      connection.query(sql, [currentUserId], (err, results) => {
        if (err) {
          console.error("Errore durante il recupero degli utenti:", err.message);
          socket.emit("usersError", "Errore durante il recupero degli utenti.");
          return;
        }
  
        socket.emit("usersList", results); // Invia la lista degli utenti al client
      });
    });
  
    // Gestisce l'invio di inviti agli utenti
    socket.on("sendGroupInvites", (groupId, senderId, invitedUserIds) => {
      invitedUserIds.forEach((userId) => {
        const sql =
          "INSERT INTO timer.notifications (fk_user, fk_group, status) VALUES (?, ?, 'sent')";
        connection.query(sql, [userId, groupId], (err) => {
          if (err) {
            console.error("Errore durante l'invio dell'invito:", err.message);
            socket.emit(
              "inviteError",
              `Errore durante l'invio dell'invito a userId ${userId}`
            );
            return;
          }
  
          // Notifica il destinatario dell'invito
          io.emit(`groupInvite_${userId}`, { groupId, senderId });
        });
      });
  
      socket.emit("inviteSuccess", "Inviti inviati con successo!");
    });
  
    // Gestisce l'accettazione dell'invito
    socket.on("acceptGroupInvite", (groupId, userId) => {
      const updateSql =
        "UPDATE timer.notifications SET status = 'accepted' WHERE fk_user = ? AND fk_group = ?";
      connection.query(updateSql, [userId, groupId], (err) => {
        if (err) {
          console.error(
            "Errore durante l'accettazione dell'invito:",
            err.message
          );
          socket.emit(
            "acceptInviteError",
            "Errore durante l'accettazione dell'invito."
          );
          return;
        }
        socket.emit("acceptInviteSuccess", "Invito accettato con successo!");
        socket.emit("enterGroup", groupId, userId); // L'utente entra nel gruppo
      });
    });
  
    // Gestisce il rifiuto dell'invito
    socket.on("declineGroupInvite", (groupId, userId) => {
      const updateSql =
        "UPDATE timer.notifications SET status = 'declined' WHERE fk_user = ? AND fk_group = ?";
      connection.query(updateSql, [userId, groupId], (err) => {
        if (err) {
          console.error("Errore durante il rifiuto dell'invito:", err.message);
          socket.emit(
            "declineInviteError",
            "Errore durante il rifiuto dell'invito."
          );
          return;
        }
  
        socket.emit("declineInviteSuccess", "Invito rifiutato.");
      });
    });
  
    // Recupera le notifiche per un utente
    socket.on("getNotifications", (userId) => {
      const sql = `
             SELECT notifications.id, notifications.fk_group, groups.name AS group_name, notifications.status
             FROM timer.notifications
             INNER JOIN timer.groups ON notifications.fk_group = groups.id
             WHERE notifications.fk_user = ? AND notifications.status = 'sent'
         `;
      connection.query(sql, [userId], (err, results) => {
        if (err) {
          console.error(
            "Errore durante il recupero delle notifiche:",
            err.message
          );
          socket.emit(
            "notificationsError",
            "Errore durante il recupero delle notifiche."
          );
          return;
        }
  
        socket.emit("notificationsList", results); // Invia le notifiche al client
      });
    });
  
    socket.on("acceptNotification", (notificationId, userId) => {
        const selectSql =
          "SELECT fk_group FROM timer.notifications WHERE id = ? AND fk_user = ?";
        
        connection.query(selectSql, [notificationId, userId], (err, results) => {
          if (err) {
            console.error(
              "Errore durante il recupero del groupId:",
              err.message
            );
            socket.emit(
              "notificationActionError",
              "Errore durante l'elaborazione della notifica."
            );
            return;
          }
      
          if (results.length === 0) {
            socket.emit(
              "notificationActionError",
              "Nessuna notifica trovata."
            );
            return;
          }
      
          const groupId = results[0].fk_group;
      
          const updateSql =
            "UPDATE timer.notifications SET status = 'accepted' WHERE id = ? AND fk_user = ?";
          
          connection.query(updateSql, [notificationId, userId], (err, updateResults) => {
            if (err) {
              console.error(
                "Errore durante l'accettazione della notifica:",
                err.message
              );
              socket.emit(
                "notificationActionError",
                "Errore durante l'accettazione della notifica."
              );
              return;
            }
      
            socket.emit(
              "notificationActionSuccess",
              "Notifica accettata con successo."
            )
            io.emit("userAccept", groupId, userId);
          });
        });
      });
  
    // Gestisce il rifiuto di una notifica
    socket.on("declineNotification", (notificationId, userId) => {
      const selectSql =
          "SELECT fk_group FROM timer.notifications WHERE id = ? AND fk_user = ?";
      connection.query(selectSql, [notificationId, userId], (err,results)=>{
        if(err) console.log(err);
        console.log(results);
        const groupId = results[0].fk_group;
        const updateSql =
        "UPDATE timer.notifications SET status = 'declined' WHERE id = ? AND fk_user = ?";
        connection.query(updateSql, [notificationId, userId], (err) => {
          if (err) {
            console.error("Errore durante il rifiuto della notifica:", err.message);
            socket.emit(
              "notificationActionError",
              "Errore durante il rifiuto della notifica."
            );
            return;
          }
        
          socket.emit(
            "notificationActionSuccess",
            "Notifica rifiutata con successo."
          );

          io.emit("userDecline", groupId, userId);
        });
      });
    });
  
    socket.on("getUserGroups", (userId) => {
      const sql = `
             SELECT g.id, g.name, g.user_id
             FROM timer.groups g
             LEFT JOIN timer.notifications n ON g.id = n.fk_group
             WHERE g.user_id = ? OR (n.fk_user = ? AND n.status = 'accepted')
             GROUP BY g.id
         `;
  
      connection.query(sql, [userId, userId], (err, results) => {
        if (err) {
          console.error("Errore durante il recupero dei gruppi:", err.message);
          socket.emit(
            "userGroupsError",
            "Errore durante il recupero dei gruppi."
          );
          return;
        }
  
        socket.emit("userGroupsList", results); // Invia la lista dei gruppi al client
      });
    });
  
    socket.on("getSentNotifications", (groupId, userId) => {
      const sql = `
             SELECT n.id, u.name AS user_name, n.status, n.fk_user as user_id
             FROM timer.notifications n
             INNER JOIN timer.users u ON n.fk_user = u.id
             WHERE n.fk_group = ? AND EXISTS (
                 SELECT 1 FROM timer.groups g WHERE g.id = ? AND g.user_id = ?
             )
         `;
      connection.query(sql, [groupId, groupId, userId], (err, results) => {
        if (err) {
          console.error(
            "Errore durante il recupero delle notifiche inviate:",
            err.message
          );
          socket.emit(
            "notificationsError",
            "Errore durante il recupero delle notifiche inviate."
          );
          return;
        }
        console.log(results);
        socket.emit("sentNotificationsList", results); // Invia le notifiche al client
      });
    });

    socket.on("deleteGroup", groupId=>{
        const sql = "DELETE FROM timer.groups WHERE id=?";
        connection.query(sql, [groupId], (err)=>{
            if(err) console.error("Errore durante la rimozione dei gruppi: ", err.message);
            io.emit("deleteClientGroup", groupId);
        })
    });


    // Search if the user belongs to the group
    // socket.on("enterGroup", (groupId, userId) => {
    //     const sql = `
    //         SELECT g.name AS group_name, g.user_id, t.id AS timer_id, t.time AS timer_value
    //         FROM timer.groups g
    //         INNER JOIN timer.timers t ON g.fk_timer = t.id
    //         WHERE g.id = ? AND (g.user_id = ? OR EXISTS (
    //             SELECT 1
    //             FROM timer.notifications n
    //             WHERE n.fk_user = ? AND n.fk_group = g.id AND n.status = 'accepted'
    //         ))
    //     `;
    
    //     connection.query(sql, [groupId, userId, userId], (err, results) => {
    //         if (err) {
    //             console.error("Errore durante la verifica del gruppo:", err.message);
    //             socket.emit("groupAccessError", "Errore durante la verifica del gruppo.");
    //             return;
    //         }
    
    //         if (results.length === 0) {
    //             socket.emit("groupAccessDenied", "Non sei autorizzato a entrare in questo gruppo.");
    //             return;
    //         }
    
    //         const groupName = results[0].group_name;
    //         const groupCreatorId = results[0].user_id;
    //         const timerId = results[0].timer_id;
    //         const timerValue = results[0].timer_value;
    
    //         if (!userTimers[groupCreatorId]) {
    //             userTimers[groupCreatorId] = {
    //                 startValue: {},
    //                 currentValue: {},
    //                 intervals: {}
    //             };
    //         }
    
    //         if (!userTimers[groupCreatorId].startValue[timerId]) {
    //             userTimers[groupCreatorId].startValue[timerId] = timerValue;
    //             userTimers[groupCreatorId].currentValue[timerId] = timerValue;
    //         } else {
    //             results[0].timer_value = userTimers[groupCreatorId].currentValue[timerId];
    //         }
    
    //         socket.emit("initializeTimers", {
    //             groupName: groupName,
    //             timers: [{ id: timerId, value: results[0].timer_value }]
    //         });
    //     });
    // });

    socket.on("createGroup", (groupName, userId, invitedUserIds, groupTimerValue) => {
        const insertTimerSql = "INSERT INTO timer.timers VALUES (NULL, ?, ?, 1)";
        connection.query(insertTimerSql, [groupTimerValue, userId], (timerError, timerResults) => {
            if (timerError) {
                console.error("Errore durante la creazione del timer del gruppo:", timerError.message);
                socket.emit("groupCreationError", "Errore durante la creazione del timer del gruppo. Riprova.");
                return;
            }

            const timerId = timerResults.insertId;

            const insertGroupSql = "INSERT INTO timer.groups (name, fk_timer, user_id) VALUES (?, ?, ?)";
            connection.query(insertGroupSql, [groupName, timerId, userId], (groupError, groupResults) => {
                if (groupError) {
                    console.error("Errore durante la creazione del gruppo:", groupError.message);
                    socket.emit("groupCreationError", "Errore durante la creazione del gruppo. Riprova.");
                    return;
                }

                const groupId = groupResults.insertId;

                invitedUserIds.forEach((invitedUserId) => {
                    const insertNotificationSql = "INSERT INTO timer.notifications (fk_user, fk_group, status) VALUES (?, ?, 'sent')";
                    connection.query(insertNotificationSql, [invitedUserId, groupId], (notificationError) => {
                        if (notificationError) {
                            console.error("Errore durante l'invio dell'invito:", notificationError.message);
                            return;
                        }

                        // Notifica l'utente invitato
                        io.to(invitedUserId).emit(`groupInvite_${invitedUserId}`, { groupId, groupName, senderId: userId });
                    });
                });

                if (!userTimers[userId]) {
                    userTimers[userId] = {
                        startValue: {},
                        currentValue: {},
                        intervals: {}
                    };
                }

                userTimers[userId].startValue[timerId] = groupTimerValue;
                userTimers[userId].currentValue[timerId] = groupTimerValue;

                socket.emit("groupCreated", groupId, groupName, timerId);
            });
        });
    });
  });
