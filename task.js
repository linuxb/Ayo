const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const db = require('./proxy/db');

if (process.argv.length < 4) throw new TypeError('[crawler]:wrong args for this worker');

const pageIndex = process.argv[2];
const port = process.argv[3];

function launchChrome(headless=true) {
    return chromeLauncher.launch({
        port,
        chromeFlags: [
            '--window-size=412,732',
            '--disable-gpu',
            headless ? '--headless' : ''
        ]
    });
}

async function resolveRArray(rt,robj) {
    try {
        const objectId = robj.objectId;
        const _internalPropDescriptors = (await rt.getProperties({ objectId })).result;
        let arr = [];
        _internalPropDescriptors.forEach(descriptor => {
            if (/\d/.test(descriptor.name)) {
                arr.push(descriptor.value.value);
            }
        });
        return arr;
    } catch(e) {
        throw e;
    }
}

/*
* 异步函数递归，可能影响性能  
*/
//主要是运行时异常的捕获
async function resolveRObject(rt,robj) {
    try {
        if (robj.value) return robj.value;
        const objectId = robj.objectId;
        const _internalPropDescriptors = (await rt.getProperties({ objectId })).result;
        let result = {};
        _internalPropDescriptors.forEach(async descriptor => {
            const _val = descriptor.value;
            try {
                if (!_val && descriptor.hasOwnProperty('get') && descriptor.hasOwnProperty('set')) return;
                if (_val.type === 'function') return;
                let _res = await resolveAll(rt, descriptor.value);
                result[descriptor.name] = _res;
            } catch(e) {
                throw e;
                process.exit(-1);
            }
        });
        return result;
    } catch(e) {
        throw e;
    }
}

//忽略函数类型的描述符以及accessor 类型的描述符
async function resolveAll(rt,robj){
    try {
        if (!robj) throw new TypeError('[crawler]:remote object should not be undefined');
        if (robj.value) return robj.value;
        if (robj.type.includes('object')) {
            if (robj.subtype === 'null') return null;
            else if (robj.subtype.includes('array')) return await resolveRArray(rt,robj);
            else return await resolveRObject(rt,robj);
        }
        throw new TypeError('[crawler]:unexpected type of remote object')
    } catch(e) {
        throw e;
    }
}

function sleep (timeout) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(0);
        }, timeout);
    })
}

(async () => {

    const client = await launchChrome( );
    let protocol = await CDP({ port: client.port });

    const { Page, Runtime, DOM } = protocol;
    await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);

    /*
    * @param expr 输入运行时执行的查询表达式
    * @return titles 所有番剧的片名
    */
    let parse = async (expr) => {
        try {
            const _res = await Runtime.evaluate({expression: expr});
            //运行时错误处理
            if (_res.exceptionDetails) throw await resolveAll(Runtime, _res.exceptionDetails.exception);
            return await resolveAll(Runtime, _res.result);
        } catch(e) {
            throw e;
        }
    };

    /*
    * @param index 爬取的页索引
    * @return titles 爬取的所有番剧名字集合
    */
    let crawlOnPage = index => {
        const targetUrl = `https://bangumi.bilibili.com/anime/index#p=${index}&v=0&area=&stat=0&y=0&q=0&tag=&t=1&sort=0`;
        const selector = `ul.v_ul li div.info_wrp a div.t`;
        const expression = `(function(){
            var animeTitles = [];
            document.querySelectorAll('${selector}')
            .forEach(function(node) {
                var title = node.textContent;
                animeTitles.push(title);
            });
            return animeTitles_;
        }())`;
        return new Promise((resolve) => {
            Page.loadEventFired(async () => {
                try {
                    resolve(await parse(expression));
                } catch(e) {
                    let err = new Error(e.message);
                    err.stack = e.stack;
                    err.name = e.name;
                    throw err;
                }
            });
            Page.navigate({ url: targetUrl, transitionType: 'reload' });
        });
    };

    /*
    * 计算番剧列表的总页数
    * deprecated
    */
    let calculatePagesNum = async () => {
        try {
            const selector = 'div.pagelistbox.tab_pagelist a.p.endPage';
            const expression = `document.querySelector('${selector}').textContent`;
            return (await Runtime.evaluate({expression: expression})).result.value;
        } catch(e) {
            throw e;
        }
    }

    /*
    * 入口函数
    */
    let crawl = async () => {
        let titles = await crawlOnPage(pageIndex);
        console.log(titles);
        // let _res = await db.appendAnimes(titles);
        protocol.close();
        client.kill();
        process.exit(0);
    };

    //执行入口
    crawl();
})();