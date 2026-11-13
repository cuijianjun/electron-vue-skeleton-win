<!--
  ============================================================
  更新弹窗组件 (views/updateTip/index.vue)
  ============================================================
  这是「更新包逻辑」机制的前端展示层，配合主进程的
  checkupdate.js（全量更新）和 HotUpdater.js（热更新）使用。

  说明：本骨架未内置 Element-UI，故用原生 HTML/CSS 实现弹窗，
        去掉真实项目里的 el-progress / el-button / $confirm 等依赖。

  完整链路：
    1. 挂载时读取 update-config 服务器上的 message.json，
       判断是全量更新还是增量更新
    2. 全量更新：check-update → 监听 update-msg 事件（state 1/3/4）
    3. 增量更新：hot-update → 监听 hot-update-status 事件
       （update-available/downloading/moving/finished）
    4. 生产环境每 12 小时轮询一次
  ============================================================
-->
<template>
  <div>
    <div class="loopDialog" v-if="tomorrowTipVis && dialogVisible">
      <div class="close" @click="handleClose">×</div>
      <div class="treeDiv">
        <div class="contentTitle">
          <div class="titleTop">发现新版本迭代</div>
          <div class="titleDesc">当前版本: {{ version }}</div>
        </div>
        <div class="content">
          <div v-if="updateContent" style="white-space: pre-wrap">{{ updateContent }}</div>
          <div v-if="percentage" class="progress-bar">
            <div class="progress-inner" :style="{ width: percentage + '%' }"></div>
            <span class="progress-text">{{ percentage }}%</span>
          </div>
        </div>
      </div>
      <div class="dialog-footer" :class="{'oneBtn': forceUpdate}">
        <button class="btn primary" @click="handleConfirm" :disabled="btnLoading">
          {{ btnInfo }}
        </button>
        <button v-if="!forceUpdate" class="btn" @click="tomorrowTip">明天提醒我</button>
      </div>
    </div>
    <div class="boxshadow" v-if="tomorrowTipVis && dialogVisible"></div>
  </div>
</template>

<script>

