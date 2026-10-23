<!--
  ============================================================
  iframe 内嵌组件 (components/iFrame/index.vue)
  ============================================================
  用于在应用内嵌入第三方网页（如在线文档、外部系统）。
  核心机制：
    1. 通过 <iframe> 标签加载外部地址
    2. 高度自适应：随窗口大小变化动态调整
    3. loading 遮罩：iframe 加载期间显示加载动画

  注意：此组件依赖主窗口开启 webviewTag / iframe 支持，
  以及主进程的 window-close 白名单路由（/iframe）。
  ============================================================
-->
<template>
  <div v-loading="loading" :style="'height:' + height">
    <iframe
      :src="src"
      frameborder="no"
      style="width: 100%; height: 100%"
      scrolling="auto"
    />
  </div>
</template>
<script>
export default {
  props: {
    src: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      // 高度自适应：窗口高度减去 94.5px（标题栏等占位）
      height: document.documentElement.clientHeight - 94.5 + 'px;',
      loading: true,
      url: this.src
    }
  },
  mounted: function () {
    // iframe 加载 300ms 后关闭 loading 遮罩
    setTimeout(() => {
      this.loading = false
    }, 300)
    const that = this
    // 窗口尺寸变化时重新计算高度
    window.onresize = function temp() {
      that.height = document.documentElement.clientHeight - 94.5 + 'px;'
    }
  }
}
</script>
