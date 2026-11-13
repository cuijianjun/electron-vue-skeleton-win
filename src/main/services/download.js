import { startDownload } from './downloadSession'
export default {download(window,args={}){return startDownload(window,{url:args.downloadURL,directory:args.path,filename:args.name})}}
