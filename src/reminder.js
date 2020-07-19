const prompt = require('prompt-sync')();
const sayThing = require('./index.js');
const fs = require('fs');
var path = require('path');

class Reminder {
    
    constructor(args) {
        if ( args ) {
            this.settings = args.settings;
            this.status = args.status
        } else {
            this.settings = {
                'filename': '',
                'frequency': 3500, // default in seconds
				'active': true,
				'name': '',
				'task_type' : 'Reminder',
            }
            this.status = {
				'time_practiced' :0,
				'sessions' : [[0,0]]
            }
            this.setup();
        }

    } 

    setup() {
        this.preQuestions();
        this.postQuestions();
    }

    preQuestions = () => {
       this.settings.name = prompt('Name this reminder: ');
    }

    postQuestions = () => {
        this.settings.frequency = parseInt(prompt('How often (in minutes) should this happen? '));
        this.settings.message =prompt('What should be said? ');
    }

    startReminding = () => {
        
        var offset = Math.floor(Math.random() * this.settings.frequency);
        this.interval = setTimeout(
            () => {
                sayThing.sayThing(this.settings.message);
                this.startReminding();
            },
            (this.settings.frequency + offset) * 1000,
        );
    }

    stopReminding = () => {
       clearTimeout(this.interval);
    }

    report = () => {
        console.log('Reminder Name:\t\t' +this.settings['name']);
		console.log('Active:\t\t\t'+this.settings.active);
		console.log('Frequency:\t\t'+convertSeconds(this.settings.frequency));
		console.log('Message\:\t\t'+(this.settings.message));
    }

    save = (storageDir) => {
        var task = {
            settings: this.settings,
            status : this.status,
        }
        if (this.settings.filename == '') {
            this.settings.filename = this.settings.name +'.reminder';
        }
        fs.writeFileSync(path.join(storageDir, this.settings.filename), JSON.stringify(task, null, 4));
    }

}

module.exports = Reminder;