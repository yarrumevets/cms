const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const port = 3030;
const AWS = require("aws-sdk");
const exifParser = require("exif-parser");
const gm = require("gm").subClass({ imageMagick: true });

// DB stuff.
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;
var MongoClient = mongodb.MongoClient;
var mongoURL = "mongodb://localhost:27017";
var db;

const secret = require("./secret.config");

// For IP forwarding. (also add to nginx: proxy_set_header X-Real-IP $remote_addr;
app.set("trust proxy", true);

app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }
  })
);

// Basic-auth stuff for admin page.
var passport = require("passport");
var Strategy = require("passport-http").BasicStrategy;
passport.use(
  new Strategy(function(userId, password, done) {
    console.log("Attempted user/password: ", userId, " / ", password);
    if (
      userId === secret.basicAuth.username &&
      password === secret.basicAuth.password
    ) {
      // ! Pretend you didn't see this.
      const user = { username: "steve", email: "steve@yarrumevets.com" };
      return done(null, user);
    } else {
      console.log("Access denied!");
      return done(null, false);
    }
  })
);

// All request.
app.use((req, res, next) => {
  // Store request log.
  const reqLog = {};
  // Test string is IPV4 addr, ex: 192.168.0.0, no more, no less.
  // RegExp("^([0-9]{1,3}[\.]){3,3}[0-9]{1,3}$").test(req.ip);
  // Test string contains IPV4, ex: ffff:192.168.0.0:8080
  //RegExp("([0-9]{1,3}[\.]){3,3}[0-9]{1,3}").test(req.ip);
  let ipv;
  if (RegExp("([0-9]{1,3}[.]){3,3}[0-9]{1,3}").test(req.ip)) {
    ipv = 4;
  } else if (
    RegExp("([0-9|a-f|A-F]{1,4}:){7,7}[0-9|a-f|A-F]{1,4}").test(req.ip)
  ) {
    ipv = 6;
  }

  reqLog.ip = {
    address: req.ip,
    ipv,
    dateTime: new Date(),
    userId: null, // @TODO: add this later.
    acceptLanguage: req.get("Accept-Language")
  };

  var dbResult = db.collection("reqLogs").insertOne(reqLog);
  dbResult.then(function(dbResult) {
    var result = dbResult.ops[0];
    next();
  });
});

// Get all posts.
app.get("/posts", function(req, res) {
  console.log("POSTS...");
  var dbResult = db
    .collection("cmsposts")
    .find()
    .toArray((err, results) => {
      console.log("<><><> results <><><>: ", results);
      res.send(JSON.stringify(results));
    });
});

////////////

// a simple endpoint to send sending a file to a server.

app.post("/post-test", function(req, res) {
  // console.log("post-test - req.buffer: ", req.buffer);
  // console.log("req: ", req);

  console.log("getting data stream...");

  let downloaded = 0;

  req.on("data", chunk => {
    downloaded += chunk.length;
    console.log("downloaded: ", downloaded);
  });

  req.on("aborted", () => {
    console.log("A B O R T E D");
  });

  req.on("end", () => {
    res.send("No errors...");
  });
});

////////////

app.post("/post", function(req, res) {
  const file = req.files.file;

  console.log("file: ", file);

  // Parse metadata.
  const parser = exifParser.create(file.data);
  const metaData = parser.parse();
  // console.log("ALL META DATA: ", metaData);
  const tags = stringifyObj(metaData.tags);

  // Either a name supplied in the body, or the oriiginal file name.
  const fileName = req.body.fileName || file.name;

  // Pass all necessary data along to the s3 function pre-function...
  sendObjectToS3(
    fileName,
    file.data,
    req.body.bucket,
    tags,
    req.body.width,
    req.body.height
  ).then(function() {
    // @TODO: Only submit post when a success of the image upload is confirmed.
    const post = {
      imageFileName: fileName,
      imageUrl: "https://s3.amazonaws.com/yarrumevets/images/" + fileName,
      imageCaption: req.body.imagecaption,
      postCaption: req.body.postcaption,
      postBody: req.body.postbody,
      postDate: new Date()
    };
    var dbResult = db.collection("cmsposts").insert(post);
    dbResult.then(function(dbResult) {
      var result = dbResult.ops[0];
      res.send(result);
    });
  });

  res.send("Done! Metadata: " + JSON.stringify(tags));
});

// Set values for all kes as string. Return new object.
const stringifyObj = obj => {
  const stringifiedObj = {};
  Object.keys(obj).forEach((a, y) => {
    stringifiedObj[a] = obj[a].toString();
  });
  return stringifiedObj;
};

/*
  Other options of interest for gm:
    auto-rotate
    blur
    comment - make watermark?
    compress
    contrast
    draw - anotate with primitives ( -fill for filling a primitive )
    flip/flop
    negate (opposite colors)
*/

resizeImage = (imageBuffer, width, height) => {
  let prom;

  if (width && height) {
    const w = parseInt(width);
    const h = parseInt(height);
    prom = new Promise(function(resolve, reject) {
      gm(imageBuffer)
        .autoOrient()
        .resize(w, h)
        .toBuffer(function(err, buffer) {
          console.log("File was resized...");
          if (err) return err;
          resolve(buffer);
        });
    });
  } else {
    // don't attempt resize.
    prom = new Promise(function(resolve, reject) {
      gm(imageBuffer).toBuffer("PNG", function(err, buffer) {
        if (err) return err;
        resolve(buffer);
      });
    });
  }

  return prom;
};

const sendObjectToS3 = (keyName, body, bucketName, metaData, width, height) => {
  console.log();
  console.log("metadata: ", metaData);
  console.log("body: ", body);

  const imageDataPromise = resizeImage(body, width, height);
  return imageDataPromise.then(function(imageData) {
    // Create a promise on S3 service object
    var bucketPromise = new AWS.S3({ apiVersion: "2006-03-01" })
      .createBucket({ Bucket: bucketName })
      .promise();
    // Handle promise fulfilled/rejected states

    bucketPromise
      .then(function(data) {
        // Create params for putObject call
        var objectParams = {
          // ACL: "public-read", // manually set the folder this file goes into to be public first.
          Bucket: bucketName,
          // Key: keyName,
          Key: "images/" + keyName,
          Body: imageData,
          Metadata: metaData
        };
        // Create object upload promise
        var uploadPromise = new AWS.S3({ apiVersion: "2006-03-01" })
          .putObject(objectParams)
          .promise();
        uploadPromise.then(function(data) {
          console.log(
            "Successfully uploaded data to " + bucketName + "/" + keyName
          );
          console.log("response data: ", data);
        });
      })
      .catch(function(err) {
        console.error(err, err.stack);
      });
  }); // image data promise.
};

// Basic auth admin folder.
app.use(
  "/adm",
  passport.authenticate("basic", { session: false }),
  (req, res, next) => {
    console.log("MW");
    next();
  }
);
app.use("/adm", express.static(__dirname + "/admin"));

// Serve public pages
app.use("/", express.static(__dirname + "/dist"));

// Start server and db.
MongoClient.connect(mongoURL, { useNewUrlParser: true }, (err, client) => {
  if (err) {
    console.log("Unable to connect to the mongoDB server. Error:", err);
  } else {
    db = client.db("yarrumevets");
    console.log("Connected to db...");
    app.listen(port, function() {
      console.log("<><><> Server CMS server listening on port " + port + "...");
    });
  }
});
