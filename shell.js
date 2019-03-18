const exec = require('child_process').exec;
var script = exec('sh zip.sh', 
    (error, stdout, stderr) => {
        console.log(`${stdout}`);
        console.log(`${stderr}`);
        if (error !== null) {
            console.log(`exec error: ${error}`);
       }
    });