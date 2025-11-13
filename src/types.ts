import { MetaData, Optional, Required } from '@webergency-types/base';
import { ClientInfo } from './helpers';

export { ClientInfo }

export type IAMSchema
<
    UserSchema      extends MetaData = any,
    SessionSchema   extends MetaData = any
>
=
{
    user    : UserSchema
    session : SessionSchema
}

export type IAMUser<Schema extends IAMSchema> =
{
    id      : string
    email   : string
    name    : string
    events  : 
    {
        created : Date
        updated : Date
        deleted?: Date
    }
    meta    : Schema['user']['meta']
    data    : Schema['user']['data']
}

export type IAMUserCreate<Schema extends IAMSchema> =
{
    email   : string
    name    : string
    meta?   : Schema['user']['meta']
    data?   : Schema['user']['data']
}

export type IAMSession<Schema extends IAMSchema> = 
{
    id      : string
    user    : IAMUser<Schema>
    events  : Required<'created' | 'expires', Date> & Optional<'updated', Date>
    meta    : Schema['session']['meta']
    data    : Schema['session']['data']
    config  : 
    {
        inactivityTimeout?: number
        expirationTimeout?: number
    }
    client: ClientInfo;
}

/*
export type IAMSessionDTO<Schema extends IAMSchema> = Omit<IAMSessionDBE<Schema['session']>, '_id' | '_instanceID' | 'suffix' | 'userID'> & {
    id: string;
    user: UserDTO<Schema['user']>;
    active: boolean;
}; 
*/