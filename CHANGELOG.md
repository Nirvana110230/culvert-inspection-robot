# 工程变更记录

## 2026-11-27 · FAST-LIVO2 B1 首次走廊移动建图 · Baseline 01

人工手推式四轮小推车在 Orange Pi 5 Ultra 与标称 5 V / 3 A 移动供电条件下完成首次室内走廊移动建图。约 180 m 的估计移动段中完成独立运行、实时融合、录包与地图归档，57 个 SQLite 分片和 7,035 个位姿保留为现场基线。下一阶段验证时序、实测精度和正式底盘集成。部署身份继续指向 `stage-b1-20261127`。[组件仓正式报告](https://github.com/Nirvana110230/culvert-fast-livo2/blob/b12a7b31753e628ed877160c5d59b5224ea223ca/docs/experiments/2026-11-27/first_corridor_test/FAST-LIVO2_B1_%E9%A6%96%E6%AC%A1%E8%B5%B0%E5%BB%8A%E7%A7%BB%E5%8A%A8%E5%BB%BA%E5%9B%BE%E5%AE%9E%E9%AA%8C%E6%8A%80%E6%9C%AF%E6%8A%A5%E5%91%8A_20261127.md) · [组件仓实验归档](https://github.com/Nirvana110230/culvert-fast-livo2/tree/b12a7b31753e628ed877160c5d59b5224ea223ca/docs/experiments/2026-11-27/first_corridor_test)

## 2026-11-27 · FAST-LIVO2 B1

建图组件锁定 `stage-b1-20261127`。板端使用含 B0 启动 IMU 修复和 0.5 m 近距修复的 B1，沿用五个入口、实机身份配置与 NVMe 保存路径。一次手持回放归档 576 个位姿、1,132,757 个几何点和 203,173 个彩色点。[组件版本记录](https://github.com/Nirvana110230/culvert-fast-livo2/blob/stage-b1-20261127/deploy/release.json)

## 2026-11-26 · G3 正式工程

- 四个专项使用独立的私有 GitHub 维护仓，完整 SHA 锁定本轮集成组合。轮式固件沿用冻结提交和标签。
- 建图与导航按板端源码、补丁、部署身份和测试记录补齐。B0 继续独立于正式 A。
- 在八个工程专题之外收录项目主会话的逐轮脱敏记录。相机 V1.3.0 离线发布及已保全的模块源码、参数和说明沿用 G2 校验清单。

## 2026-11-26 · G2 本地候选

- 为三个独立组件建立本地版本身份。正式轮式源码逐文件验证，保全原有历史、导航暂存状态及双版本文件。
- 从 11 月 24 日的可见烧录会话追查并保全当天的正式回读 BIN；用户确认了新版固件的实车遥控运动。
- 归档项目 Codex 可见消息，建立研发知识索引、受限原件映射和数据索引。
- 保全相机 V1.2 与 V1.3.0，核验离线运行、JSON 往返和透视图导出。

[分阶段研发里程碑](knowledge/08-研发时间线.md)
