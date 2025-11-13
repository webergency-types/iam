#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { exec, spawn, ChildProcess, ExecOptions } from 'child_process';

type VersionType = 'major' | 'minor' | 'patch' | 'rc';
type ActionType = 'publish' | 'build' | 'clean';

interface PackageJson
{
    name?: string;
    version: string;
    description?: string;
    author?: string;
    license?: string;
    types?: string;
    files?: string[];
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    repository?: {
        type?: string;
        url?: string;
    };
    bugs?: {
        url?: string;
    };
    [key: string]: any;
}

interface KeyPressEvent
{
    name?: string;
    ctrl?: boolean;
}

interface PromptOptions
{
    [key: string]: string;
}

const red   = ( message: string ): string => `\x1b[31m${message}\x1b[0m`;
const green = ( message: string ): string => `\x1b[32m${message}\x1b[0m`;
const blue  = ( message: string ): string => `\x1b[36m${message}\x1b[0m`;

const Exec = ( cmd: string, options: ExecOptions = { cwd: __dirname } ): Promise<string> => new Promise(( resolve, reject ) => exec( cmd, options, ( error, stdout, stderr ) => error ? reject( error ) : resolve( stdout?.toString() || '' )));

const DebugExec = ( cmd: string, options: ExecOptions = { cwd: __dirname } ): Promise<void> => new Promise(( resolve, reject ) =>
{
    const child: ChildProcess = spawn( cmd, { shell: true, ...options });
    child.stdout?.on('data', ( data: Buffer | string ) => process.stdout.write( data.toString() ));
    child.stderr?.on('data', ( data: Buffer | string ) => process.stderr.write( data.toString() ));
    resolve( new Promise<void>(( resolve, reject ) => child.on('exit', ( code: number | null ) => code === 0 ? resolve() : reject( code ))));
});

class Prompt
{
    private rl: readline.Interface;
    private handler: ( str: string, key: KeyPressEvent ) => void;
    private question?: string | null;
    private options: string[] = [];
    private keys: string[] = [];
    private selected: number = 0;
    private resolve?: ( value: string ) => void;
    private reject?: ( value?: any ) => void;

    constructor()
    {
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        readline.emitKeypressEvents(process.stdin);
        this.handler = ( _, key: KeyPressEvent ) =>
        {
            switch( key.name )
            {
                case 'up'       : this.render(-1);  break;
                case 'down'     : this.render(1);   break;
                case 'return'   : this.exit( this.keys[this.selected] ); break;
                case 'escape'   : this.exit();      break;
                case 'c'        : key.ctrl && this.exit(); break;
            }
        }
    }

    print( message: string ): void
    {
        process.stdout.write( message );
    }

    events( mode: 'on' | 'off' ): void
    {
        process.stdin.isTTY && process.stdin.setRawMode( mode === 'on' );
        process.stdin[mode]( 'keypress', this.handler );
    }

    clear( lines: number ): void
    {
        readline.cursorTo(process.stdout, 0);
        for( let i = 0; i < lines; i++ )
        {
            readline.clearLine(process.stdout, 0);
            readline.moveCursor(process.stdout, 0, -1);
        }
        readline.clearLine(process.stdout, 0);
    }

    render( offset: number | boolean = 0 ): void
    {
        offset !== true && this.clear( this.options.length + ( this.question ? 2 : 0 ));
        this.selected = ( this.selected + ( offset === true ? 0 : ( offset as number ) ) + this.options.length ) % this.options.length;
        this.question && console.log( '\x1b[32m%s\x1b[0m', this.question + '\n' );
        this.options.forEach(( option, index ) => index === this.selected ? console.log('\x1b[36m%s\x1b[0m', `> ${option}`) : console.log(`  ${option}`));
    }

    exit( key?: string ): void
    {
        this.clear( this.options.length + 1 + ( this.question ? 2 : 0 )); this.events('off');
        key ? this.resolve?.( key ) : this.reject?.( key );
    }

    query( query: string ): Promise<string>
    {
        return new Promise(( resolve ) =>
        {
            this.rl.question(`\x1b[32m${query}\x1b[0m\n\n`, ( answer: string ) =>
            {
                this.clear( 4 );
                resolve( answer );
            });
        });
    }

    select( question: string | null, options: PromptOptions | string[] ): Promise<string>
    {
        return new Promise(( resolve, reject ) =>
        {
            this.question   = question;
            this.options    = Array.isArray( options ) ? options : Object.values( options );
            this.keys       = Array.isArray( options ) ? options : Object.keys( options );
            this.selected   = 0;
            this.resolve    = resolve;
            this.reject     = reject;
            this.events('on');
            this.render( true );
        });
    }
}

class PackageManager
{
    static getPackageJson(): PackageJson
    {
        const packagePath = path.join(__dirname, 'package.json');
        return JSON.parse(fs.readFileSync(packagePath, 'utf8')) as PackageJson;
    }

