/*

TODO:
    - Rendi tutte le funzioni del database await/async
*/

// Open the socket connection
const io = require("socket.io")(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// connect to DB
let mysql = require("mysql2");
var connection = mysql.createConnection({
  host: "localhost",
  user: "root",
});

// Collect

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
      const timers = results.map((result) => ({
        id: result["id"],
        value: result["time"],
      }));
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
        "INSERT INTO timer.users (name, password) VALUES (?, SHA2(?, 256))";
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
    if (!userTimers[userId]) return;

    if (userTimers[userId].intervals[timerId]) {
      clearInterval(userTimers[userId].intervals[timerId]);
      userTimers[userId].intervals[timerId] = null;
    } else {
      userTimers[userId].intervals[timerId] = setInterval(() => {
        if (userTimers[userId].currentValue[timerId] > 0) {
          userTimers[userId].currentValue[timerId] -= 1;
          io.emit(
            "updateTimer",
            timerId,
            userTimers[userId].currentValue[timerId]
          );
        } else {
          clearInterval(userTimers[userId].intervals[timerId]);
          userTimers[userId].intervals[timerId] = null;
        }
      }, 1);
    }
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
  socket.on("enterGroup", (groupId, userId) => {
    const sql = `
           SELECT g.name AS group_name, g.user_id, t.id AS timer_id, t.time AS timer_value
           FROM timer.groups g
           INNER JOIN timer.timers t ON g.fk_timer = t.id
           WHERE g.id = ? AND (g.user_id = ? OR EXISTS (
               SELECT 1
               FROM timer.notifications n
               WHERE n.fk_user = ? AND n.fk_group = g.id AND n.status = 'accepted'
           ))
       `;

    connection.query(sql, [groupId, userId, userId], (err, results) => {
      if (err) {
        console.error("Errore durante la verifica del gruppo:", err.message);
        socket.emit(
          "groupAccessError",
          "Errore durante la verifica del gruppo."
        );
        return;
      }

      if (results.length === 0) {
        socket.emit(
          "groupAccessDenied",
          "Non sei autorizzato a entrare in questo gruppo."
        );
        return;
      }

      const groupName = results[0].group_name;
      const groupCreatorId = results[0].user_id;
      const timerId = results[0].timer_id;
      const timerValue = results[0].timer_value;

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
        results[0].timer_value =
          userTimers[groupCreatorId].currentValue[timerId];
      }

      socket.emit("initializeTimers", {
        groupName: groupName,
        timers: [{ id: timerId, value: results[0].timer_value }],
      });
    });
  });

  socket.on("createGroup", (groupName, userId, invitedUserIds) => {
    const insertTimerSql = "INSERT INTO timer.timers VALUES (NULL, 3000, ?, 1)";
    connection.query(insertTimerSql, [userId], (timerError, timerResults) => {
      if (timerError) {
        console.error("Error creating group timer:", timerError.message);
        socket.emit(
          "groupCreationError",
          "Failed to create group timer. Please try again."
        );
        return;
      }

      const timerId = timerResults.insertId;

      const insertGroupSql =
        "INSERT INTO timer.groups (name, fk_timer, user_id) VALUES (?, ?, ?)";
      connection.query(
        insertGroupSql,
        [groupName, timerId, userId],
        (groupError, groupResults) => {
          if (groupError) {
            console.error("Error creating group:", groupError.message);
            socket.emit(
              "groupCreationError",
              "Failed to create group. Please try again."
            );
            return;
          }

          const groupId = groupResults.insertId;

          invitedUserIds.forEach((invitedUserId) => {
            const insertNotificationSql =
              "INSERT INTO timer.notifications (fk_user, fk_group, status) VALUES (?, ?, 'sent')";
            connection.query(
              insertNotificationSql,
              [invitedUserId, groupId],
              (notificationError) => {
                if (notificationError) {
                  console.error(
                    "Error sending invite:",
                    notificationError.message
                  );
                  return;
                }

                // Notifica l'utente invitato
                io.to(invitedUserId).emit(`groupInvite_${invitedUserId}`, {
                  groupId,
                  groupName,
                  senderId: userId,
                });
              }
            );
          });

          if (!userTimers[userId]) {
            userTimers[userId] = {
              startValue: {},
              currentValue: {},
              intervals: {},
            };
          }

          userTimers[userId].startValue[timerId] = 0;
          userTimers[userId].currentValue[timerId] = 0;

          socket.emit("groupCreated", groupId, groupName, timerId);
        }
      );
    });
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

  // Gestisce l'accettazione di una notifica
  socket.on("acceptNotification", (notificationId, userId) => {
    const updateSql =
      "UPDATE timer.notifications SET status = 'accepted' WHERE id = ? AND fk_user = ?";
    connection.query(updateSql, [notificationId, userId], (err) => {
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
      );
    });
  });

  // Gestisce il rifiuto di una notifica
  socket.on("declineNotification", (notificationId, userId) => {
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
    });
  });

  socket.on("getUserGroups", (userId) => {
    const sql = `
           SELECT g.id, g.name
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
           SELECT n.id, u.name AS user_name, n.status
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

      socket.emit("sentNotificationsList", results); // Invia le notifiche al client
    });
  });
});
