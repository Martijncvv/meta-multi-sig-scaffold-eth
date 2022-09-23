const Joi = require("joi");
const express = require("express");
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.append("Access-Control-Allow-Origin", ["*"]);
  res.append("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.append("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const txsSignatures = [];

app.get("/api/signatures/:nonce", (req, res) => {
  const txInfo = txsSignatures.find(
    (tx) => tx.nonce === parseInt(req.params.nonce)
  );
  if (!txInfo) res.status(404).send("Signatures for given tx nonce not found");

  res.send(txInfo);
});

app.post("/api/postsignatures/", (req, res) => {
  const validationSchema = Joi.object({
    nonce: Joi.number().min(0).required(),
    signature: Joi.string().min(5).required(),
  });

  const result = validationSchema.validate(req.body);

  if (result.error) {
    res.status(400).send(result.error);
    return;
  }

  let txInfo = txsSignatures.find(
    (tx) => tx.nonce === parseInt(req.body.nonce)
  );
  if (txInfo) {
    txsSignatures[parseInt(req.body.nonce)].signatures.push(req.body.signature);
  } else {
    txInfo = {
      nonce: txsSignatures.length,
      signatures: [req.body.signature],
    };
    txsSignatures.push(txInfo);
  }
  res.send(txInfo);
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

// const path = require("path");
// let pathObj = path.parse(__filename);
// console.log(pathObj);

// const os = require("os");
// let totalMemory = os.totalmem();
// let freeMemory = os.freemem();
// console.log("Free Memory:  " + freeMemory);
// console.log("Total Memory: " + totalMemory);

// const fs = require("fs");
// fs.readdir("./", function (err, files) {
//   if (err) console.log("Error", err);
//   else console.log("Result", files);
// });

// const EventEmitter = require("events");
// const Logger = require("./logger");
// const logger = new Logger();
// logger.log("message");

// const http = require("http");
// const server = http.createServer((req, res) => {
//   if (req.url === "/") {
//     res.write("Hello world");
//     res.end();
//   }

//   if (req.url === "/api/courses") {
//     res.write(JSON.stringify([1, 2, 3, 4]));
//     res.end();
//   }
// });

// server.listen(3000);

// console.log("Listening on port 3000");

// const courses = [
//   { id: 1, name: "cours1" },
//   { id: 2, name: "cours22" },
//   { id: 3, name: "cours333" },
// ];

// app.post("/api/courses/", (req, res) => {
//   const schema = {
//     name: Joi.string().min(3).required(),
//   };

//   const result = Joi.validate(req.body, schema);
//   console.log(result);
//   if (result.error) {
//     res.status(400).send(result.error);
//   }
//   const course = {
//     id: courses.length + 1,
//     name: req.body.name,
//   };
//   courses.push(course);
//   res.send(course);
// });

// app.get("/api/courses:year:month", (req, res) => {
//   res.send(req.query);
// });
// app.get("/api/courses/:id", (req, res) => {
//   const course = courses.find((c) => c.id === parseInt(req.params.id));
//   if (!course) res.status(404).send("Course with given ID was not found");
//   res.send(course);
// });