    static savePackageJson( packageJson: PackageJson ): void
    {
        const packagePath = path.join(__dirname, 'package.json');
        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 4) + '\n', 'utf8');
    }

    static bumpVersion( version: string, type: VersionType, isRc: boolean = false, incrementRcOnly: boolean = false ): string
    {
        const parts = version.split('.');
        let major = parseInt(parts[0] || '0', 10);
        let minor = parseInt(parts[1] || '0', 10);
        let patch = parseInt(parts[2]?.split('-')[0] || '0', 10);
        let prerelease: string | null = parts[2]?.includes('-') ? parts[2].split('-').slice(1).join('-') : null;

        // If incrementing RC only, skip base version bumping
        if (!incrementRcOnly)
        {
            // First bump the base version
            switch(type)
            {
                case 'major':
                    major++;
                    minor = 0;
                    patch = 0;
                    prerelease = null;
                    break;
                case 'minor':
                    minor++;
                    patch = 0;
                    prerelease = null;
                    break;
                case 'patch':
                    patch++;
                    prerelease = null;
                    break;
            }
        }

        // Then add RC if requested
        if (isRc)
        {
            if (prerelease && prerelease.startsWith('rc.'))
            {
                const rcNum = parseInt(prerelease.split('.')[1] || '0', 10);
                prerelease = `rc.${rcNum + 1}`;
            }
            else
            {
                prerelease = 'rc.1';
            }
        }

        let newVersion = `${major}.${minor}.${patch}`;
        if (prerelease)
        {
            newVersion += `-${prerelease}`;
        }

        return newVersion;
    }

    static async clean(): Promise<void>
    {
        console.log(green('Running clean...'));
        await DebugExec('rm -rf ./types.d.ts node_modules package-lock.json && npm i', { cwd: __dirname });
        console.log(green('Clean completed!'));
    }

    static async build(): Promise<void>
    {
        console.log(green('Running build...'));
        await this.clean();
        await DebugExec('npx tsup src/types.ts --dts --dts-only --no-splitting --out-dir .', { cwd: __dirname });
        console.log(green('Build completed!'));
    }

    static async publish( versionType: VersionType, isRc: boolean = false, incrementRcOnly: boolean = false ): Promise<void>
    {
        console.log(green('Starting publish process...'));

        // Read package.json
        const packageJson = this.getPackageJson();
        const originalVersion = packageJson.version;
        const originalDevDependencies = packageJson.devDependencies;

        // Calculate new version (but don't bump yet)
        const newVersion = this.bumpVersion(originalVersion, versionType, isRc, incrementRcOnly);

        try
        {
            // Build with original version
            await this.build();

            // Ask for confirmation before publishing
            const prompt = new Prompt();
            const confirmation = await prompt.select(`Ready to publish version ${newVersion}:`, {
                publish: `Publish ${newVersion}`,
                cancel: 'Cancel'
            });

            if (confirmation === 'cancel')
            {
                console.log(blue('Cancelled. Version not changed.'));
                return;
            }

            // Bump version and remove devDependencies right before publish
            console.log(blue(`Bumping version from ${originalVersion} to ${newVersion}`));
            packageJson.version = newVersion;
            delete packageJson.devDependencies;
            this.savePackageJson(packageJson);

            // Publish
            console.log(green(`Publishing version ${newVersion}...`));
            await DebugExec('npm publish --access public', { cwd: __dirname });
            console.log(green('Publish completed!'));

            // Commit and push
            console.log(green('Committing and pushing...'));
            await DebugExec(`git add . && git commit -m "Version ${newVersion}" && git push`, { cwd: __dirname });
            console.log(green('Commit and push completed!'));
        }
        catch (error)
        {
            const err = error as Error;
            console.error(red(`Error during publish process: ${err.message}`));
            // Revert version back to original if it was bumped
            if (packageJson.version !== originalVersion)
            {
                packageJson.version = originalVersion;
                this.savePackageJson(packageJson);
                console.log(blue(`Reverted version back to ${originalVersion}`));
            }
            throw error;
        }
        finally
        {
            // Restore devDependencies if they were removed
            if (packageJson.devDependencies !== originalDevDependencies)
            {
                packageJson.devDependencies = originalDevDependencies;
                this.savePackageJson(packageJson);
                console.log(green('Restored devDependencies in package.json'));
            }
        }
    }
}

async function main(): Promise<void>
{
    const prompt = new Prompt();

    try
    {
        const action = await prompt.select('Select an action:', { 
            publish: 'Publish', 
            build: 'Build', 
            clean: 'Clean' 
        }) as ActionType;

        if( action === 'clean' )
        {
            await PackageManager.clean();
        }
        else if( action === 'build' )
        {
            await PackageManager.build();
        }
        else if( action === 'publish' )
        {
            const versionType = await prompt.select('Select version type to increase:', {
                rc: 'RC (Release Candidate)',
                patch: 'Patch',
                minor: 'Minor',
                major: 'Major'
            }) as VersionType;

            if (versionType === 'rc')
            {
                // Check if current version already has RC
                const packageJson = PackageManager.getPackageJson();
                const currentVersion = packageJson.version;
                const hasRc = currentVersion.includes('-rc.');

                if (hasRc)
                {
                    // Just increment RC number without changing base version
                    await PackageManager.publish('patch', true, true);
                }
                else
                {
                    // Ask for base version type to increase
                    const baseVersionType = await prompt.select('Select base version type to increase for RC:', {
                        patch: 'Patch',
                        minor: 'Minor',
                        major: 'Major'
                    }) as VersionType;

                    await PackageManager.publish(baseVersionType, true);
                }
            }
            else
            {
                await PackageManager.publish(versionType, false);
            }
        }
    }
    catch (error)
    {
        if (error !== undefined)
        {
            const err = error as Error;
            console.error(red(`Error: ${err.message || error}`));
        }
    }
    finally
    {
        console.log('\n');
        setTimeout(() => { process.exit(0) }, 250 );
    }
}

main();
