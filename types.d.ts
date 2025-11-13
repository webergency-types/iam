import { MetaData, Required, Optional } from '@webergency-types/base';

type ClientInfo = {
    agent: string;
    ip: string;
    country?: string;
    locale: string;
    type: 'device' | 'mobile' | 'tablet' | 'console' | 'smarttv' | 'wearable' | 'xr' | 'embedded' | 'cli' | 'crawler' | 'browser' | 'email' | 'fetcher' | 'app' | 'library' | 'player' | 'vehicle';
    browser?: {
        name: string;
        version?: string;
    };
    device?: {
        type: string;
        vendor?: string;
        model?: string;
    };
    engine?: {
        name: string;
        version?: string;
    };
    os?: {
        name: string;
        version?: string;
    };
};

type IAMSchema<UserSchema extends MetaData = any, SessionSchema extends MetaData = any> = {
    user: UserSchema;
    session: SessionSchema;
};
type IAMUser<Schema extends IAMSchema> = {
    id: string;
    email: string;
    name: string;
    events: {
        created: Date;
        updated: Date;
        deleted?: Date;
    };
    meta: Schema['user']['meta'];
    data: Schema['user']['data'];
};
type IAMUserCreate<Schema extends IAMSchema> = {
    email: string;
    name: string;
    meta?: Schema['user']['meta'];
    data?: Schema['user']['data'];
};
type IAMSession<Schema extends IAMSchema> = {
    id: string;
    user: IAMUser<Schema>;
    events: Required<'created' | 'expires', Date> & Optional<'updated', Date>;
    meta: Schema['session']['meta'];
    data: Schema['session']['data'];
    config: {
        inactivityTimeout?: number;
        expirationTimeout?: number;
    };
    client: ClientInfo;
};

export type { ClientInfo, IAMSchema, IAMSession, IAMUser, IAMUserCreate };
