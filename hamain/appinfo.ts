import { IApplication } from "../common/IApplication";

export enum AppStatus {
    CONSTRUCTED = 'Constructed',
    BADCONFIG = 'Bad Config',
    VALIDATED = 'Validated',
    RUNNING = 'Running',
    FAILED = 'Failed',
    STOPPED = 'Stopped',
}

export type AppInfo = {
    name: string;
    path: string;
    instance: IApplication;
    status: AppStatus;
    config: any;
}
