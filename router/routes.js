const  routes = require('express').Router()

routes.get('/' ,async (req ,res)=>{
    res.send({status: true, msg : "Lottery Game server is up and running👍"})
});

module.exports = {routes}