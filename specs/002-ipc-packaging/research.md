# 方案来源与验证

- 用户提供的[共享会话](https://chatgpt.com/s/cx_6af72702baa88191a34c90f0b008f540)：集中协议、业务API、异步配置缓存、作用域订阅、分阶段打包。参考实现用WebPack，本项目保留已经迁移完成的electron-vite/Vite；不照搬参考项目的计时、体积和asar约束。参考仓库只读不可覆盖其正在进行的工作。
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)：invoke/handle、有限contextBridge、发送者校验。
- [electron-vite依赖处理](https://electron-vite.org/guide/dependency-handling)：运行依赖外置；不为减少几个文件而强行捆绑所有依赖。
- builder26.18.0安装源码支持asar、electronLanguages与normal/store压缩；electron-vite6安装源码resolveConfig设置NODE_ENV，Vite根env与前缀变量纳入指纹。

## 设计与审查

统一原生request/event入口是src/shared/ipc.mjs，服务只注册业务handler/发送有限事件。异步bootstrap在Vue挂载前完成；配置revision + senderId/sequence确认退休旧pending；每组件scope只清自己的监听。旧同步接口是内存兼容层，预加载和页面没有native sendSync。

独立非实现者静态审查发现并关闭：环境输入遗漏、逆序确认重放旧pending、早到消息JSON克隆丢失类型，以及新增指纹时子进程NODE_ENV与外层差异。相关单测均已补充。开发模式共享文件改为ESM，main/preload仍输出CJS；HMR实测通过。

## 测量方法与结果

同一macOS x64主机、Node24.22.0/npm11.19.1、Electron44.7.2；前后使用相同已下载的工具缓存，虚拟机暂停，串行执行。下面是单次样本，不是稳定性能保证。时间为复用生产编译结果后的安装包生成阶段，包含builder目录处理；不把编译、目录打包、安装包生成相加重复计算。

| 平台/架构 | 安装包之前/默认快速档 MiB | 生成之前/之后 秒 | 时间减少 | 展开目录之前/之后 MiB |
|---|---:|---:|---:|---:|
| win/x64 | 117.04 / 115.34 | 46.912 / 34.328 | 26.8% | 373.04 / 324.65 |
| uos/arm64 | 91.73 / 90.84 | 25.380 / 16.651 | 34.4% | 293.53 / 283.48 |
| uos/x64 | 96.34 / 95.46 | 21.420 / 16.544 | 22.8% | 288.52 / 278.47 |

默认档分别是Windows 7z级别3、UOS XZ级别2；继续使用NSIS差分更新和DEB/XZ格式。紧凑档 Windows x64 为106.94MiB（112135699字节），UOS x64为93.94MiB（98506320字节、24.338秒）。两档Windows的app.asar SHA256均为d3895401dc5f5c8f13454a1dc9aa6b3a29251ba6f602129c0f0539128ed3aa9d；两档UOS x64为d9b50a9996d54f26f1830179c3c59704571b92deb4e70c043a56b2cf166c54c7，应用内容相同。没有宣称紧凑档同时更快。

首次测量与虚拟机准备重叠，仅用于排查。随后暂停虚拟机的配对结果发现：单独使用ASAR/裁剪、保留builder默认最高压缩，会使Windows生成从46.912增至58.054秒；UOS x64从21.420增至23.347秒。因此最终显式选择上述快速压缩档，没有拿中间候选的较小体积冒充最终默认结果。Windows紧凑档最终运行时虚拟机活跃，不提供其与暂停基线的速度对比。

干净编译样本Windows 3.664→1.497秒，UOS 4.210→1.493秒；重复编译分别1.236/1.242秒。复用指纹校验约0.091秒，不代表安装包本身能在0.091秒完成。目录打包样本Windows 7.995→8.969秒、UOS arm64 9.989→6.186秒/x64 6.804→6.207秒；ASAR并未让每个阶段都加速。

生产renderer文件总量从290908降到131861字节（54.67%）；main从82797降到51430字节。preload增加到7938字节以承载缓存、确认和早到消息。Electron运行时占主要体积，当前骨架static很小，没有套用参考项目重复几十MiB资源的收益。ASAR是归档而非压缩算法；展开目录统计逻辑字节，Windows约减少13.0%。

原始计时/包/日志集中在开发机 `/tmp/electron-transport-optimization-20261113`（临时验证材料，可清理）；最终默认包在各项目忽略的release中。锁文件未变，不新增运行依赖。

## 执行验证

- 两项目各30项单元、1项真实构建CLI检查；共享transport覆盖异步缓存、逆序确认、多窗口写入、失败回滚、作用域释放和早到结构化消息，构建指纹覆盖环境/模式/元数据篡改。
- 两项目真实Electron各4项、Vite HMR各1项；test模式构建后实际页面启动各1项；恢复production后继续打包。
- 两项目macOS ASAR实际启动及签名renderer更新/失败回退各2项。Windows11 AMD64原生环境执行离线npm ci、build、30单元、4项Electron及HMR；交叉生成ASAR的启动、编译字节/运行依赖身份与签名renderer回退分别通过。
- Windows原有1.0.0散文件安装版→本次1.0.1 ASAR版：高压缩候选已通过实际更新源503、取消、下载、确认向导、已注册协议、CRC、存储保留和卸载。最终默认快速档同样通过完整闭环（108.892秒），实际actor卸载后整个安装目录、注册表、快捷方式自然清除，userData内容保持不变。
- 发现NSIS测试把自复制launcher退出误作实际卸载完成。正常自复制卸载独立观测在11.753秒自然完成；原15秒轮询在另一轮失败，不据此修改产品进程检测。测试按[NSIS官方等待方式](https://nsis.sourceforge.io/Docs/Chapter3.html#3.2.2)，把校验后的卸载器复制到安装目录外，用最后无引号的`_?=安装目录`等待实际actor；仍检查完整目录、注册表、快捷方式自然清除和用户数据保留，保持120秒命令总超时及CRC检查。含空格actor路径与原样`_?=`路径的最终引用方式另经原生最小安装/卸载验证通过。

## 验收边界

UOS版/CPU/glibc/桌面会话未明确；原001的T017/T022/T023继续待真机验收。Windows10、生产代码签名与生产更新源不是本轮已验收项。跨平台包成功生成不等于目标系统兼容认证。
