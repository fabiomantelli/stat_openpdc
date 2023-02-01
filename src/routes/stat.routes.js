const express = require('express')
const router = express()
const statController = require('../controller/stat.controller')

router.get('/stat', statController.listStat)

module.exports = router