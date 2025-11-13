export type ClientInfo =
{
    agent   : string
    ip      : string
    country?: string
    locale  : string
    type    : 'device' | 'mobile' | 'tablet' | 'console' | 'smarttv' | 'wearable' | 'xr' | 'embedded' | 'cli' | 'crawler' | 'browser' | 'email' | 'fetcher' | 'app' | 'library' | 'player' | 'vehicle'
    browser?: { name: string, version?: string }
    device? : { type: string, vendor?: string, model?: string }
    engine? : { name: string, version?: string }
    os?     : { name: string, version?: string }
}