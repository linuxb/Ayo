const db = require('./connect');

let proxy = {
    appendAnimes: async function(animes) {
        try {
            const _animes = [];
            for (let am in animes) {
                _animes.push([animes[am]]);
            }
            console.log(_animes);
            let res = await db.queryAsync(`insert into t_videos_info_test(name) values ?`, [_animes]);
            console.log(res);
            return 0;
        } catch(e) {
             throw e;
        }
    }
}

module.exports = proxy;

