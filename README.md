# TimeSpot - Online timer

Timespot is a webApp built with pure html & css for the frontEnd and Node.js for the backEnd.<br>
It uses socket.io for updating the timers in real-time across multiple clients.

It features:
- Timer creation and customization
- Groups for sharing a timer between multiple users
- Real-time sincronizzation across multiple devices

## Install guide
You need NodeJs and npm in order to run this application.

modules required:
- mysqli2
- socket.io
- express

To install these modules, run on your terminal  `npm install package-name` for each selected package (if you're on Windows, the powershell terminal may give you some errors, use cmd instead).
After installing the required packages, setup the localhost socket connection and run `node example.js`.

### Credits
- Taglio Lorenzo: back-end implementation of private and group timers, back-end implementation of group destruction and real-time notification responses.
- Massafra Daniele: back-end implementation of login/signup, notification creation and update, group creation.
- Calafiore Andrea: front-end implementation and stylizzation of login, register and group creation pages. Implementation of group and users search functions.
- De Girolamo Marcello: front-end implementation and stylizzation og timer, groups visualizzation and group timer pages. Implementation of timer conversion form millisecs to hh:mm:ss:mmmm and stylizzation of success and error messages.
