import buildInfo from './scripts/build-info.cjs'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import projectConfig from './config/index.js'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
const root=import.meta.dirname
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
export default defineConfig(({command,mode})=>{
  const envFile=resolve(root,'env',mode==='development'?'.env':mode+'.env')
  let env={}
  try{env=dotenv.parse(readFileSync(envFile))}catch{}
  const server={API_HOST:env.API_HOST||'',STREAM_URL:env.STREAM_URL||''}
  const common={
    resolve:{alias:{'@config':resolve(root,'config')}},
    define:{'process.env.NODE_ENV':JSON.stringify(command==='serve'?'development':'production'),'process.env.userConfig':JSON.stringify(server),'process.env.SKELETON_DLL_FOLDER':JSON.stringify(projectConfig.DllFolder||'')},
    build:{sourcemap:false,minify:command!=='serve',commonjsOptions:{include:[/node_modules/,/src\/.*\.cjs$/]}}
  }
  return {
    main:{...common,plugins:[{name:'runtime-build-identity',writeBundle(){
      const directory=resolve(root,'dist/electron');mkdirSync(directory,{recursive:true})
      writeFileSync(resolve(directory,'runtime-build.json'),JSON.stringify({schemaVersion:1,lockHash:createHash('sha256').update(readFileSync(resolve(root,'package-lock.json'))).digest('hex'),electronVersion:pkg.devDependencies.electron,appVersion:pkg.version}))
    }}],build:{...common.build,outDir:'dist/electron/main',rollupOptions:{input:resolve(root,'src/main/index.js'),output:{format:'cjs',entryFileNames:'index.cjs',chunkFileNames:'chunks/[name]-[hash].cjs'}}}},
    preload:{...common,build:{...common.build,outDir:'dist/electron/preload',rollupOptions:{input:resolve(root,'src/preload/index.js'),output:{format:'cjs',entryFileNames:'index.cjs',codeSplitting:false}}}},
    renderer:{
      root:resolve(root,'src/renderer'),base:'./',plugins:[vue(),{name:'verified-build-info',writeBundle(){if(command!=='serve')buildInfo.writeBuildInfo(root,mode)}}],
      resolve:{alias:{'@':resolve(root,'src/renderer')}},
      define:{__APP_VERSION__:JSON.stringify(pkg.version)},
      envDir:root,
      envPrefix:['RENDERER_VITE_'],
      server:{port:projectConfig.dev.port,strictPort:true},
      build:{minify:command!=='serve',sourcemap:false,outDir:resolve(root,'dist/electron/renderer'),rollupOptions:{input:resolve(root,'src/renderer/index.html')}},
      // Only explicitly public API values are visible in the browser.
      ...(server.API_HOST?{define:{__APP_VERSION__:JSON.stringify(pkg.version),'import.meta.env.RENDERER_VITE_API_HOST':JSON.stringify(server.API_HOST)}}:{})
    }
  }
})
