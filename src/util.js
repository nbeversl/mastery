const say = require('say');
const loudness = require('loudness');

nowInSeconds = () => {
    return Math.round(new Date().getTime() / 1000); // UNIX
}

sayThing = (message, callback) => {

    loudness.getVolume()
        .then( (vol) => {
            loudness.setVolume(35);
            return vol
        })
        .then( (vol) => { 
            say.speak(message, 'Alex', 1.2, () => {
                loudness.setVolume(vol);
                if (callback) { callback(); }
            });            

        });
}


module.exports = { nowInSeconds, sayThing };