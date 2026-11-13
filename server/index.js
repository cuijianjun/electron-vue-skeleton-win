const express=require('express'),path=require('node:path'),fs=require('node:fs')
function arg(name){const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1]}
const directory=arg('dir')
if(!directory){
 const backend=path.resolve(process.env.UPDATE_SERVER_ROOT||path.join(__dirname,'../../electron-update-server'))
 require(path.join(backend,'src/cli.cjs')).main('serve').catch(error=>{console.error(error.message);process.exitCode=1})
 return
}
const root=path.resolve(directory),port=Number(arg('port')||25565)
if(!fs.statSync(root).isDirectory()||!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid directory or port')
const app=express();app.use(express.static(root,{dotfiles:'deny',index:false}))
const server=app.listen(port,'127.0.0.1',()=>console.log('Local update fixture:',root,'http://127.0.0.1:'+server.address().port))
