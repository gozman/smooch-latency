const smoochCore = require('smooch-core');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const Guid = require('guid');
const Cachet = require('cachet-node').Cachet;

require('dotenv').config()

var queue = [];
var counter = 0;
var appUserId = '';

function sendMessage() {
  if (process.env.MAX_RETRIES && counter >= process.env.MAX_RETRIES) {
    var accum = 0;

    for (var i = 0; i < queue.length; i++) {
      accum += queue[i].delta;
    }

    var avg = accum / queue.length;

    console.log("-------------------------------------------------------------------------------\n");
    console.log(" Number of messages sent: " + queue.length);
    console.log(" Average latency: " + avg + "ms\n");
    console.log("-------------------------------------------------------------------------------\n");

    if (process.env.CACHET_TOKEN) {
      const cachet = new Cachet({
        domain: process.env.CACHET_URL,
        token: {
          value: process.env.CACHET_TOKEN,
          headerOrQueryName: 'X-Cachet-Token'
        }
      });

      var ts = Math.round((new Date()).getTime() / 1000);

      cachet.createMetricPointById({
          metric: 1,
          body: {
            value: avg,
            timestamp: ts
          }
        }).then(response => {
          console.log(response.body);
          process.exit();
        })
        .catch(err => {
          console.log(err);
          process.exit();
        });
    } else {
      process.exit();
    }
  } else {

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
}

app.use(bodyParser.json());

app.post('/hook', function(req, res) {
  if (req.body.appUser._id == appUserId && req.body.trigger == "message:appUser") {
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

app.listen(process.env.LATENCY_PORT, function() {
  console.log('Latency tester listening on port ' + process.env.LATENCY_PORT);
})

var smooch = new smoochCore({
  keyId: process.env.SMOOCH_KEY,
  secret: process.env.SMOOCH_SECRET,
  scope: 'app'
});

var deviceId = Guid.raw();

//Kill process if we haven't done so in 5 minutes - we're basically down
setTimeout(function() {
  process.exit();
}, 5*60*1000);

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

  for (var i = 0; i < queue.length; i++) {
    accum += queue[i].delta;
  }

  if (queue.length) {
    console.log("-------------------------------------------------------------------------------\n");
    console.log(" Number of messages sent: " + queue.length);
    console.log(" Average latency: " + accum / queue.length + "ms\n");
    console.log("-------------------------------------------------------------------------------\n");
  }

  process.exit();
});
