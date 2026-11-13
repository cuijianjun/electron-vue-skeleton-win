import { createRouter, createWebHashHistory } from 'vue-router'
export default createRouter({
  history:createWebHashHistory(),
  routes:[
    {path:'/',name:'Home',component:()=>import('@/views/Home.vue')},
    {path:'/iframe',name:'Iframe',component:()=>import('@/views/iframe/index.vue')},
    {path:'/updateTip',name:'UpdateTip',component:()=>import('@/views/updateTip/index.vue')},
    {path:'/:pathMatch(.*)*',redirect:'/'}
  ]
})
