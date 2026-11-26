# 涵洞巡检机器人

总仓管理整车需求、轮式与履带平台、跨组件版本和研发记录。轮式底盘用于建图验证与毕业设计，履带底盘承担最终项目交付。各专项从自己的正式仓维护源码，组件组合以本仓记录的完整提交 SHA 为准。[项目状态](PROJECT_STATUS.md) · [组件版本锁](COMPONENT_VERSION_MANIFEST.yml) · [专项维护位置与授权](AGENTS.md)

| 专项 | 工程入口 |
|---|---|
| 轮式 STM32 | [固件源码](https://github.com/Nirvana110230/culvert-wheel-firmware) · [正式制品、SHA256 与现场交接](https://github.com/Nirvana110230/culvert-wheel-firmware/releases/tag/wheel-rc-20261124-53c7df15b82d) |
| Orange Pi 建图 | [FAST-LIVO2 正式 A 与 B0 实验](https://github.com/Nirvana110230/culvert-fast-livo2) |
| 自主导航 | [离线定位、适配器与构建说明](https://github.com/Nirvana110230/culvert-navigation) |
| 摄像覆盖 | [V1.3.0 离线网页、默认参数与模块源码](tools/camera-coverage/README.md) |

## 查找研发过程

从[知识索引](KNOWLEDGE_BASE_INDEX.md)按技术问题查阅，从[脱敏主会话](knowledge/history/)回看当时的讨论、尝试和结果。[来源与散列](evidence/README.md)关联工程原件。[变更记录](CHANGELOG.md)、[研发路线](ROADMAP.md)、[轮式平台](platforms/wheeled.yml)及[履带平台](platforms/tracked.yml)记录平台差异和当前证据。

## 按锁恢复

在已登录上述私有仓库的环境克隆本仓，安装 Python 3 和 PyYAML 后，运行 `python tools/checkout_components.py ../locked-components`。脚本逐仓检出锁定提交并校验 Git 树及标签。日常开发使用 AGENTS.md 的正式检出位置。[恢复指南](RESTORE.md) · [第三方来源与许可证](THIRD_PARTY.md)
