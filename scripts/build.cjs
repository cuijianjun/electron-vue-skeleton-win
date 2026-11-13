const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process')
const {isFresh}=require('./build-info.cjs')
const root=path.resolve(__dirname,'..')
function arg(name,fallback){const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1]}
const pkg=require('../package.json')
const platform=arg('platform',pkg.build.linux?'linux':'win32'),arch=arg('arch','x64'),phase=arg('phase','release')
if(!['win32','linux','darwin'].includes(platform)||!['x64','arm64','ia32'].includes(arch)||!['dir','release'].includes(phase))throw new Error('Use --platform win32|linux|darwin --arch x64|arm64 --phase dir|release')
if(arch==='ia32')throw new Error('Pinned Electron 44 has no Windows ia32 binaries. Use x64; a legacy 32-bit runtime requires a separately supported compatibility decision.')
if(process.argv.includes('--skip-build')&&process.argv.includes('--rebuild'))throw new Error('Choose --skip-build or --rebuild')
function run(name,bin,args){
 const folder=path.join(root,'node_modules',name),manifest=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'))
 const entry=typeof manifest.bin==='string'?manifest.bin:manifest.bin[bin]
 const env={...process.env}
 // Differential-aware NSIS overrides store to a compressed payload. Tune its supported 7z level explicitly.
 if(name==='electron-builder'&&platform==='win32'&&process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL===undefined)env.ELECTRON_BUILDER_COMPRESSION_LEVEL=process.argv.includes('--compact')?'9':'3'
 const result=spawnSync(process.execPath,[path.join(folder,entry),...args],{cwd:root,stdio:'inherit',env})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status||1)
}
const fresh=isFresh(root)
if(process.argv.includes('--skip-build')&&!fresh)throw new Error('Build is missing, stale or modified; run npm run build:app (production) first')
if(!fresh||process.argv.includes('--rebuild'))run('electron-vite','electron-vite',['build'])
else console.log('Reusing verified production build (inputs and outputs match)')
const args=[{win32:'--win',linux:'--linux',darwin:'--mac'}[platform],'--'+arch,'--publish','never']
if(phase==='dir')args.push('--dir')
if(process.argv.includes('--compact')){
 args.push('--config.compression=normal')
 if(platform==='linux'&&pkg.build.deb){
  const options=(pkg.build.deb.fpm||[]).filter(value=>!value.startsWith('--deb-compression-level='))
  // Repeated CLI values form an array; preserve the existing UOS flags and hooks.
  for(const value of [...options,'--deb-compression-level=3'])args.push('--config.deb.fpm='+value)
 }
}
if(arg('output'))args.push('--config.directories.output='+path.resolve(arg('output')))
run('electron-builder','electron-builder',args)
