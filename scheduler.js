const numCpus = require('os').cpus().length;
const { spawn } = require('child_process');
const config = require('./constants/scheduler');
const fs = require('fs');

function prepare() {
    //读入爬取状态变量
    return new Promise((resolve, reject) => {
        fs.readFile('./state.json', (err, data) => {
            if (err) reject(err);
            const state = JSON.parse(data.toString());
            resolve(state);
        });
    });
}

function sleep(timeout) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, timeout);
    });
}

let run = async () => {
    let tasks = [], state;
    //修改爬取并发轮次
    // const tick = 6;
    try {
        state = await prepare();
        console.log(`crawler tick: ${state.tick}`);
    } catch(e) {
        throw e;
    }
    const corCmd = 'concurrently';
    const basePort = config.basePort;
    for (let i = 0; i < numCpus; i++) {
        let _task = `node task.js ${i + 1 + numCpus * state.tick} ${basePort + i}`;
        tasks.push(_task);
    }
    const corRun = spawn(corCmd, tasks);
    corRun.stderr.on('data', data => { throw new Error(data.toString()); });
    corRun.on('close', code => { console.log(`worker exit with code:${code}`); });
};

let runLoop = async () => {
    const maxTick = config.maxTick;
};

run();