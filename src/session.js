const prompt = require('prompt-sync')();
const sayThing = require('./index.js');


class Session {

    constructor(args) {

        /* from args */
        this.storageDir = args.storageDir;
        this.settings = args.settings;
        this.tasks = args.tasks;
        this.reminders = args.reminders;
        this.name = args.name;
        this.seconds = args.seconds;
        this.whenFinished = args.whenFinished;

        /* assigned */

        this.sessionTasklist = [];
        this.byKeyword = null;
        this.nonWarmupTasks = [];
        this.warmups = [];
    }

    // Run the session (practice)
    start = () => {

        if ( this.tasks.length == 0 ) {
            console.log('\n\nThere are no tasks set up yet.\n\n')
            return this.whenFinished();
        }

        // Sort and organize tasks
        this.evalTasks();

        // If a specific time length was chosen
        if ( this.seconds > 0 ) {

            this.organizeSession(this.seconds);
            
            this.listSession();

            if ( this.sessionTasklist.length == 0 ) {
                console.log('\n\nThere are not enough tasks for this sessions.\n\n')
                return this.whenFinished();
                return
            }

            console.log('Session length is ' + convertSeconds(this.totalSessionTime()));
            this.runTask(0);
        } 
        
        // Otherwise just start tasks
        else {
            this.justGo();
        }

        // Set reminders to fire at intervals.
        this.reminders.forEach( (reminder) => {
            reminder.startReminding();
        });

    }

    // Sort and organize the tasks passed from the main process.
        
    evalTasks = () => {

        // Separate out warmups from non-warmups
        this.tasks.forEach((task) => {
           
            if ( task.settings.active && task.settings.task_type != 'Warmup') {
                this.nonWarmupTasks.push(task);
            }
            if ( task.settings.active && task.settings.task_type == 'Warmup') {
                this.warmups.push(task);
            }
            
        });

        // store a dict of all non-warmup tasks keyword
        this.byKeyword = sortTasksByKeyword(this.nonWarmupTasks);

        // pre-shuffled the warmups
        this.warmups = shuffle(this.warmups);
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
        var possibleTasks = this.getLeastRecentlyPracticed(this.nonWarmupTasks);
        var nextTask = possibleTasks[0];
        nextTask.randomizeSessionTime();
        nextTask.start( () => {
            nextTask.save(this.storageDir);   
            this.unlimitedTasks();     
        });
    }

    organizeSession = (seconds) => {
        
        // offer choice of keyword(s)
        console.log(Object.keys(this.byKeyword).join(', '));
        const chosenKeywords = prompt('Focus on any keyword(s)? (comma-separated, leave blank for no preference): ');
        
        var possibleTasks = [];
        chosenKeywords.split(',').forEach( (keyword) => {
            keyword = keyword.toLowerCase().trim();
            if (Object.keys(this.byKeyword).includes(keyword)) {
                this.byKeyword[keyword].forEach( (task) => {
                    possibleTasks.push(task);
                })
            } 
        });

        // If there were no tasks matching the provided keyword(s), 
        // the task list becomes all tasks.
        if ( possibleTasks.length == 0 ) {
             possibleTasks = this.nonWarmupTasks;
        }
     
        // Get user input for session priority
        const build = prompt('Build session by: \n1. highest priority , \n2. even rotation (default is 2):');

        if (build == '1') {
            possibleTasks = this.getHighestPriority(possibleTasks);
        } else {
            possibleTasks = this.getLeastRecentlyPracticed(possibleTasks);
        }

        // Get most recent practice session
        var mostRecentTime = this.getMostRecentSession();
        console.log('Most recent practice was '+new Date(mostRecentTime).toString());

        // Determine whether to include warmups based on most recent session
        var warmups = [];
        if ( mostRecentTime < nowInSeconds() - 43200) {  // 12 hours            
            
            // Determine available time for warmups
            var maxWarmupPercent = this.settings.maxWarmupPercent || 10;
            var maxWarmupTime = seconds * maxWarmupPercent * 0.01;

            // Add warmups until maximum warmup time is reached
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
    
        // As long as practice time and possible tasks remain, keep adding tasks
        var i = 0;
        
        while ( ( this.totalSessionTime() < seconds ) && ( i < possibleTasks.length ) ) {

            var nextTask = possibleTasks[i];
            nextTask.randomizeSessionTime();
            this.sessionTasklist.push(nextTask);

            if ( this.totalSessionTime() > seconds ) {

                var overTime = this.totalSessionTime() - seconds;
                var lastTask = possibleTasks[i];
                if (lastTask.this_time - overTime > lastTask.settings.min_time) {
                    lastTask.this_time -= overTime;
                    break;
                } else {
                    this.sessionTasklist.pop();
                }
            }
            i++;                        
        }

        if (this.totalSessionTime() < seconds) {

            var tasksByLength = this.elimDup(this.getLongest(this.sessionTasklist));

            i = 0;
            while ( 
                    (this.totalSessionTime() < seconds) 
                    && (i < tasksByLength.length)
                )  {
              
                var nextTask = tasksByLength[i];
                if (nextTask.settings.min_time < seconds - this.totalSessionTime()) {
                    this.sessionTasklist.push(nextTask);
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
            this.sessionTasklist.forEach( (task) => {
                  if (task.this_time < task.settings.max_time) {
                    task.this_time += 10;
                } else {
                    task.maxed = true;
                }
            });

            allTasksMaxed = true;

            this.sessionTasklist.forEach( (task) => {
                if (! task.maxed ) { allTasksMaxed = false;}
            });
        }

        this.sessionTasklist = shuffle(this.sessionTasklist);
        if (warmups.length > 0 ) { this.sessionTasklist = warmups.concat(this.sessionTasklist); }
    }

    runTask = (i) => {
        this.sessionTasklist[i].start( () => { 
            this.sessionTasklist[i].save(this.storageDir);
            i +=1;
            if (i == this.sessionTasklist.length) { 
                this.reminders.forEach( (reminder) => {
                    reminder.stopReminding();
                });
                return this.whenFinished();             
            }
            this.runTask(i);         
        });
    }

    getMostRecentSession = () => {
        
         var allTasks = this.getLeastRecentlyPracticed(this.tasks);
         return allTasks[allTasks.length-1].mostRecentSessionTime();        
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
		this.sessionTasklist.forEach( (task) => {
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
        if ( ! this.sessionTasklist.length ) { return 0; }        
        var total = this.sessionTasklist.reduce( (a,b) => { 
            return a + b.this_time; }, 0);
        return total;
    }

    elimDup = (newTasklist) => {
        
        var nonDups = [];
        newTasklist.forEach( (task) => {
            if ( ! this.sessionTasklist.includes(task) ) { nonDups.push(task); }
        })
        return nonDups;
    }

}



// from a list of tasks, return a dict with tasks organized by keyword
sortTasksByKeyword = (tasks) => {

    tasks.forEach( (task) => {
        task.settings.keywords.forEach( (keyword) => {
            tasks[keyword] = tasks[keyword] || [];
            tasks[keyword].push(task);
        });
    });

    return tasks;
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