import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

/**
 * 路由表
 * 新增页面时在 views 下创建组件并在此注册
 */
export default new Router({
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/Home.vue')
    },
    // iframe 内嵌视图：通过 ?src=<url> 传入要加载的网页地址
    {
      path: '/iframe',
      name: 'Iframe',
      component: () => import('@/views/iframe/index.vue')
    },
    // 更新提示弹窗：全量更新 + 热更新状态展示
    {
      path: '/updateTip',
      name: 'UpdateTip',
      component: () => import('@/views/updateTip/index.vue')
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
