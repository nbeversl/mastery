const prompt = require('prompt-sync')();
const sayThing = require('./index.js');


class Session {

    constructor(args) {
        this.storageDir = args.storageDir;
        this.settings = args.settings;
        this.tasks = args.tasks;
        this.reminders = args.reminders;
        this.name = args.name;
        this.seconds = args.seconds;
        this.tasklist = [];
        this.whenFinished = args.whenFinished;
    }

    start = () => {

        this.evalTasks();
        if ( ! this.tasklist ) {
            console.log('There are not enough short tasks for this sessions.')
            return
        }

        if ( this.seconds > 0 ) {
            this.organizeSession(this.seconds);
            this.listSession();
            if ( this.tasklist.length == 0 ) {
                console.log('There are not enough short tasks for this sessions.')
                return
            }
            console.log('Session length is ' + convertSeconds(this.totalSessionTime()));
            this.runTask(0);
        } else {
            this.justGo();
        }

        this.reminders.forEach( (reminder) => {
            reminder.startReminding();
        });

    }
    justGo = () => {
        var mostRecentTime = this.getMostRecentSession();
        if ( mostRecentTime < nowInSeconds() - 43200) {
            if ( this.warmups ) {
                var warmup = this.getLeastRecentlyPracticed(this.warmups)[0];    
                warmup.randomizeSessionTime();
                warmup.start( () => {
                    warmup.save(this.storageDir);
                    this.unlimitedTasks();
                })
            } 
        }  else {
            this.unlimitedTasks();
        }
    }

    unlimitedTasks = () => {
        var possibleTasks = this.getLeastRecentlyPracticed(this.tasks);
        var nextTask = possibleTasks[0];
        nextTask.randomizeSessionTime();
        nextTask.start( () => {
            nextTask.save(this.storageDir);   
            this.unlimitedTasks();     
        });
    }

    runTask = (i) => {
        this.tasklist[i].start( () => { 
            this.tasklist[i].save(this.storageDir);
            i +=1;
            if (i == this.tasklist.length) { 
                this.reminders.forEach( (reminder) => {
                    reminder.stopReminding();
                });
                return this.whenFinished();             
            }
            this.runTask(i);         
        });
    }

    evalTasks = () => {
        var tasks = [];
        var warmups = [];
        this.byKeyword = this.sortTasksByKeyword();
        this.tasks.forEach((task) => {
           
            if ( task.settings.active ) {
                tasks.push(task);
            }
            if ( task.settings.task_type == 'Warmup') {
                warmups.push(task);
            }
            
        });
        this.tasks = tasks;
        this.warmups = shuffle(warmups);
    }

    getMostRecentSession = () => {
        
         var allTasks = this.getLeastRecentlyPracticed(this.tasks);
         return allTasks[allTasks.length-1].mostRecentSessionTime();        
    }

