var Task = require('./task');
const prompt = require('prompt-sync')();
const say = require('say');
const util = require ('./util.js')

const keys = {      0:'A',
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
            this.status.keys = args.status.keys
        } else {
            this.status.keys = [];
       }

       if (args && args.status.keyStatus) {
            this.status.keyStatus = args.status.keyStatus
       } else {
            this.status.keyStatus = {
                0: { sessions: [],
                    nextTime: null }, 
                1:{ sessions: [],
                    nextTime: null }, 
                2:{ sessions: [],
                    nextTime: null }, 
                3:{ sessions: [],
                    nextTime: null }, 
                4:{ sessions: [],
                    nextTime: null }, 
                5:{ sessions: [],
                    nextTime: null }, 
                6:{ sessions: [],
                    nextTime: null }, 
                7:{ sessions: [],
                    nextTime: null }, 
                8:{ sessions: [],
                    nextTime: null }, 
                9:{ sessions: [],
                    nextTime: null }, 
                10:{ sessions: [],
                    nextTime: null }, 
                11:{ sessions: [],
                    nextTime: null },     
                };
        }
    }

    start(callback)  {
        
        console.log('Task: '+this.settings.name+' in the key of ' + keys[this.currentKey] +' for '+ util.convertSeconds(this.this_time));
        util.sayThing(this.settings.name + ' in the key of ' + keys[this.currentKey] + '. Press enter when ready to begin.', () => {            
            var wait = prompt('Press enter');
            if (wait == 'q') {
                callback(false)
            }
            this.start_time = util.nowInSeconds();
            this.practiceRoutine(this.this_time, callback);           
        });
    }

    done = (callback) => {
        util.sayThing('Finished', () => {
            this.finished_time = util.nowInSeconds();            
            this.status.keyStatus[this.currentKey].sessions.push([this.start_time, this.finished_time]);
            this.status.sessions.push([this.start_time, this.finished_time]);
            this.checkCompletion(callback);        
        });
    }

    checkCompletion = (callback) => {

        console.log('How much time to you want to spend on this key time? (minutes)')
        console.log('Press enter to keep the time ranges as set.')
        var nextTime = prompt('');
        if ( nextTime.trim() == "") { 
            this.status.keyStatus.next_time = null;           
        } else {
            nextTime = parseInt(nextTime);
            if (! nextTime ) {
                console.log('Try again.')
                return this.checkCompletion();
            }
            this.status.keyStatus.next_time = nextTime * 60;
        }   
        return callback(true);
    }

    randomizeSessionTime = () => {
        this.currentKey = this.pickRandomKey();
        if ( this.status.keyStatus[this.currentKey].nextTime) {
            this.this_time = this.status.keyStatus[this.currentKey].nextTime
        } else {
            var timeRange = this.settings.max_time - this.settings.min_time;
            if (timeRange > 0) {
                const offset = Math.floor(Math.random() * timeRange);
                this.this_time = this.settings.min_time + offset;
            }
        }
        return this.this_time;
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
        return this_key;
    }

}

module.exports = KeyRotation;