const version=__APP_VERSION__
export default {
  name:'UpdateTip',
  data(){return {tomorrowTipVis:false,dialogVisible:false,btnLoading:false,percentage:0,updateInfo:{},progressStatus:null,version,forceUpdate:false,fullUpdate:false,updateContent:'',timer:null,checking:false}},
  computed:{btnInfo(){return this.btnLoading?'下载中':this.progressStatus==='exception'?'重新检查':'立即下载'}},
  mounted(){
    this.refreshReminder()
    this.subscribe('update-msg',(_event,info)=>this.onFullUpdate(info))
    this.subscribe('hot-update-status',(_event,info)=>this.onResourceUpdate(info))
    if(import.meta.env.RENDERER_VITE_UPDATE_ENABLED==='true'){
      this.getUpdateInfo()
      this.timer=setInterval(()=>this.getUpdateInfo(),12*3600*1000)
    }
  },
  beforeUnmount(){this._ipcStops?.forEach(stop=>stop());this._ipcStops?.clear();clearInterval(this.timer)},
  methods:{
    subscribe(channel,callback){
      this._ipcStops ||= new Map()
      this._ipcStops.get(channel)?.()
      const stop=this.$ipcRenderer.subscribe(channel,callback)
      this._ipcStops.set(channel,stop)
      return stop
    },
    refreshReminder(){
      const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime()
      const reminded=Number(localStorage.getItem('tomorrowTipStartTime'))||0
      this.tomorrowTipVis=this.forceUpdate||reminded<start
    },
    async getUpdateInfo(){
      if(this.checking||this.btnLoading)return
      this.checking=true;this.progressStatus=null;this.percentage=0;this.fullUpdate=true
      this.refreshReminder()
      try{
        const full=await this.$ipcRenderer.invoke('check-update')
        if(full?.ok&&full.available){this.showFull(full.info||{});return}
        this.fullUpdate=false;this.forceUpdate=false
        this.version=await this.$ipcRenderer.invoke('get-resource-version')
        const resource=await this.$ipcRenderer.invoke('hot-update')
        if(resource?.status==='update-available')this.showResource(resource)
        else if(resource?.status==='update-not-available')this.dialogVisible=false
        else if(resource?.status==='failed'||resource?.status==='busy')this.showFailure(resource.message||full?.error||'更新检查失败')
      }catch(error){this.showFailure(error.message)}
      finally{this.checking=false}
    },
    showFull(info){
      this.fullUpdate=true;this.version=version;this.updateInfo=info
      this.forceUpdate=info.forceUpdate===true;this.refreshReminder()
      this.updateContent=typeof info.releaseNotes==='string'?info.releaseNotes:`发现应用新版本 ${info.version||''}`
      this.dialogVisible=true
    },
    showResource(info){
      this.fullUpdate=false;this.forceUpdate=false;this.refreshReminder()
      this.updateContent=`发现界面新版本 ${info.version||''}`
      this.dialogVisible=true
    },
    showFailure(message){
      this.btnLoading=false;this.progressStatus='exception'
      this.updateContent=String(message||'更新失败');this.dialogVisible=true
    },
    onFullUpdate(info){
      if(!info)return
      if(info.state===1)this.showFull(info.msg||{})
      else if(info.state===3){this.fullUpdate=true;this.percentage=Number(info.msg?.percent||0);this.btnLoading=true}
      else if(info.state===4){this.fullUpdate=true;this.finish('下载完成，是否立即安装?')}
      else if(info.state===-1&&this.fullUpdate&&!this.checking)this.showFailure(info.msg)
    },
    onResourceUpdate(info){
      if(!info||(this.fullUpdate&&this.dialogVisible))return
      if(info.status==='update-available')this.showResource(info)
      else if(info.status==='downloading'||info.status==='moving')this.btnLoading=true
      else if(info.status==='finished'){this.fullUpdate=false;this.finish('界面更新已下载，是否立即重启生效?')}
      else if(info.status==='update-not-available')this.dialogVisible=false
      else if(info.status==='failed'&&!this.checking)this.showFailure(info.message)
    },
    finish(message){
      this.progressStatus='success';this.btnLoading=false
      if(window.confirm(message)){
        this.$ipcRenderer.invoke(this.fullUpdate?'confirm-update':'confirm-hot-update').then(result=>{
          if(result?.ok===false)this.showFailure(result.error)
        }).catch(error=>this.showFailure(error.message))
      }
      this.dialogVisible=false
    },
    async handleConfirm(){
      if(this.checking)return
      if(this.progressStatus==='exception'){await this.getUpdateInfo();return}
      this.btnLoading=true
      try{
        const result=await this.$ipcRenderer.invoke(this.fullUpdate?'start-update':'start-hot-update')
        if(result?.ok===false||result?.status==='failed'||result?.status==='busy')this.showFailure(result.error||result.message)
      }catch(error){this.showFailure(error.message)}
    },
    handleClose(){if(!this.forceUpdate)this.dialogVisible=false;else window.alert('请先更新到最新版本')},
    tomorrowTip(){
      if(this.forceUpdate)return
      localStorage.setItem('tomorrowTipStartTime',String(Date.now()))
      this.tomorrowTipVis=false;this.dialogVisible=false
    }
  }
}

</script>

<style scoped>
.loopDialog {
  z-index: 999;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 360px;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.close {
  position: absolute;
  top: 20px;
  right: 24px;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}
.treeDiv .contentTitle {
  padding: 40px 40px 0;
}
.treeDiv .contentTitle .titleTop {
  font-size: 22px;
  color: #333;
  font-weight: bold;
}
.treeDiv .contentTitle .titleDesc {
  font-size: 14px;
  color: #646d7d;
  margin-top: 10px;
}
.treeDiv .content {
  padding: 20px 40px;
  font-size: 14px;
  color: #646d7d;
  line-height: 26px;
}
.dialog-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 30px;
  display: flex;
  justify-content: center;
}
.dialog-footer .btn {
  margin: 0 8px;
  padding: 8px 24px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  cursor: pointer;
}
.dialog-footer .btn.primary {
  background: #4080ff;
  border-color: #4080ff;
  color: #fff;
}
.dialog-footer .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.progress-bar {
  position: relative;
  height: 14px;
  background: #ebeef5;
  border-radius: 7px;
  overflow: hidden;
  margin-top: 12px;
}
.progress-inner {
  height: 100%;
  background: #4080ff;
  border-radius: 7px;
  transition: width 0.3s;
}
.progress-text {
  position: absolute;
  right: 6px;
  top: -2px;
  font-size: 12px;
  color: #606266;
}
.boxshadow {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 200;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
}
</style>
