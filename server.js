const express = require('express')

const PORT = 3333
const HOST = '0.0.0.0'

const app = express()

const stastRoute = require('./src/routes/stat.routes')

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use('/api/', stastRoute)

app.get('/', (req, res) => {
    res.send('Hello, App!')
})

app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`)
})