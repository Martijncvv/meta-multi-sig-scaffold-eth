const Joi = require('joi')
const express = require('express')
const app = express()

app.use(express.json())

app.use((req, res, next) => {
	res.append('Access-Control-Allow-Origin', ['*'])
	res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
	res.append('Access-Control-Allow-Headers', 'Content-Type')
	next()
})

let transactions = {}

app.get('/api/txInfo/:nonce', (req, res) => {
	let txInfo = transactions[req.params.nonce]
	console.log('TX INFO________4')
	console.log(txInfo)
	if (!txInfo) res.status(404).send('Signatures for given tx nonce not found')

	res.send(txInfo)
})

app.post('/api/storeTx/', (req, res) => {
	const validationSchema = Joi.object({
		nonce: Joi.number().min(0).required(),
		creator: Joi.string().min(5).required(),
		to: Joi.string().min(5).required(),
		unencodedCalldata: Joi.string().min(5).required(),
		calldataAbi: Joi.string().min(5).required(),
		value: Joi.string(),
		signatures: Joi.string().min(5).required(),
	})

	const result = validationSchema.validate(req.body)

	if (result.error) {
		res.status(400).send(result.error)
		return
	}

	let txInfo = transactions[req.body.nonce]
	console.log('TXINFO____________1')
	console.log(txInfo)
	if (txInfo) {
		res.status(407).send('Double Tx; Tx with current nonce already created.')
		return
	} else {
		txInfo = {
			nonce: req.body.nonce,
			creator: req.body.creator,
			to: req.body.to,
			unencodedCalldata: req.body.unencodedCalldata,
			calldataAbi: req.body.calldataAbi,
			value: req.body.value,
			signatures: [req.body.signatures],
			executed: false,
		}
		console.log('TXINFO____________2')
		console.log(txInfo)
		transactions[req.body.nonce] = txInfo
		console.log('TRANSACTIONS________3')
		console.log(transactions)
	}
	res.send(txInfo)
})

app.put('/api/signTx/', (req, res) => {
	const validationSchema = Joi.object({
		nonce: Joi.number().min(0).required(),
		signature: Joi.string().min(5).required(),
	})

	const result = validationSchema.validate(req.body)

	if (result.error) {
		res.status(400).send(result.error)
		return
	}

	let txInfo = transactions[req.body.nonce]
	if (txInfo) {
		if (txInfo.signatures.includes(req.body.signature)) {
			res.status(406).send('Double signature; Account signed already.')
			return
		} else {
			transactions[req.body.nonce].signatures.push(req.body.signature)
		}
	} else {
		res.status(404).send('No tx for nonce found')
		return
	}
	res.send(txInfo)
	return
})

app.put('/api/setTxSent/', (req, res) => {
	const validationSchema = Joi.object({
		nonce: Joi.number().min(0).required(),
	})

	const result = validationSchema.validate(req.body)

	if (result.error) {
		res.status(400).send(result.error)
		return
	}

	let txInfo = transactions[req.body.nonce]
	if (!txInfo) res.status(404).send('Tx nonce not found')

	txInfo.executed = true

	res.send(txInfo)
})

app.put('/api/resetDb/', (req, res) => {
	transactions = {}
	res.send('db resetted')
})

const port = process.env.PORT || 5000
app.listen(port, () => {
	console.log(`Listening on port ${port}`)
})

// 0xFB76057e610aC2746B68E23501319BbA8EF7cCDc
// .
