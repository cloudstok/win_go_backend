const  routes = require('express').Router()

routes.get('/' ,async (req ,res)=>{
    res.send({status: true, msg : "Color Game Testing Successfully 👍"})
});

module.exports = {routes}