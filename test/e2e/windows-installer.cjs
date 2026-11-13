const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto')
const {spawnSync}=require('node:child_process'),{_electron}=require('playwright'),{crc32}=require('node:zlib')
function command(file,args,options={}){const result=spawnSync(file,args,{...options,encoding:'utf8',timeout:120000});assert.equal(result.status,0,path.basename(file)+' exited '+result.status+': '+(result.error?.message||result.stdout+'\n'+result.stderr));return result.stdout}
function query(key,view=64){return spawnSync('reg.exe',['query',key,'/s','/reg:'+view],{encoding:'utf8'})}
function powershell(script){return command('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')])}
const {UUID}=require('builder-util-runtime'),pkg=require('../../package.json')
// Same namespace and registry layout as pinned builder26 NsisTarget/multiUser.nsh.
const guid=pkg.build.nsis.guid||UUID.v5(pkg.build.appId,UUID.parse('50e065bc-3134-11e6-9bab-38c9862bdaf3'))
const keyNames=['Software\\Classes\\myapp','Software\\'+guid,'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\'+guid]
const registryKeys=['HKCU','HKLM'].flatMap(hive=>[32,64].flatMap(view=>keyNames.map(key=>({key:hive+'\\'+key,view}))))
function remainingKeys(){return registryKeys.filter(({key,view})=>query(key,view).status===0)}
function shortcutPaths(){return JSON.parse(powershell("@('DesktopDirectory','CommonDesktopDirectory','Programs','CommonPrograms') | ForEach-Object { Join-Path ([Environment]::GetFolderPath($_)) 'myapp.lnk' } | ConvertTo-Json -Compress"))}
function shortcutTarget(file){return powershell("$s=New-Object -ComObject WScript.Shell; $s.CreateShortcut('"+file.replaceAll("'","''")+"').TargetPath").trim()}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
test('Windows NSIS install, native update transport, A→B persistence and uninstall',{timeout:300000},async()=>{
 assert.equal(process.platform,'win32','Run explicitly on an isolated Windows machine')
 const installerA=process.env.SKELETON_INSTALLER_A,installerB=process.env.SKELETON_INSTALLER_B
 assert.ok(installerA&&installerB,'Set SKELETON_INSTALLER_A/B to controlled local NSIS fixtures')
 assert.ok(fs.existsSync(installerA)&&fs.existsSync(installerB))
 assert.deepEqual(remainingKeys(),[],'An existing app installation/protocol must not be overwritten')
 const shortcuts=shortcutPaths();assert.ok(shortcuts.every(file=>!fs.existsSync(file)),'Existing myapp shortcuts must not be overwritten')
 // The assisted NSIS directory page appends APP_FILENAME unless it is already present.
 const root=await fsp.mkdtemp(path.join(os.tmpdir(),'vue3-installer-')),install=path.join(root,'installed myapp'),profile=path.join(root,'profile 中文')
 const exe=path.join(install,'myapp.exe'),uninstaller=path.join(install,'Uninstall myapp.exe')
 const bytes=fs.readFileSync(installerB),sum=crypto.createHash('sha512').update(bytes).digest('base64')
 let mode='error',downloadStarted,app,bodyError
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname
  if(pathname==='/latest.yml'){
   if(mode==='error'){res.writeHead(503);res.end('controlled provider failure');return}
   res.setHeader('Content-Type','text/yaml');res.end(`version: 1.0.1\nfiles:\n  - url: fixture.exe\n    sha512: ${sum}\n    size: ${bytes.length}\npath: fixture.exe\nsha512: ${sum}\nreleaseDate: '2026-11-13T00:00:00.000Z'\n`);return
  }
  if(pathname!=='/fixture.exe'){res.writeHead(404);res.end();return}
  res.setHeader('Content-Length',bytes.length);res.setHeader('Content-Type','application/octet-stream')
  if(mode==='slow'){
   let position=0;const timer=setInterval(()=>{const end=Math.min(position+65536,bytes.length);res.write(bytes.subarray(position,end));position=end;downloadStarted?.();downloadStarted=null;if(position===bytes.length){clearInterval(timer);res.end()}},20)
   res.on('close',()=>clearInterval(timer))
  }else res.end(bytes)
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 await fsp.mkdir(path.join(root,'local-appdata'))
 const env={...process.env,LOCALAPPDATA:path.join(root,'local-appdata'),SKELETON_E2E:'1',SKELETON_USER_DATA:profile,APP_UPDATE_URL:'http://127.0.0.1:'+server.address().port}
 for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','APP_DOWNLOAD_URL','RESOURCE_UPDATE_URL','RESOURCE_UPDATE_PUBLIC_KEY','RESOURCE_UPDATE_PUBLIC_KEY_FILE'])delete env[key]
 function clean(){return !fs.existsSync(exe)&&remainingKeys().length===0&&shortcuts.every(file=>!fs.existsSync(file))}
 function verifyUninstaller(){const bytes=fs.readFileSync(uninstaller);assert.equal(crc32(bytes.subarray(512,bytes.length-4)),bytes.readUInt32LE(bytes.length-4),'NSIS uninstaller CRC must match; preserve the original matching installer/uninstaller icon')}
 function stopOwnedProcesses(){
  powershell(`
   $prefix='${(path.join(root,'local-appdata')+path.sep).replaceAll("'","''")}'; $install='${(install+path.sep).replaceAll("'","''")}'
   function Owned { @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {$_.ExecutablePath -and (($_.Name -eq 'fixture.exe' -and $_.ExecutablePath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) -or ($_.Name -eq 'myapp.exe' -and $_.ExecutablePath.StartsWith($install,[StringComparison]::OrdinalIgnoreCase)))}) }
   foreach($p in (Owned)){ & taskkill.exe /PID $p.ProcessId /T /F 2>$null | Out-Null }
   for($attempt=0;$attempt -lt 40;$attempt++){if((Owned).Count -eq 0){exit 0};Start-Sleep -Milliseconds 250}
   throw 'An owned installer/app is still running; preserve fixture instead of cleaning its registration'
  `)
 }
 function completeUpdateWizard(){
  const prefix=path.join(root,'local-appdata')+path.sep
  // NSIS exposes panes on this Windows build. Click only observed control IDs on an owned HWND.
  const transcript=powershell(`
   Add-Type -AssemblyName UIAutomationClient
   Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SkeletonNsisUI {
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int size);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr h,int index);
 public static void Send(IntPtr h, uint pid, uint message) {
  uint actual; GetWindowThreadProcessId(h,out actual);
  if(actual!=pid) throw new InvalidOperationException("Control no longer belongs to the fixture");
  IntPtr result; SendMessageTimeout(h,message,IntPtr.Zero,IntPtr.Zero,2,700,out result);
 }
 public static void Uncheck(IntPtr h,uint pid) {
  var name=new StringBuilder(128);GetClassName(h,name,128);
  int style=GetWindowLong(h,-16)&15;
  if(name.ToString()=="Button" && (style==2 || style==3 || style==5 || style==6)) Send(h,pid,0xF1);
 }
}
'@
   $prefix='${prefix.replaceAll("'","''")}'; $observed=$false; $deadline=(Get-Date).AddSeconds(100)
   while((Get-Date) -lt $deadline){
    $owned=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {$_.Name -eq 'fixture.exe' -and $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)})
    if($owned.Count -gt 0){$observed=$true}
    foreach($item in $owned){
     $p=Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
     if(!$p -or !$p.MainWindowHandle){continue}
     $window=[Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
     $elements=$window.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
     foreach($control in $elements){
      if($control.Current.Name -match '运行.*myapp|Run.*myapp|Launch.*myapp'){
       [SkeletonNsisUI]::Uncheck([IntPtr]$control.Current.NativeWindowHandle,[uint32]$item.ProcessId)
      }
     }
     foreach($id in @('1202','1204','1')){
      $control=$window.FindFirst([Windows.Automation.TreeScope]::Descendants,(New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::AutomationIdProperty,$id)))
      if(!$control -or !$control.Current.IsEnabled -or $control.Current.IsOffscreen){continue}
      if($id -eq '1202' -and $control.Current.Name -notmatch '仅为我|Only for me|Just for me|current user'){continue}
      if($id -eq '1204' -and $control.Current.Name -notmatch '运行|Run|Launch'){continue}
      $message=if($id -eq '1204'){0xF1}else{0xF5}
      [SkeletonNsisUI]::Send([IntPtr]$control.Current.NativeWindowHandle,[uint32]$item.ProcessId,$message)
      if($id -eq '1'){Write-Output ('NSIS next/install/finish control '+$id)}
     }
    }
    if($observed -and $owned.Count -eq 0){exit 0}
    Start-Sleep -Milliseconds 400
   }
   throw 'The owned NSIS update wizard did not complete'
  `).trim()
  if(transcript)console.log(transcript)
  stopOwnedProcesses()
 }
 async function open(version){
  app=await _electron.launch({executablePath:exe,args:[],env,timeout:20000})
  const page=await app.firstWindow();await page.waitForSelector('.home',{timeout:20000})
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true)
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile)
  assert.equal(await page.evaluate(()=>window.electronAPI.calls['get-version']()),version)
  return page
 }
 async function close(){if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();app=null}}
 try{
  command(installerA,['/S','/currentuser','/D='+install])
  assert.ok(fs.existsSync(exe))
  verifyUninstaller()
  const registration=command('reg.exe',['query','HKCU\\Software\\Classes\\myapp\\shell\\Open\\command','/ve'])
  assert.ok(registration.includes('"'+exe+'" "%1"'),registration)
  const page=await open('1.0.0')
  await page.evaluate(()=>window.electronAPI.writes.setStore('installer-regression',{value:'retained 中文',zero:0,flag:false}))
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['check-update']())).ok,false)
  mode='slow'
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['check-update']())).available,true)
  const started=new Promise(resolve=>downloadStarted=resolve)
  const download=page.evaluate(()=>window.electronAPI.calls['start-update']())
  await Promise.race([started,delay(15000).then(()=>{throw Error('Native updater did not request installer')})])
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['cancel-update']())).ok,true)
  assert.equal((await download).ok,false)
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['confirm-update']())).ok,false)
  mode='fast'
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['check-update']())).available,true)
  assert.equal((await page.evaluate(()=>window.electronAPI.calls['start-update']())).ok,true)
  await page.evaluate(()=>{window.__links=[];window.electronAPI.events['deep-link-params'](value=>window.__links.push(value))})
  // Execute the actual registered protocol with the same isolated profile.
  command('cmd.exe',['/d','/c','start','','myapp://openapp?installer=verified'],{env})
  await page.waitForFunction(()=>window.__links.some(value=>value.installer==='verified'),null,{timeout:10000})
  // On Windows Playwright's cmd wrapper can outlive Electron until the detached installer exits.
  // Drive the owned wizard before awaiting the application/process close event.
  const exited=app.waitForEvent('close',{timeout:180000}).then(()=>null,error=>error)
  const request=page.evaluate(()=>window.electronAPI.calls['confirm-update']()).then(value=>({value}),error=>({error}))
  const early=await Promise.race([request,delay(1500).then(()=>null)])
  if(early?.value)assert.equal(early.value.ok,true)
  if(early?.error&&!/closed/i.test(early.error.message))throw early.error
  completeUpdateWizard()
  const requested=await request
  if(requested.value)assert.equal(requested.value.ok,true)
  else assert.match(requested.error.message,/closed/i)
  const exitError=await exited;if(exitError)throw exitError
  app=null
  verifyUninstaller()
  const upgraded=await open('1.0.1')
  assert.deepEqual(await upgraded.evaluate(()=>window.electronAPI.reads.getStore('installer-regression')),{value:'retained 中文',zero:0,flag:false})
  const store=path.join(profile,'config.json');assert.ok(fs.existsSync(store));const saved=fs.readFileSync(store)
  await close()
  // NSIS normally returns from a launcher before its temporary uninstaller finishes.
  // Match builder's old-version removal: copy outside INSTDIR and wait for the actual actor.
  const actor=path.join(root,'uninstall.exe')
  await fsp.copyFile(uninstaller,actor)
  command(actor,['/currentuser','/S','_?='+install],{windowsVerbatimArguments:true,argv0:'"'+actor+'"'})
  assert.ok(!fs.existsSync(install),'The actual uninstaller must remove its installation directory')
  assert.ok(clean(),'Installer files, registration and shortcuts must all be removed')
  assert.deepEqual(fs.readFileSync(store),saved)
  console.log('Native provider error/cancel/download/confirm wizard, registered protocol, NSIS 1.0.0→1.0.1 and data retention passed')
 }catch(error){bodyError=error;throw error}
 finally{
  const errors=[];let stopped=true
  try{stopOwnedProcesses()}catch(error){errors.push(error);stopped=false}
  if(stopped)try{await close()}catch(error){errors.push(error)}
  try{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}catch(error){errors.push(error)}
  try{
   assert.ok(stopped,'Preserve live installer fixture: '+root)
   if(fs.existsSync(uninstaller)){
    const actor=path.join(root,'cleanup-uninstall.exe');await fsp.copyFile(uninstaller,actor)
    command(actor,['/currentuser','/S','_?='+install],{windowsVerbatimArguments:true,argv0:'"'+actor+'"'})
   }
   // Baseline keys/shortcuts were absent. Remove a partial install only when its current target is exactly our fixture.
   for(const {key,view} of remainingKeys()){
    const values=query(key,view).stdout.toLowerCase()
    if(values.includes(install.toLowerCase()))command('reg.exe',['delete',key,'/f','/reg:'+view])
   }
   for(const file of shortcuts)if(fs.existsSync(file)&&shortcutTarget(file).toLowerCase()===exe.toLowerCase())await fsp.unlink(file)
   assert.ok(clean(),'Fixture registration/shortcut cleanup is incomplete')
   await fsp.rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200})
  }catch(error){errors.push(error);console.error('Preserved failed installer fixture:',root)}
  if(errors.length){console.error(errors.map(error=>error.message).join('\n'));if(!bodyError)throw new AggregateError(errors,'Installer fixture cleanup failed')}
 }
})
