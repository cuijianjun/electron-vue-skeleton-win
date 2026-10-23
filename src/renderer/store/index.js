import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

/**
 * Vuex 根 store
 * 业务模块请放在 store/modules 下并在 modules 中注册
 */
export default new Vuex.Store({
  state: {
    appName: '我的应用'
  },
  getters: {
    appName: state => state.appName
  },
  mutations: {},
  actions: {},
  modules: {}
})
