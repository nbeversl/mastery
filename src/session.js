const prompt = require('prompt-sync')();
const util = require ('./util.js')

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

        // Sort and organize tasks
        this.evalTasks();

        if ( this.nonWarmupTasks.length == 0 ) {
            console.log('\n\nThere are no non-warmup tasks set up yet.\n\n')
            return this.whenFinished();
        }

        // If a specific time length was chosen
        if ( this.seconds > 0 ) {

            this.organizeSession(this.seconds);
            
            this.listSession();

            if ( this.sessionTasklist.length == 0 ) {
                console.log('\n\nThere are not enough tasks for this sessions.\n\n')
                return this.whenFinished();
            }

            console.log('Session length is ' + util.convertSeconds(this.totalSessionTime()));
            
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

        // pre-shuffle the warmups
        this.warmups = shuffle(this.warmups);
    }


    justGo = () => {
        console.log('Just going!');
        var mostRecentTime = this.getMostRecentSession();
        console.log('Most recent practice was '+new Date(mostRecentTime*1000).toString());
        if ( mostRecentTime < util.nowInSeconds() - 43200 && this.warmups.length != 0 ) {
            var warmup = this.getLeastRecentlyPracticed(this.warmups)[0];
            warmup.randomizeSessionTime();
            warmup.start( () => {
                warmup.save(this.storageDir);
                this.unlimitedTasks();
            })
        }  else {
            console.log('Skipping warmups.')
            this.unlimitedTasks();
        }
    }

    unlimitedTasks = () => {
        var possibleTasks = this.getLeastRecentlyPracticed(this.nonWarmupTasks);
        var nextTask = possibleTasks[0];
        nextTask.randomizeSessionTime();
        nextTask.start( (accepted) => {
            if ( accepted ) { 
                console.log('saving')
                nextTask.save(this.storageDir);   
                this.unlimitedTasks();    
                } else {
                this.whenFinished();
            }
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
        const build = prompt('Build session by: (1) highest priority or (2) even rotation (default is 2): ');

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
        if ( mostRecentTime < util.nowInSeconds() - 43200) {  // 12 hours            
            
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
            if (nextTask.status.next_time ) {
                nextTask.this_time = nextTask.status.next_time
            }
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
                    nextTime.this_time = nextTask.settings.min_time;
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

        var nextTask =  this.sessionTasklist[i];
        nextTask.randomizeSessionTime();
        nextTask.start( (accepted) => {
            if ( accepted ) { 
                console.log('saving')
                nextTask.save(this.storageDir);   
                this.unlimitedTasks();    
                i++;
                this.runTask(i+1);
                } else {
                    this.whenFinished();
                }
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
			console.log(task.settings.name+ ' : ' + util.convertSeconds(task.this_time));
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
    var sortedTasks = {}
    tasks.forEach( (task) => {
        task.settings.keywords.forEach( (keyword) => {
            sortedTasks[keyword] = sortedTasks[keyword] || [];
            sortedTasks[keyword].push(task);
        });
    });

    return sortedTasks;
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

module.exports = Session;