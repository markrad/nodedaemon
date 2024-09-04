import { IApplication } from "../common/IApplication";

/**
 * Enum representing the status of an application.
 */
export enum AppStatus {
    CONSTRUCTED = 'Constructed',
    BADCONFIG = 'Bad Config',
    VALIDATED = 'Validated',
    RUNNING = 'Running',
    FAILED = 'Failed',
    STOPPED = 'Stopped',
}

/**
 * Represents the information about an application.
 */
export type AppInfo = {
    name: string;
    path: string;
    instance: IApplication;
    status: AppStatus;
    config: any;
}
