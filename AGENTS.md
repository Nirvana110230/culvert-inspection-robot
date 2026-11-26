# 总体工程协作约定

使用简体中文。接续前阅读 PROJECT_STATUS.md、COMPONENT_VERSION_MANIFEST.yml 和对应模块 README。总仓记录整车平台、接口关系、验收证据和版本组合。组件源码在下表对应仓库维护。

| Codex 专项 | 唯一源码维护仓 | 工作站标准检出目录 |
|---|---|---|
| 整车集成、相机覆盖仿真、研发知识和平台文档 | [culvert-inspection-robot](https://github.com/Nirvana110230/culvert-inspection-robot) | `E:\culvert-inspection-integration\repos\culvert-inspection-robot` |
| 轮式 STM32 固件 | [culvert-wheel-firmware](https://github.com/Nirvana110230/culvert-wheel-firmware) | `E:\culvert-inspection-integration\repos\culvert-wheel-firmware` |
| Orange Pi 正式建图 A、独立 B0 实验 | [culvert-fast-livo2](https://github.com/Nirvana110230/culvert-fast-livo2) | `E:\culvert-inspection-integration\repos\culvert-fast-livo2` |
| Orange Pi 导航 R1/R2、隔离前端适配及补丁 | [culvert-navigation](https://github.com/Nirvana110230/culvert-navigation) | `E:\culvert-inspection-integration\repos\culvert-navigation` |

旧工程、G2 的 candidates、受限保全副本以及板端运行目录用作来源、冻结基线或部署目标。专项变更从对应正式仓分支开始，在新检出或隔离工作树内验证，再由总仓更新组件的完整 Git SHA。先核实设备现场差异并保留证据，再按正式仓的变更部署。B0 的实验代码和结果保持独立，发布时标明具体分支、标签和制品摘要。

## 私有 GitHub 上传授权

2026-11-26，项目用户明确完全授权本项目相关源码、技术资料及经脱敏的项目研发历史上传至个人账户 Nirvana110230 的上述四个 GitHub Private 仓库。后续在本范围内提交、推送及创建固件 Release 可直接实施，无须重复询问项目上传授权。保留第三方原始许可证、版权和历史作者信息。访问范围为指定私有仓库。认证秘密、设备唯一标识、非项目私人会话、原始大型实验数据、镜像与构建缓存留在发布集合之外。

## 基线和验收

保留 G2 冻结标签及既有远端资产。使用普通推送，组件锁使用完整提交 SHA。发布固件与正式部署 ELF 按文件记录 SHA256。轮式、履带、板端部署、软件测试、离线回放及实车验收分别登记。设备现场试验按现场授权开展，导航、协议或安全状态的行为变更须有对应回归记录。