    organizeSession = (seconds) => {
      
        console.log(Object.keys(this.byKeyword).join(', '));
        const chosenKeywords = prompt('Focus on any keyword(s)? (comma-separated, leave blank for no preference): ');
        
        var keywordTasklist = [];
        chosenKeywords.split(',').forEach( (keyword) => {
            keyword = keyword.toLowerCase().trim();
            if (Object.keys(this.byKeyword).includes(keyword)) {
                this.byKeyword[keyword].forEach( (task) => {
                    keywordTasklist.push(task);
                })
            } 
        });

        if ( keywordTasklist == [] ) {
            keywordTasklist = this.tasks;
        }
        this.tasklist = keywordTasklist;
        
        const build = prompt('Build session by: 1. highest priority , 2. even rotation:');

        if (build == '1') {
            var possibleTasks = this.getHighestPriority(this.tasklist);
        } else {
            var possibleTasks = this.getLeastRecentlyPracticed(this.tasklist);
        }
    
        var maxWarmupPercent = this.settings.maxWarmupPercent || 10;
        var maxWarmupTime = seconds * maxWarmupPercent * 0.01;

        // Determine whether to include warmups.
        var mostRecentTime = this.getMostRecentSession();
        console.log('Most recent practice was '+new Date(mostRecentTime).toString());
        var warmups = [];

        if ( mostRecentTime < nowInSeconds() - 43200) {  // 12 hours
            
            var total = 0;
            var possibleWarmups = this.getLeastRecentlyPracticed(this.warmups);    
            for (var i =0; i < this.warmups.length; i++) {
                var warmup = this.warmups[i];
                warmup.randomizeSessionTime();
                warmups.push(warmup);
                if ( this.totalSessionTime() > maxWarmupTime ) { break }
            }
            seconds -= total;
        } else {
            console.log('Not including warmups')
        }

        this.tasklist = [];

        var i = 0;
        
        while ( ( this.totalSessionTime() < seconds ) && ( i < possibleTasks.length ) ) {

            // As long as practice time remains, keep adding tasks
            var nextTask = possibleTasks[i];
            nextTask.randomizeSessionTime();
            this.tasklist.push(nextTask);

            if ( this.totalSessionTime() > seconds ) {

                var overTime = this.totalSessionTime() - seconds;
                var lastTask = possibleTasks[i];
                if (lastTask.this_time - overTime > lastTask.settings.min_time) {
                    lastTask.this_time -= overTime;
                    break;
                } else {
                    this.tasklist.pop();
                }
            }
            i++;                        
        }
        if (this.totalSessionTime() < seconds) {

            var tasksByLength = this.elimDup(this.getLongest(this.tasklist));
            i = 0;
            while (this.totalSessionTime() < seconds && i < tasksByLength.length) {

                var nextTask = tasksByLength[i];
                if (nextTask.settings.min_time < seconds - this.totalSessionTime()) {
                    this.tasklist.push(nextTask);
                    nextTime.this_time = nextTask.settins.min_time;
                }
                i++;
            }
        }
       
        // If after adding more tasks by length there is still remaining time,
		// expand the tasks already selected to fill the available time,
        // up to their maximum time per session.
        
        var allTasksMaxed = false;

        while (this.totalSessionTime() < seconds && ! allTasksMaxed ) {
            this.tasklist.forEach( (task) => {
                  if (task.this_time < task.settings.max_time) {
                    task.this_time += 10;
                } else {
                    task.maxed = true;
                }
            });

            allTasksMaxed = true;

            this.tasklist.forEach( (task) => {
                if (! task.maxed ) { allTasksMaxed = false;}
            });
        }

        this.tasklist = shuffle(this.tasklist);
        
        if (warmups != [] ) { this.tasklist = warmups.concat(this.tasklist); }
    }


    sortTasksByKeyword = () => {
        var nonWarmups = [];
        this.tasks.forEach( (task) => {
            if ( task.task_type != 'Warmup') {
                nonWarmups.push(task);
            }
        });
        var tasks = {};
        nonWarmups.forEach( (task) => {
            task.settings.keywords.forEach( (keyword) => {
                tasks[keyword] = tasks[keyword] || [];
                tasks[keyword].push(task);
            });
        });
        return tasks;
    }

    getShortest = (tasklist) => {
        return tasklist.sort( (a,b) => {
            return a.min_time - b.min_time;
        })
    }

    getLongest = (tasklist) => {
        return tasklist.sort( (a,b) => {
            return b.min_time - a.min_time;
        })
    }

    getLeastRecentlyPracticed = (tasklist) => {

        return tasklist.sort ( (a,b) => {
            return a.status.sessions[a.status.sessions.length-1][1] - b.status.sessions[b.status.sessions.length-1][1];
        });
    }

    getHighestPriority = (tasklist) => {
        return tasklist.sort ( (a,b) => {
            return a.status.priority - b.status.priority;
        });
    }

    listSession = () => {
        console.log(' SESSION: --------------------------')
		this.tasklist.forEach( (task) => {
			console.log(task.settings.name+ ' : ' + convertSeconds(task.this_time));
        });
        console.log('------------------------------------')
    }

    remainingPossibleTasks = (tasklist) => {
        var remainingPossibleTasks = [];
        tasklist.forEach( (task) => {
            if (task.this_time < task.settings.max_time) {
                remainingPossibleTasks.push(task);
            }
        });
        return remainingPossibleTasks;
    }

    totalSessionTime = () => {
        if ( ! this.tasklist.length ) { return 0; }        
        var total = this.tasklist.reduce( (a,b) => { 
            return a + b.this_time; }, 0);
        return total;
    }

    elimDup = (newTasklist) => {
        var nonDups = [];
        newTasklist.forEach( (task) => {
            if ( ! this.tasklist.includes(task) ) { nonDups.push(task); }
        })
        return nonDups;
    }

}


convertSeconds = (seconds) => { 
    var minutes = Math.floor(seconds / 60);
    var seconds = seconds - minutes * 60;
    return minutes.toString()+':'+pad(seconds,2 ).toString();

}

/* Zero-pad integers for track time display */
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }


// https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
const shuffle = (a) => {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

nowInSeconds = () => {
    var s = new Date();
    return s.getTime() * 1000; // UNIX
}


module.exports = Session;