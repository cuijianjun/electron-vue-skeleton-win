import { hotPublishConfigName } from './const'

/**
 * 热更新配置
 * configName：热更新包中描述文件的前缀名，
 * 热更新服务器目录结构形如：<configName>/<version>/version.json
 */
export const hotPublishConfig = {
  configName: hotPublishConfigName
}
