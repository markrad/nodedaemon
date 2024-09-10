"use strict"

import { HaMain } from "../../hamain";

import Express from 'express';
import serveFavicon = require('serve-favicon');
import path from 'path';
import http from 'http';
import https from 'https';
import { getLogger, Logger } from "log4js";
import { AppParent } from '../../common/appparent';
import { HaGenericUpdateableItem } from "../../haitems/hagenericupdatableitem";
import { entityValidator } from "../../common/validator";
import { HaParentItem, ServicePromise, ServicePromiseResult } from "../../haitems/haparentitem";
import { readFile, stat, unlink, writeFile } from "fs/promises";
import { X509Certificate } from "crypto";

const URL_FILE = '/tmp/url.txt';
const hound = require('hound');

const CATEGORY = 'WebServer';

const logger: Logger = getLogger(CATEGORY);

type GetResponseError = {
    status: number;
    error: string;
}

type GetResponseSuccess = {
    status: number;
    message: string;
}

type Site = {
    name: string;
    url: string;
}

export default class WebServer extends AppParent {
    private _port: number;
    private _certificate: string = null;
    private _key: string = null;
    private _app: Express.Application;
    private _server: http.Server | https.Server;
    private _root: string;
    private _sites: string;
    private _watcher: any;
    // private _controller: HaMain;
    public constructor(controller: HaMain, config: any) {
        super(controller, logger);
        this._port = config.webserver?.port ?? 4526;
        this._app = Express(); 
        this._server = null;
        // this._controller = controller;
        logger.info('Constructed');
    }
/*
    getZWaveList() {
        let items = Object.keys(this._controller.items)
            .filter(item => this._controller.items[item].__proto__.constructor.name.startsWith('HaItemZwave'))
            .map((key) => this._controller.items[key]);
        return items;
    }
*/
    public async validate(config: any): Promise<boolean> {
        if (! await super.validate(config)) {
            return false;
        }
        this._root = config.webdataroot;

        if (!this._root) {
            logger.error('Missing webdataroot');
            return false;
        }

        this._root = path.normalize(this._root);

        if (config.certificate && !config.key) {
            logger.error('Certificate specified but key is missing');
            return false;
        }
        if (!config.certificate && config.key) {
            logger.error('Key specified but certificate is missing');
            return false;
        }
        try {
            if (config.certificate) {
                this._certificate = await readFile(path.join(this._root, config.certificate), { encoding: 'utf8' });
                this._key = await readFile(path.join(this._root, config.key), { encoding: 'utf8' });
            }
            let siteLoc = path.join(this._root, 'sites/sites.json');
            let handler = async (_file?: string, _stats?: any) => {
                this._sites = JSON.parse(await readFile(siteLoc, { encoding: 'utf8' })).map((site: Site) => `<li><a href="${site.url}"><div class="NavButton">${site.name}</div></a></li>`).join('');
            }

            logger.debug(`Reading sites from ${siteLoc}`);
            await handler();

            this._watcher = hound.watch(siteLoc);
            this._watcher.on('change', handler)
            logger.info('Validated successfully');
        }
        catch (err) {
            logger.error(`Validation failed: ${err}`);
            this._sites = '';
            return false;
        }

        return true;
    }

    private _responseInterceptor(req: any, res: any, next: any): void {
        let originalSend = res.send;
        let self = this;

        res.send = function() {
            if (req.url == '/') {
                logger.debug('Mods here');
                let ol = arguments[0].indexOf('</ol>');
                logger.debug(`ol is at ${ol}`);
                logger.debug(self._root);
                arguments[0] = arguments[0].slice(0, ol) + self._sites + arguments[0].slice(ol);
            }
            originalSend.apply(res, arguments);
        }

        next();
    }
    
    public async run(): Promise<boolean> {

        try {
            const fqdn = this._certificate
                ? (new X509Certificate(this._certificate)).subject.split('\n').find((line) => line.startsWith('CN=')).split('=')[1]
                : 'localhost';
            logger.debug(fqdn);
            await writeFile(URL_FILE, `http${this._certificate ? 's' : ''}://${fqdn}:${this._port}`);
        }
        catch (err) {
            logger.error(`Failed to write URL to file: ${err}`);
        }

        this._app.set('views', path.join(this._root, 'views'));
        this._app.set('view engine', 'pug');

        this._app.use((req, _res, next) => {
            logger.debug(`URL: ${req.url}`);
            next();
        });

        this._app.use(serveFavicon(path.join(this._root, "icons/server.ico"), { maxAge: 2592000000 }));
        this._app.use(Express.static(path.join(this._root, "styles")));
        this._app.use(this._responseInterceptor.bind(this));
        this._app.use('/styles', Express.static(path.join(this._root, 'styles')));
        this._app.use('/icons', Express.static(path.join(this._root, 'icons')))
        this._app.use('/files', Express.static(path.join(this._root, 'files')));

        this._app.get('/', (_req, res) => {
            res.set('Cache-Control', 'public, max-age=60');
            res.status(200).render('index', { title: 'Useful Links' });
        });

        this._app.get('/healthcheck', async (req, res) => {
            let rc: GetResponseSuccess | GetResponseError;
            try {
                if (this.controller.isConnected == false) {
                    throw new Error('Not connected to home assistant');
                }
                let testVar = entityValidator.isValid(req.query.entity, { entityType: HaGenericUpdateableItem, name: 'Health Check'});
                let now = new Date().toISOString();
                let result: ServicePromise = await testVar.updateState(now, false);

                if (result.result != ServicePromiseResult.Success) {
                    throw result.err;
                }

                rc = { status: 200, message: 'Healthy'};
            }
            catch (err) {
                rc = { status: 500, error: err.message };
            }

            return res.status(rc.status).setHeader('Cache-Control', 'no-cache').json(rc);
        });

        this._app.get('/getentity', async (req, res) => {
            let rc: GetResponseError | GetResponseSuccess;
            try {
                if (this.controller.isConnected == false) { 
                    throw new Error('Not connected to home assistant');
                }
                let testVar = entityValidator.isValid(req.query.entity, { entityType: HaParentItem, name: 'Get Entity'});
                rc = { status: 200, message: testVar.state.toString() };
            }
            catch (err) {
                rc = { status: 404, error: err.message };
            }

            return res.status(rc.status).setHeader('Cache-Control', 'no-cache').json(rc);
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
                    res.redirect('http://router1.lan');
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

        try {
            if (this._certificate && this._key) {
                this._server = https.createServer({ key: this._key, cert: this._certificate }, this._app).listen(this._port, () => {
                    logger.info(`Web server started on port ${this._port}`);
                });
            }
            else {
                this._server = this._app.listen(this._port, () => {
                    logger.info(`Web server started on port ${this._port}`);
                });
            }
        }
        catch (err) {
            logger.error(`Failed to start server: ${err}`);
            return false;
        }

        return true;
    }

    private async _getadpage() {
        return new Promise((resolve, reject) => {
            http.get('http://router1.lan', (resp) => {
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
                        resolve(`http://router1.lan/ui/${result[1]}/dynamic/login.html`);
                    }
                });

                resp.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }

    public async stop(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            if (!this._server) {
                return reject(new Error('Webserver is not running'));
            }

            try {
                await stat(URL_FILE);
                await unlink(URL_FILE);
            }
            catch {
                // Don't care - probably couldn't create the file
            }
            if (this._watcher) {
                this._watcher.clear();
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
