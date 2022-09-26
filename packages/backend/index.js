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

const transactions = [];

app.get("/api/txInfo/:nonce", (req, res) => {
  const txInfo = transactions.find(
    (tx) => tx.nonce === parseInt(req.params.nonce)
  );
  if (!txInfo) res.status(404).send("Signatures for given tx nonce not found");

  res.send(txInfo);
});

app.post("/api/storeTx/", (req, res) => {
  const validationSchema = Joi.object({
    nonce: Joi.number().min(0).required(),
    creator: Joi.string().min(5).required(),
    to: Joi.string().min(5).required(),
    unencodedCalldata: Joi.string().min(5).required(),
    calldataAbi: Joi.string().min(5).required(),
    value: Joi.string(),
    signatures: Joi.string().min(5).required(),
  });

  const result = validationSchema.validate(req.body);

  if (result.error) {
    res.status(400).send(result.error);
    return;
  }

  let txInfo = transactions.find((tx) => tx.nonce === parseInt(req.body.nonce));
  if (txInfo) {
    transactions[parseInt(req.body.nonce)].signatures.push(req.body.signatures);
  } else {
    txInfo = {
      nonce: transactions.length,
      creator: req.body.creator,
      to: req.body.to,
      unencodedCalldata: req.body.unencodedCalldata,
      calldataAbi: req.body.calldataAbi,
      value: req.body.value,
      signatures: [req.body.signatures],
      executed: false,
    };
    transactions.push(txInfo);
  }
  res.send(txInfo);
});

app.put("/api/signTx/", (req, res) => {
  const validationSchema = Joi.object({
    nonce: Joi.number().min(0).required(),
    signature: Joi.string().min(5).required(),
  });

  const result = validationSchema.validate(req.body);

  if (result.error) {
    res.status(400).send(result.error);
    return;
  }

  let txInfo = transactions.find((tx) => tx.nonce === parseInt(req.body.nonce));
  if (txInfo) {
    if (txInfo.signatures.includes(req.body.signature)) {
      res.status(406).send("Double signature; Account signed already.");
    }
    transactions[parseInt(req.body.nonce)].signatures.push(req.body.signature);
  } else {
    if (!txInfo) res.status(404).send("No tx for nonce found");
  }
  res.send(txInfo);
});

app.put("/api/setTxExecuted/", (req, res) => {
  const validationSchema = Joi.object({
    nonce: Joi.number().min(0).required(),
  });

  const result = validationSchema.validate(req.body);

  if (result.error) {
    res.status(400).send(result.error);
    return;
  }

  const txInfo = transactions.find(
    (tx) => tx.nonce === parseInt(req.body.nonce)
  );
  if (!txInfo) res.status(404).send("Tx nonce not found");

  txInfo.executed = true;

  res.send(txInfo);
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
