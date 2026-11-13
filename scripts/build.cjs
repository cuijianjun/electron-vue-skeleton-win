const fs=require('node:fs')
const path=require('node:path')
const {spawnSync}=require('node:child_process')
const root=path.resolve(__dirname,'..')
function arg(name){const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1]}
const platform=arg('platform'),arch=arg('arch')
if(!['win32','linux'].includes(platform)||!['x64','arm64','ia32'].includes(arch))throw new Error('Use --platform win32|linux --arch x64|arm64')
if(arch==='ia32')throw new Error('Pinned Electron 44 has no Windows ia32 binaries. Use x64; a legacy 32-bit runtime requires a separately supported compatibility decision.')
function run(name,bin,args){
  const folder=path.join(root,'node_modules',name)
  const pkg=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'))
  const entry=typeof pkg.bin==='string'?pkg.bin:pkg.bin[bin]
  const result=spawnSync(process.execPath,[path.join(folder,entry),...args],{cwd:root,stdio:'inherit'})
  if(result.error)throw result.error
  if(result.status!==0)process.exit(result.status||1)
}
run('electron-vite','electron-vite',['build'])
run('electron-builder','electron-builder',[platform==='linux'?'--linux':'--win','--'+arch,'--publish','never'])
