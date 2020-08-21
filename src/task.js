const prompt = require('prompt-sync')();
const say = require('say');
var path = require('path');
const fs = require('fs');
const { parse } = require('path');
const util = require('./util.js');

class Task { 

    constructor(args) {

        if ( args ) {
            this.settings = args.settings;
            this.status = args.status
        } else {
            this.settings = {
                'filename': '',
				'mean_time': null,
				'active': true,
				'name': '',
				'keywords': [],
				'min_time': 600,
				'max_time': 1200,
				'check_difficulty' : false,
				'task_type' : this.task_type, // Override when inheriting
            }
            this.status = {
                'next_session_amount': null,
				'completion': 3,
				'difficulty': [5],
				'priority':3,
				'time_practiced' :0,
                'sessions' : [[0,0]],
                'next_time' : null,
            }
            this.setup();
        }
        this.this_time = 0;
        
    }

    setup(edit) {
        if (edit) {         
           this.isActive();
        }
        if (! this.settings.active) { return }
 
        this.preQuestions();
        this.questions();
        this.postQuestions();
        this.settings.mean_time = this.settings.min_time + this.settings.max_time / 2 ;
        this.status.next_session_amount = null;
    }

    timePracticed() {
        var total = 0;
        this.status.sessions.forEach( (session) => {
            total += (session[1]  - session[0] )
        })
        return Math.round(total);
    }

    isActive() {

        var status = this.settings.active ? 'Active' : 'Not Active';
        const change = prompt('This task is currently '+status+'. Do you want to switch it? (y/n)').toLowerCase();
        if ( change == 'y') {
            this.settings.active = ! this.settings.active;
        }         
        var status = this.settings.active ? 'Active' : 'Not Active';
        console.log('This task is now '+status);        
    }

    postQuestions() {
        
        var keywords = prompt('Give this task some keywords, comma-separated: ' + 
        ( this.settings.keywords ? '(' + this.settings.keywords.join(', ') + ')' : '') )
            .toLowerCase().split(',') || this.settings.keywords;
        
        this.settings.keywords = [];
        keywords.forEach ( (keyword) => {
            this.settings.keywords.push(keyword.trim());
        });

        this.getMinMaxTime();
 
        this.status.priority = parseInt(
            prompt('Give this task a priority from 1-5, 1 highest, 3 is neutral: ' 
            + ( this.status.priority ?  '(' + this.status.priority  + ')' : '')
            )) || this.status.priority;
    }

    getMinMaxTime () {

        this.settings.min_time = parseInt(
            prompt('What is the minimum time needed in minutes? ' + 
            ( this.settings.min_time ? '(' + ( this.settings.min_time / 60 )  +') ' : ''))
            ) * 60 || this.settings.min_time;
    
        this.settings.max_time = parseInt(
            prompt('What is the maximum time you should work on this? ' + 
            ( this.settings.max_time ? '(' + ( this.settings.max_time / 60 ) + ') ' : '' ))) * 60 || this.settings.max_time;

        if (this.settings.min_time > this.settings.max_time) {
            console.log('\nMinimum time must be less than the maximum time.\n\n')
            return this.getMinMaxTime();
        }
    }

    preQuestions() {

        this.settings.name = prompt(
               'Give this task a name: ' + 
                ( this.settings.name ? '(' + this.settings.name +')' : '') 
            ) || this.settings.name;
    }

    askQuestion(question, variable) {
        var currentSetting = variable.toString().trim();
        if ( currentSetting ) {
            question += '(' + currentSetting + ')';
        }
        const response = prompt(question);
        if (! response.trim()) {
            return variable
        }
        return response.trim();
    }

    questions() { return }

    start(callback)  {
        console.log('Task: '+this.settings.name+' for '+util.convertSeconds(this.this_time));
        util.sayThing(this.settings.name + '. Press enter when ready to begin, or q to stop.', () => {            
            var wait = prompt('Press enter');
            if (wait == 'q') {
                return false
            }
            this.start_time = util.nowInSeconds();
            return this.practiceRoutine(this.this_time, callback);
        });
    }

    practiceRoutine = (seconds, callback) => {

        if ( seconds > 120 ) {
            setTimeout( () => {
                console.log('One minute remaining');
                util.sayThing('One minute remaining');
                setTimeout( () => {
                    return this.done(callback);
                }, 60000);

            }, (seconds - 60) * 1000 );
        } else {
        setTimeout( () => {
                this.done(callback);
            }, seconds*1000);
         }
    }

    randomizeSessionTime = () => {
        var timeRange = this.settings.max_time - this.settings.min_time;
        if (timeRange > 0) {
            const offset = Math.floor(Math.random() * timeRange);
            this.this_time = this.settings.min_time + offset;
        }
        return this.this_time;
    }

    done = (callback) => {
        util.sayThing('Finished', () => {
            this.finished_time = util.nowInSeconds();
            this.status.sessions = this.status.sessions || [];
            this.status.sessions.push([this.start_time, this.finished_time]);
            this.checkCompletion(callback);        
        });
    }

    checkCompletion = (callback) => {
        console.log(this.settings.name);
        console.log('How much time to you want to spend on this next time? (minutes)')
        console.log('Press enter to keep the time ranges as set.')
        var nextTime = prompt('');
        if ( nextTime.trim() == "") { 
            this.status.next_time = null;
        } else {
            nextTime = parseInt(nextTime);
            if (! nextTime ) {
                console.log('Try again.')
                return this.checkCompletion();
            }
            this.status.next_time = nextTime * 60;
        }  
        return callback(true);
    }
    
    save = (storageDir) => {
        var task = {
            settings: this.settings,
            status : this.status,
        }
        if (this.settings.filename == '') {
            this.settings.filename = this.settings.name +'.task';
        }
        fs.writeFileSync(path.join(storageDir, this.settings.filename), JSON.stringify(task, null, 4));
    }

    report = () => {
        if (this.status.sessions && this.status.sessions[-1]) {
            console.log(this.status.sessions[-1]);
            var lastPracticed = new Date(this.status.sessions[-1][1]).toISOString();
        } else {
            var lastPracticed = 'never';
        }
        console.log('Task Name:\t\t' +this.settings['name']);
		console.log('Task Type:\t\t'+ this.settings['task_type']);
        console.log('Priority:\t\t' + this.status['priority']);
        if (this.status.time_to_done) {
            console.log('Time Remaining:\t\t'+this.status.time_to_done.join(', '));
        }
		console.log('Total time_practiced:\t'+util.convertSeconds(this.timePracticed()));
        console.log('Last Practiced:\t\t' + 
                ( this.status.sessions.length == 1 ? 'never' 
                : new Date(this.status.sessions[this.status.sessions.length-1][0])).toString());
		console.log('Min Time:\t\t'+util.convertSeconds(this.settings.min_time));
		console.log('Max Time:\t\t'+util.convertSeconds(this.settings.max_time));
		console.log('Keywords:\t\t'+this.settings.keywords.join(', '));
		var status = this.settings.active ? "Active" : "Not Active";
        console.log('Status\t\t\t'+ status);
        if (this.reportCustom) { this.reportCustom(); }
    }
    
    mostRecentSessionTime = () => {
        return this.status.sessions[this.status.sessions.length-1][1]
    }

}


module.exports = Task;