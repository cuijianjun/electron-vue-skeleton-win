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
          <div v-if="updateContent" v-html="updateContent"></div>
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
import axios from 'axios'
import { hotPublishConfig } from '../../../main/config/hotPublish'
const version = require('../../../../package.json').version
const request = axios.create()

export default {
  name: 'UpdateTip',
  data() {
    return {
      tomorrowTipVis: false, // 已设置的明天提醒
      dialogVisible: false,
      btnLoading: false, // 按钮加载属性
      percentage: 0,
      updateInfo: {},
      progressStatus: null,
      version,
      forceUpdate: false, // 是否强制更新
      fullUpdate: false, // 是否是全量更新
      updateContent: '',
      timer: null,
      nowIpUrl: '' // 更新应用接口地址
    }
  },
  computed: {
    btnInfo() {
      return this.btnLoading ? '下载中' : '立即下载'
    }
  },
  mounted() {
    const nowIpStr = this.$ipcRenderer.sendSync('getStore', 'nowIpStr') || ''
    this.nowIpUrl = `http://${nowIpStr}:${nowIpStr === '20.224.44.205' ? '9999' : '8888'}/packageUpload`
    console.log('更新组件', this.version, nowIpStr)

    if (process.env.NODE_ENV === 'production') {
      // 今天零点
      const todayStartTime = new Date(new Date().toLocaleDateString()).getTime()
      // 今天零点大于设置时间说明可显示提醒弹框
      this.tomorrowTipVis = todayStartTime > localStorage.getItem('tomorrowTipStartTime')
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
      this.getUpdateInfo()
      // 每 12 小时轮询一次更新
      this.timer = setInterval(() => {
        this.getUpdateInfo()
      }, 12 * 3600 * 1000)
    }
  },
  beforeDestroy() {
    clearInterval(this.timer)
    this.$ipcRenderer.removeAllListeners('update-msg')
    this.$ipcRenderer.removeAllListeners('hot-update-status')
  },
  methods: {
    // 获取更新信息
    async getUpdateInfo() {
      const res = await request({ url: `${this.nowIpUrl}/message.json?time=${new Date().getTime()}` })
      const resData = res.data?.length > 0 ? JSON.parse(res.data[0]) : {}
      this.forceUpdate = resData.forceUpdate ? JSON.parse(resData.forceUpdate) : false
      this.fullUpdate = resData.fullUpdate ? JSON.parse(resData.fullUpdate) : false
      this.updateContent = resData.remark
      if (this.fullUpdate) {
        // 全量更新
        this.handleFullUpdate()
      } else {
        // 增量更新（热更新）
        this.handleHotUpdate()
      }
    },
    handleConfirm() {
      this.btnLoading = true
      if (this.fullUpdate) {
        this.$ipcRenderer.invoke('start-update')
      } else {
        this.$ipcRenderer.invoke('start-hot-update')
      }
    },
    handleClose() {
      if (!this.forceUpdate) {
        this.dialogVisible = false
      } else {
        alert('请下载最新版本')
      }
    },
    tomorrowTip() {
      localStorage.setItem('tomorrowTipStartTime', new Date().getTime())
      this.dialogVisible = false
    },
    // 全量更新
    handleFullUpdate() {
      this.$ipcRenderer.invoke('check-update')
      this.$ipcRenderer.on('update-msg', (e, info) => {
        this.updateInfo = info || {}
        console.log('Msg返回', info)
        switch (info.state) {
          case 1:
            this.dialogVisible = true
            break
          case 3:
            this.percentage = Number(info?.msg?.percent?.toFixed(1))
            break
          case 4:
            this.progressStatus = 'success'
            if (window.confirm('下载完成，是否立即更新?')) {
              this.btnLoading = false
              this.$ipcRenderer.invoke('confirm-update')
              this.dialogVisible = false
            } else {
              this.btnLoading = false
              this.dialogVisible = false
            }
            break
          default:
            break
        }
      })
    },
    // 增量更新（热更新）
    handleHotUpdate() {
      this.$ipcRenderer.invoke('hot-update')
      this.$ipcRenderer.on('hot-update-status', (event, info) => {
        console.log('hot-update-status', info)
        switch (info.status) {
          case 'update-available':
            this.dialogVisible = true
            break
          case 'downloading':
            console.log('正在下载')
            break
          case 'moving':
            console.log('正在解压')
            break
          case 'finished':
            this.progressStatus = 'success'
            if (window.confirm('热更新下载完成，立即重启生效?')) {
              this.btnLoading = false
              this.$ipcRenderer.invoke('confirm-hot-update')
              this.dialogVisible = false
            } else {
              this.btnLoading = false
              this.dialogVisible = false
            }
            break
          default:
            break
        }
      })
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
