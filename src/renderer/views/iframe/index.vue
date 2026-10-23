<!--
  ============================================================
  iframe 视图 (views/iframe/index.vue)
  ============================================================
  展示如何内嵌第三方页面，并处理：
    1. 通过路由 query 传入 iframe 的 src
    2. postMessage 与子页面通信（siblingConnect 兄弟窗口传值）
    3. 关闭子窗口（window-close IPC）
  ============================================================
-->
<template>
  <div class="iframe">
    <iFrame id="iframe" :src="src" frameborder="0"></iFrame>
  </div>
</template>
<script>
import iFrame from '@/components/iFrame/index'
export default {
  components: {
    iFrame
  },
  data() {
    return {
      src: '',
      iframe: null
    }
  },
  created() {
    // 从路由 query 获取要加载的地址，如 /iframe?src=https://example.com
    this.src = this.$route.query.src
  },
  mounted() {
    this.iframe = document.getElementById('iframe')
    window.onbeforeunload = function () {
      return false
    }
    // 监听子页面 postMessage
    window.addEventListener('message', this.handleMessage)
  },
  destroyed() {
    window.removeEventListener('message', this.handleMessage)
  },
  methods: {
    // 处理子页面发来的消息
    handleMessage(event) {
      console.log('收到子页面消息:', event.data)
      // 把子页面消息通过兄弟窗口传值通道转发给主窗口
      this.$ipcRenderer.send('siblingConnect', event.data?.type || event.data)

      // 收到 finishTask 消息时关闭当前子窗口
      if (event.data?.type === 'finishTask') {
        this.$ipcRenderer.invoke('window-close')
      }
    },
    // 子页面关闭时的处理（兄弟窗口刷新）
    handleClose() {
      const data = {
        tabId: 2,
        message: '子页面关闭',
        isSaveOffice: false
      }
      this.$ipcRenderer.send('sendRefresh', data)
    }
  }
}
</script>
<style lang="scss" scoped>
.iframe {
  position: relative;
  height: 98%;
  #iframe {
    height: 100% !important;
  }
}
</style>
