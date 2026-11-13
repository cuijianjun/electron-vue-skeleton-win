import { createStore } from 'vuex'
export default createStore({state:()=>({appName:'我的应用'}),getters:{appName:state=>state.appName},mutations:{},actions:{},modules:{}})
