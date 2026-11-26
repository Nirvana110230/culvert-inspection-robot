# 许可与资料权属

| 组件或材料 | 本地依据 | 分发条件 |
|---|---|---|
| STM32 CMSIS | Drivers/CMSIS/LICENSE.txt 含 Apache-2.0 | 保留版权和条款，核实衍生工程权属 |
| STM32F1 Device、HAL | Drivers/CMSIS/Device/ST/STM32F1xx/LICENSE.txt；Drivers/STM32F1xx_HAL_Driver/LICENSE.txt | 两者均先适用随包条款。按各自声明，缺少适用随包条款时，Device 使用 Apache-2.0，HAL 使用 BSD-3-Clause |
| FAST-LIVO2、vikit | fast_livo 的 LICENSE 为 GPL v2，包描述为 BSD；vikit 声明 GPLv3 | 正式仓保留逐包源码、原声明和上游出处，包字段与许可证文本差异保留在组件说明中 |
| Livox ROS Driver2、rapidjson | 仓内 LICENSE 对具体文件或部分给出许可，第三方组件另附声明 | 按目录核对保留通知及再分发条件 |
| 导航自研适配与配准 | culvert_livo_adapter 和 culvert_registration 为 LicenseRef-Undetermined；culvert_localization 包声明 Apache-2.0 | 按包保留原有声明和配准包历史来源说明 |
| small_gicp、Eigen、PCL、Sophus、nanoflann | small_gicp 固定 fa0cfc983417c044b6036f71dfa448038bb9c820，为 MIT；其他软件独立适用各自条款 | 恢复冻结源码时同时取得对应原始声明。组件仓中有版本身份与 notices |
| 相机仿真 3D 依赖 | Three.js r170 与 OrbitControls；原 MIT 声明随仓保留 | 保留通知；应用业务代码、交接说明及计算报告的公开权限由权利人确认 |
| 旧 Jetson 导航、串口桥 | 旧 ROS 包有 Apache-2.0、MIT 等各自声明 | 旧版本在受限区保留，按包核对作者与贡献来源 |
| 现场数据、课题组文档、厂商资料与会话 | 原件、照片、BOM、实验数据和发布历史分别有来源 | 项目资料与脱敏主会话按授权进入指定私有仓；原始大数据、私人会话和受限原件在本机保管 |

轮式固件的供应来源包括 [ST 的 STM32CubeF1](https://github.com/STMicroelectronics/STM32CubeF1)、[CMSIS Device F1](https://github.com/STMicroelectronics/cmsis-device-f1)、[STM32F1 HAL](https://github.com/STMicroelectronics/stm32f1xx-hal-driver) 与 [Arm CMSIS](https://github.com/ARM-software/CMSIS_5)。相机覆盖工具保留 [Three.js r170](https://github.com/mrdoob/three.js/tree/r170) 及随版 OrbitControls 的原始通知。这些上游入口供追溯，实际纳入版本以冻结仓内的字节与许可证为准。

项目用户已授权以上四个指定私有仓存放项目源码、资料和脱敏历史，范围见 [AGENTS.md](AGENTS.md)。表中的第三方许可证及原始声明仍按组件适用。公开分发的条件另按相应权利和条款核实。
