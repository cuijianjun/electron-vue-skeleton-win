const {isFresh}=require('./build-info.cjs'),semver=require('semver')
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),AdmZip=require('adm-zip')
const {runtimeIdentity,payload,inventory,treeHash}=require('../src/main/services/resourceUpdates.cjs')
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex')
function arg(name){const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1]}
const platform=arg('platform'),arch=arg('arch'),version=arg('version'),keyFile=arg('signing-key'),baseDir=arg('base-dir'),baseVersion=arg('base-version')
if(!['win32','linux'].includes(platform)||!['x64','arm64'].includes(arch)||!semver.valid(version)||!keyFile||Boolean(baseDir)!==Boolean(baseVersion)||(baseDir&&(!semver.valid(baseVersion)||!semver.lt(baseVersion,version))))throw new Error('Usage: pack:resources -- --platform win32|linux --arch x64|arm64 --version x.y.z --signing-key /private/key.pem [--base-dir previous/renderer --base-version x.y.z] [--out directory]')
const pkg=require('../package.json'),output=path.resolve(arg('out')||path.join(root,'release','resources',platform+'-'+arch)),build=path.join(root,'dist/electron')
const metadata=JSON.parse(fs.readFileSync(path.join(build,'runtime-build.json'),'utf8'))
if(!isFresh(root)||metadata.lockHash!==hash(fs.readFileSync(path.join(root,'package-lock.json')))||metadata.appVersion!==pkg.version||metadata.electronVersion!==pkg.devDependencies.electron)throw new Error('Runtime build identity is stale; run build:app first')
const key=crypto.createPrivateKey(fs.readFileSync(keyFile));if(key.asymmetricKeyType!=='ed25519')throw new Error('Use an Ed25519 private key kept outside the repository')
const renderer=path.join(build,'renderer'),files=inventory(renderer),snapshot=new AdmZip()
for(const f of files)snapshot.addFile(f.path,fs.readFileSync(path.join(renderer,f.path)))
const full=snapshot.toBuffer(),fullName='renderer-'+hash(full)+'.zip'
let archive=full,archiveName=fullName,extra={}
if(baseDir){
 const previous=inventory(path.resolve(baseDir)),old=new Map(previous.map(f=>[f.path,f.sha256])),patch=new AdmZip()
 for(const f of files)if(old.get(f.path)!==f.sha256)patch.addFile(f.path,fs.readFileSync(path.join(renderer,f.path)))
 archive=patch.toBuffer();archiveName='renderer-delta-'+hash(archive)+'.zip'
 extra={base:{version:baseVersion,sha256:treeHash(previous)},files,fallback:{archive:fullName,sha256:hash(full)}}
}
const manifest={schemaVersion:baseDir?2:1,version,platform,arch,runtimeId:runtimeIdentity({mainFile:path.join(build,'main/index.cjs'),preloadFile:path.join(build,'preload/index.cjs'),dependencies:pkg.dependencies,lockHash:metadata.lockHash,electronVersion:pkg.devDependencies.electron,appVersion:pkg.version}),sha256:hash(archive),archive:archiveName,...extra}
manifest.signature=crypto.sign(null,payload(manifest),key).toString('base64')
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,fullName),full)
if(baseDir)fs.writeFileSync(path.join(output,archiveName),archive)
fs.writeFileSync(path.join(output,'manifest.json.tmp'),JSON.stringify(manifest,null,2)+'\n');fs.renameSync(path.join(output,'manifest.json.tmp'),path.join(output,'manifest.json'))
console.log(JSON.stringify({output,kind:baseDir?'delta':'snapshot',downloadBytes:archive.length,snapshotBytes:full.length,version}))
