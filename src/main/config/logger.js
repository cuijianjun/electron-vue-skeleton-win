/**
 * 主进程日志配置 - 使用 electron-log
 * 日志文件位置：
 *  - Windows: %APPDATA%/Roaming/<appName>/logs/app.log
 *  - Linux:   ~/.config/<appName>/logs/app.log
 * 错误日志单独写入 error.log
 */

import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

// 获取日志存储路径
const getLogPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'logs')
}

// 配置 electron-log
const configureLogger = () => {
  const logPath = getLogPath()

  // 确保日志目录存在
  const fs = require('fs')
  try {
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true })
      console.log('目录已经创建：', logPath)
    }
  } catch (error) {
    console.log('创建目录失败', error)
  }

  // 设置日志级别
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  log.transports.file.level = 'info'

  // 设置日志文件路径和格式
  log.transports.file.file = path.join(logPath, 'app.log')

  // 设置日志格式
  log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

  // 设置文件大小限制和保留文件数
  log.transports.file.maxSize = 20 * 1024 * 1024 // 20MB
  log.transports.file.archiveLogFn = (oldLogFile) => {
    const info = path.parse(oldLogFile.fileName)
    const timestamp = new Date().toISOString().slice(0, 10)
    return path.join(info.dir, `${info.name}-${timestamp}${info.ext}`)
  }

  // 错误日志单独处理
  const originalError = log.error
  log.error = (...args) => {
    // 调用原始的 error 方法
    originalError.apply(log, args)

    // 同时写入错误日志文件
    const errorLogPath = path.join(logPath, 'error.log')
    const fs = require('fs')
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const errorMessage = `[${timestamp}] [ERROR] ${args.join(' ')}\n`

    try {
      if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true })
      }
      fs.appendFileSync(errorLogPath, errorMessage)
    } catch (err) {
      console.error('写入错误日志失败：', err)
    }
  }

  return log
}

// 初始化并配置 logger
const logger = configureLogger()

export { logger, getLogPath }
export default logger
