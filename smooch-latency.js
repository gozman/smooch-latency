const smoochCore = require('smooch-core');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Guid = require('guid');

require('dotenv').config()

var queue = [];
var counter = 0;
var appUserId = '';

function sendMessage() {
  queue[counter] = Date.now();

  smooch.appUsers.sendMessage(appUserId, {
    text: counter.toString(),
    role: 'appUser',
    type: 'text'
  });

  counter++
}

app.use(bodyParser.json());

app.post('/hook', function (req, res) {
  if(req.body.appUser._id == appUserId) && req.body.trigger == "message:appUser") {
    var ts = Date.now();
    var idx = req.body.messages[0].text;
    var delta = ts - queue[idx];
    console.log("Received message " + idx + " - Webhook Latency: " + delta + "ms");

    setTimeout(sendMessage, 1000);
  } else if (req.body.trigger == "message:appUser") {
    console.log("INFO - Ignoring a received a webhook for user " + req.body.appUser._id + ", but we're tracking " + appUserId);
  } else {
    console.log("INFO - Ignoring a received a webhook triggered on " + req.body.trigger);
  }

  res.sendStatus(200);
})

app.listen(3000, function () {
  console.log('Latency tester listening on port 3000!')
})

var smooch = new smoochCore({
    keyId: process.env.SMOOCH_KEY,
    secret: process.env.SMOOCH_SECRET,
    scope: 'app'
});

var deviceId = Guid.raw();

//Initialize the device
smooch.appUsers.init({
    device: {
        id: deviceId,
        platform: 'other',
        appVersion: '1.0'
    }
}).then((response) => {
    appUserId = response.appUser._id;
    sendMessage(appUserId);
});
