const package = require('../package.json');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); 

async function execAsync(cmdLine) {
    return new Promise((resolve, reject) => {
        exec(cmdLine, (err, stdout, stderr) => {
            if (err) {
                reject(err, stderr);
            }
            else {
                console.log(stdout);
                resolve(stdout);
            }
        });
    });
}

async function main() {
    if (process.argv.length != 3) {
        console.log("New version must be provided");
        process.exit(4);
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question(`Action will update ${package.version} to ${process.argv[2]} - do you wish to continue [Yy]? `, async (answer) => {
        if (answer == 'Y' || answer == 'y') {
            console.log('Continuing');
            console.log(process.cwd());
            const buildPath = path.dirname(process.argv[1]);
            const dockerfileOld = path.join(buildPath, 'Dockerfile');
            const dockerfileNew = path.join(buildPath, 'Dockerfile_new');
            const packagefileOld = path.join(buildPath, '../package.json');
            const packagefileNew = path.join(buildPath, '../package_new.json');
            var f = fs.readFileSync(dockerfileOld, { encoding: 'utf-8' });
            f = f.replace(package.version, process.argv[2]);
            fs.writeFileSync(dockerfileNew, f);
            f = fs.readFileSync(packagefileOld, { encoding: 'utf-8' });
            f = f.replace(package.version, process.argv[2]);
            f = fs.writeFileSync(packagefileNew, f);
            fs.unlinkSync(dockerfileOld);
            fs.unlinkSync(packagefileOld);
            fs.renameSync(dockerfileNew, dockerfileOld);
            fs.renameSync(packagefileNew, packagefileOld);
            let output = null;
            let step = null;
            try {
                step = 'add';
                output = await execAsync(`git add --verbose ${dockerfileOld} ${packagefileOld}`);
                step = 'commit';
                output = await execAsync(`git commit -m ":bookmark: Bump version to ${process.argv[2]}"`);
                step = 'push';
                output = await execAsync('git push');
                step = 'tag';
                output = await execAsync(`git tag v${process.argv[2]}`);
                step = 'tag push';
                output = await execAsync(`git push origin v${process.argv[2]}`);
            }
            catch (err) {
                console.error(`Failure at step ${step} - ${err}`);
                process.exit(4);
            }
            process.exit(0);
        }
        else {
            console.log('Aborting');
            process.exit(4);
        }
    });
}

main().then(() => {}).catch((err) => console.log(err));