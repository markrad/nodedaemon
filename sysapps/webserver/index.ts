"use strict"

import { HaMain } from "../../hamain";

import Express from 'express';
import path from 'path';
import http from 'http';
import { getLogger, Logger } from "log4js";
import { AppParent } from '../../common/appparent';

const CATEGORY = 'WebServer';

const logger: Logger = getLogger(CATEGORY);

// TODO: Broken
export default class WebServer extends AppParent {
    private _port: number;
    // private _controller: HaMain;
    private _app: Express.Application;
    private _server: http.Server;
    public constructor(_controller: HaMain, config: any) {
        super(logger);
        this._port = config.webserver?.port ?? 4526;
        // this._controller = controller;
        this._app = Express(); 
        this._server = null;
    }
/*
    getZWaveList() {
        let items = Object.keys(this._controller.items)
            .filter(item => this._controller.items[item].__proto__.constructor.name.startsWith('HaItemZwave'))
            .map((key) => this._controller.items[key]);
        return items;
    }
*/
    public validate(_config: any): boolean {
        // No validation required
        return true;
    }
    
    public async run(): Promise<boolean> {

        this._app.set('views', path.join(__dirname, 'views'));
        this._app.set('view engine', 'pug');

        this._app.use((req, _res, next) => {
            logger.debug(`URL: ${req.url}`);
            next();
        });

        this._app.use(Express.static(path.join(__dirname, "styles")));
        this._app.use('/styles', Express.static(path.join(__dirname, 'styles')));

        this._app.get('/', (_req, res) => {
            res.status(200).render('index', { title: 'Useful Links'});
        });
/*
        this._app.get('/zwavedata', (_req, res) => {
            let data = this.getZWaveList();
            let nodes = [];
            let edges = [];
            data.forEach((item) => nodes.push({ id: item.attributes.node_id, label: item.attributes.friendly_name }));

            // TO_DO What?
            // nodes.forEach((item) => {
            //     this.controller.items.filter
            // });
            data.forEach((item) => {
                if (item.attributes.neighbors) {
                    item.attributes.neighbors.forEach((neighbor) => edges.push({ 
                        from: Math.min(neighbor, item.attributes.node_id), to: Math.max(neighbor, item.attributes.node_id)
                    }));
                }
            });
            edges = edges.sort((l, r) => (l.from * l.to) - (r.from * r.to));
            edges = edges.filter((v, i, a) => a.findIndex(t => (t.from == v.from && t.to == v.to)) === i);
            return res.json({ nodes: nodes, edges: edges });
        });
*/
        this._app.get('/routerredir', (_req, res) => {
            this._getadpage()
                .then((url: string) => {
                    logger.debug(url);
                    res.redirect(302, url);
                })
                .catch((err) => {
                    logger.error(`Could not get router webpage: ${err}`);
                    res.redirect('http://rr-router');
                });
        });

        this._app.get('/zwavemap', (_req, res) => {
            res.status(200).render('zwavemap', { title: 'ZWave Map' });
        });

        this._app.get('*', (_req, res) => {
            res
                .status(404)
                .send('No such page');
        });

        this._server = this._app.listen(this._port, () => {
            logger.info(`Web server started on port ${this._port}`);
        });

        return true;
    }

    private async _getadpage() {
        return new Promise((resolve, reject) => {
            // http.get('http://rr-router.home.radrealm.com', (resp) => {
            http.get('http://192.168.1.1', (resp) => {
                    let data: string = '';

                resp.on('data', (chunk) => {
                    data += chunk.toString();
                });

                resp.on('end', () => {
                    let re: RegExp = /http-equiv="REFRESH" content=".*;url=\/ui\/([.0-9]*)\/dynamic\//
                    let result: RegExpMatchArray = data.match(re);

                    if (result == null) {
                        reject(new Error('Unable to find version string in URL'));
                    }
                    else {
                        resolve(`http://rr-router/ui/${result[1]}/dynamic/login.html`);
                    }
                });

                resp.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }

    public async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._server) {
                return reject(new Error('Webserver is not running'));
            }
            this._server.close((err) => {
                this._server = null;
                if (err) {
                    return reject(err);
                }
                else {
                    return resolve();
                }
            });
        });
    }
}
