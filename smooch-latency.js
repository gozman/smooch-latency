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
  var obj = {
    start: Date.now()
  }

  queue[counter] = obj;

  smooch.appUsers.sendMessage(appUserId, {
    text: counter.toString(),
    role: 'appUser',
    type: 'text'
  });

  counter++
}

app.use(bodyParser.json());

app.post('/hook', function (req, res) {
  if(req.body.appUser._id == appUserId && req.body.trigger == "message:appUser") {
    var idx = req.body.messages[0].text;
    var obj = queue[idx];
    obj.end = Date.now();
    obj.delta = obj.end - obj.start;
    queue[idx] = obj;

    console.log("Received message " + idx + " - Webhook Latency: " + obj.delta + "ms");
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
    console.log(" Testing latency using AppUser with ID: " + appUserId + "\n");
    console.log("-------------------------------------------------------------------------------");
    sendMessage();
});

process.on('SIGINT', function() {
    console.log("\n Caught interrupt signal \n");

    var accum = 0;

    for(var i=0; i<queue.length; i++) {
      accum += queue[i].delta;
    }

    if(queue.length) {
      console.log("-------------------------------------------------------------------------------\n");
      console.log(" Number of messages sent: " + queue.length);
      console.log(" Average latency: " + accum/queue.length + "ms\n");
      console.log("-------------------------------------------------------------------------------\n");
    }

    process.exit();
});
