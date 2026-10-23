/*
 * @Author: error: git config user.name && git config user.email & please set dead value or install git
 * @Date: 2023-09-27 17:14:43
 * @LastEditors: error: git config user.name && git config user.email & please set dead value or install git
 * @LastEditTime: 2023-09-27 17:52:31
 * @FilePath: \electron\.electron-vue\style-px2rem-loader.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
module.exports = function(content) {
  // let reg = /(?\d+(\\.\d+)?)px/g
  let reg = /(?<num1>\d+)\.?(<num2>\d+)?px/g;
  let content1 = content.replace(reg, function(...data) {
    var arr = data[data.length-1]
    var num1 = 0, num2 = 0;
    if(arr.num1)num1=parseFloat(arr.num1)
    if(arr.num2)num2=parseFloat(arr.num2)
    return parseFloat(num1 + '.' + num2) / 100 + 'rem'
  })
  return content1
}