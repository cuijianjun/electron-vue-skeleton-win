<template><iframe :src="src" :style="{height}" :aria-busy="loading" sandbox="allow-scripts allow-forms allow-same-origin" @load="loading=false"></iframe></template>
<script>
export default {
  props:{src:{type:String,required:true}},
  data(){return {height:'calc(100vh - 95px)',loading:true}}
}
</script>
<style scoped>iframe{width:100%;border:0;display:block}</style>
