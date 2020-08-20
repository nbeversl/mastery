var Task = require('./task');
const prompt = require('prompt-sync')();
const say = require('say');
const util = require ('./util.js')

keys = {    0:'A',
            1:'B-flat',
            2: 'B',
            3: 'C',
            4: 'D-flat',
            5: 'D',
            6: 'E-flat',
            7: 'E',
            8: 'F',
            9: 'G-flat',
            10: 'G',
            11: 'A-flat',
    }

class KeyRotation extends Task {

    constructor(args) {
       
        super(args);
        
        if (args && args.status.keys) { 
            this.status.keys = args.status.keys}
        else {
            this.status.keys = [];
        }
    }

    start(callback)  {
        const key = this.pickRandomKey();
        console.log('Task: '+this.settings.name+' in the key of ' + key +' for '+convertSeconds(this.this_time));
        util.sayThing(this.settings.name + ' in the key of ' + key + '. Press enter when ready to begin.', () => {            
            var wait = prompt('Press enter');
            this.start_time = util.nowInSeconds();
            this.practiceRoutine(this.this_time, callback);
        });
    }

    pickRandomKey() {
        var mostRecentKeys = this.status.keys;

        while (mostRecentKeys.length > 11) {
            mostRecentKeys = mostRecentKeys.slice(11);
        }
        var this_key = Math.floor(Math.random() * 11);

        while (mostRecentKeys.includes(this_key) ) {
             this_key = Math.floor(Math.random() * 12);
        }
        this.status.keys.push(this_key)
        return keys[this_key];
    }

}

module.exports = KeyRotation;