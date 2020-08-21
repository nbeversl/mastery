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

/* Zero-pad second integers for track time display */
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }


convertSeconds = (seconds) => { 
    var minutes = Math.floor(seconds / 60);
    var seconds = seconds - minutes * 60;
    return minutes.toString()+':'+pad(seconds,2 ).toString();

}

module.exports = { nowInSeconds, sayThing, pad, convertSeconds};