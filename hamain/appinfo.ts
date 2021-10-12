import { IApplication } from "../common/IApplication";

export type AppInfo = {
    name: string;
    path: string;
    instance: IApplication;
    status: string;
}
