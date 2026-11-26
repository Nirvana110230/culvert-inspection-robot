# 工程恢复

从 GitHub 新克隆总仓后，先读取 COMPONENT_VERSION_MANIFEST.yml。已认证的 Git 客户端可运行 `python tools/checkout_components.py ../locked-components`，在新目录取得三个固定版本。脚本依赖 PyYAML。固件发布制品从 wheel 仓对应 GitHub Release 下载，以 SHA256SUMS.txt 核对。研发会话的脱敏正文和索引随总仓检出，见 [历史目录](knowledge/history/)。

## G2 原始现场恢复

下面保留 G2 本地原件恢复方法，适用于追溯当时的暂存区、未提交工作和原始设备资料。

下文的 candidates、restricted、work 和 audit 均位于同一个隔离工作区。先从 audit/ASSET_PRESERVATION_MANIFEST.csv 核对容器 SHA256，再恢复至新建空目录。机器路径见 restricted/source-locators.json。受限区和审计交付须通过本地授权取得。

## 轮式固件

从 candidates/culvert-wheel-firmware 克隆到新目录，使用下列离线命令。Windows 请保留源码字节，随后依 restricted/firmware/release-files.csv 计算检出文件 SHA256。标签的父提交是原先第 8 个提交。restricted/firmware/original-all.bundle 保存原有历史，original.index、status.z 和 delivery 中的源码 ZIP 可还原原工作状态。

~~~powershell
git -c core.autocrlf=false clone --no-local --config core.autocrlf=false --branch wheel-rc-20261124-53c7df15b82d ./candidates/culvert-wheel-firmware ./wheel-restored
git -C ./wheel-restored fsck --full
~~~

恢复旧工作树时保留当时 Windows 的 core.autocrlf=true，使用原 index 并覆盖源码 ZIP 的实体字节，已实测得到与原仓相同的 43 项修改、2 项未跟踪。精确发布标签的新克隆则使用上述 core.autocrlf=false。

Release、Debug、两份制品清单、测试与构建日志及烧录说明均在 restricted/firmware/delivery。11 月 24 日独立回读样本另存 board-readback-20261124。恢复源码和校验二进制均无需连接设备。

## FAST-LIVO2 与导航

候选中的 SOURCE-FILES.csv 用于复核维护子集。完整开发现场由 restricted/orange/all-refs.bundle、orangepi.zip、navigation.zip 与 work/components 的清单重建。下列命令在集成区根目录运行，两个目的路径均须尚不存在。导航原始分支为无首提交的 codex/round1。

~~~powershell
python -B -X utf8 ./work/components/restore.py ./restore-orange ./restore-am
~~~

复查 work/components/restore-verified.json、navigation-staged-objects.csv 和 navigation-four-am.json。四项 AM 的暂存与磁盘字节也分别存于 restricted/orange/navigation-am/staged 和 working。核验 Stage A 时按锁定的 source_commit 提取 fast_livo2 子树并对照 245 项维护清单；B0 的增量补丁和独立回归证据保存在工作树快照内。

## 历史工程与实验数据

restricted/legacy/repositories.json 逐仓索引分支、HEAD、引用与 bundle。相同引用集和 HEAD 可共用 bundle。将 bundle 导入新建 bare 仓，使用 git bundle verify、git fetch 导入 refs/*，分离 HEAD 按索引给出的对象恢复。repo-编号/refs.txt 和 original.index（若存在）提供原引用及原暂存状态。extra-staged-blobs.zip 的成员以 Git 对象 ID 命名，可用 git hash-object -w --stdin 重建缺失的暂存对象，最后回填原 index。dirty-编号 的 ZIP 和 CSV 记录工作树增改；status.z 记录删除、未跟踪和暂存状态。仅在隔离的新目录重建删除状态。

jetson-project.zip、vehicle-project.zip、early-firmware.zip、stm32-recovery.zip、linked-documents.zip 各附逐件 CSV。vehicle-project 保存 track-dev 的表、照片、旧 Keil、历史导航、桥及摄像机脚本。大容器与部分媒体按 original-index 保存来源和散列。原位索引需要原介质，不能单凭索引恢复文件内容。evidence/data-index.csv 的 D 编号按 restricted/external-data.csv 的 1 起始行顺序关联原路径。原件位置和备份都在本机，尚未形成异机容灾副本。

## 会话与相机

受限可见消息与脱敏 Markdown 分目录保存，校验入口为 restricted/history/indexes/manifest.json，工具见 tools/history/README.md。ChatGPT 导出到达后先使用 chatgpt_intake.py 预检指定 ZIP，再按获准项目范围处理。

相机双版本直接从 tools/camera-coverage/releases 打开 HTML。参数与原版 JS/CSS 见同目录说明。restricted/camera 保留原件、来源和逐浏览器测试证据。
