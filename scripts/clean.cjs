const fs=require('node:fs')
const path=require('node:path')
const output=path.join(__dirname,'../dist/electron')
fs.rmSync(output,{recursive:true,force:true})
