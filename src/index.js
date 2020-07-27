const prompt = require('prompt-sync')();
const say = require('say');
const loudness = require('loudness');
const Project = require('./project.js');
const Task = require('./task.js');
const Session = require('./session.js');
const Reminder = require('./reminder.js');
const fs = require('fs');
const path = require('path');

class TaskManager {

    constructor(storageDir) {
        this.storageDir = storageDir;
        this.settings = {
            maxWarmupPercent : 3,
        }
        this.tasks = [];
        this.reminders = [];
        this.warmups = [];
        if (! fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir);
            console.log('\nCreated task storage directory.')
        }
        this.taskTypes = {
            'Basic Task' : Task,
            'Reminder' : Reminder,
            'Warmup' : Task,
        }
        this.loadTasks();
    }

    loadTasks = () => {

        var files = fs.readdirSync(this.storageDir);
        if ( files.length == 0 ) { return this.talkToUser(); }
        files.forEach( (file) => {
            fs.readFile(path.join(this.storageDir, file), "utf8", (err,  contents) => {
                if (err) { 
                    console.log(err); 
                    return;
                }
                var args = JSON.parse(contents);
                this.loadTask(args);
                if (files.indexOf(file) + 1 == files.length) { 
                    return this.talkToUser(); 
                }
                });
            });
    }

    loadTask = (args) => {
        
        if (args.settings && Object.keys(this.taskTypes).includes(args.settings.task_type)) {
            var objectType = this.taskTypes[args.settings.task_type];
            var reloadedTask = new objectType(args);
            switch(args.settings.task_type ) {

                case 'Reminder':
                    this.reminders.push(reloadedTask);
                    break;
                case 'Warmup':
                    this.tasks.push(reloadedTask);
                    break;
                case 'Basic Task' :
                    this.tasks.push(reloadedTask);
                    break;
                }
        }
    }
    
    talkToUser = () => {
        if ( this.tasks.length == 0 ) { 
            console.log('\n\nThere are currently no tasks. Choose option 2 to get started.\n\n')
        }

		var actions = [
            {},
            { 
           'name':'Practice now',
           'action': this.startSession,
           },
            { 	
           'name': 'Add Task',
           'action': this.addTask,
           },
           {
           'name' :'Edit Task',
           'action' : this.editTask,
           },
            {
           'name': 'Get a report',
           'action': this.reportTasks,
           },
            {
           'name': 'Quit',
           'action': null,
           }
       ]

       actions.forEach( (action) => {
            if ( actions.indexOf(action) == 0) { return  }    
            console.log(actions.indexOf(action) + '. ' +action.name );
       });

       var choice = prompt('What do you want to do?');
       if (! parseInt(choice) ||  0 > parseInt(choice) > actions.keys().length) {
           console.log('Choose from one of these.')
           return this.talkToUser();
       }
       if ( choice == 5 ) { 
            console.log('Bye.')
            process.exit(0);
        }
       var action = actions[choice];
       if (action.action) {
           action.action();
       } 
    }
    
    startSession = ( ) => {
        if (this.tasks.length == 0) {
            return this.talkToUser()
        }

        var minutes = this.getMinutes();
        var seconds = minutes * 60;
        var session = new Session({
            tasks : this.tasks,
            reminders : this.reminders,
            seconds : seconds,
            storageDir : this.storageDir,
            settings : this.settings,
            whenFinished: this.talkToUser.bind(this),
        });
        session.start();
    }

    getMinutes = () => {

        var minutes = parseInt(prompt('Enter a length of time (in minutes), or <enter> to "just go".'));
        if ( ! minutes ) {
            return 0;
        } 
        return minutes;
    }

    reportTasks = () => {

        console.log('TASKS');
        this.tasks.forEach( (task) => {
            console.log('-----------------------------------');
            task.report();
        });
        console.log('REMINDERS');
        this.reminders.forEach( (reminder) => {
            console.log('-----------------------------------');
            reminder.report();
        });
        this.talkToUser();

    }
    editTask = () => {

        this.tasks.forEach( (task) => {
            console.log(this.tasks.indexOf(task) + 1 + ': ' + task.settings.name)
        });
        var selection = parseInt(prompt('Which task? : '));
        if ( ! selection 
            || selection >= this.tasks.length 
            || selection < 1 ) {
                console.log('\n\nTry again.\n\n')
                this.editTask();
            }
        this.tasks[selection-1].setup();
        this.tasks[selection-1].save(this.storageDir);
        this.talkToUser();
    }
    addTask = () => {

        var typeNames = Object.keys(this.taskTypes);
        for(var i=1; i < typeNames.length +1; i++) {
            console.log(i.toString() + ' : ' + typeNames[i-1]); 
        }
        var selection = parseInt(prompt("which task type?"));
        if (    ! selection 
            || selection >= this.taskTypes.length 
            || selection < 1 ) {
                console.log('\n\nTry again.\n\n');
                this.addTask();
            }
        var taskType = typeNames[selection-1];
        var chosenClass = this.taskTypes[taskType];
        var newTask = new chosenClass();
        newTask.settings.task_type = typeNames[selection-1];
        newTask.save(this.storageDir);
        this.loadTask({ settings : newTask.settings, status : newTask.status} );
        this.talkToUser();
    }
  
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

s = new TaskManager('./task_status');
module.exports.sayThing = sayThing;
