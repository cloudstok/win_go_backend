const { initColor } = require("../module/colors/event")

const eventRouter = async(io)=> {
    initColor(io)
}

module.exports= { eventRouter}