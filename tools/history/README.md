# 项目会话本地归档工具

以审核过的 G1 项目会话 CSV 作为允许名单。工具只用 Python 标准库，当前已在 Windows 的 Python 3 环境实测。按项目顺次读取两个在线 SQLite 只读事务，读取分页库已提交的 WAL 视图。源程序不需要运行 Codex 服务或恢复旧会话。

在 PowerShell 中将下列变量设为本机路径。脚本位于当前目录时可以直接执行。

```powershell
$codexDir = Join-Path $env:USERPROFILE '.codex'
$g1 = Read-Host 'G1 会话清单的完整路径'
$projectRoot = Read-Host '允许发现新增会话的项目根'
$archiveDir = Read-Host '本地受限归档目录'
python -B -X utf8 .\archive_codex.py --codex $codexDir --inventory $g1 --root $projectRoot --out $archiveDir
python -B -X utf8 .\verify_archive.py --codex $codexDir --inventory $g1 --out $archiveDir
```

`--root` 支持重复，可登记多个已审定的工作区。已核实的其他会话可用 `--include-id ID` 单独纳入。沿用 G1 全部 ID，新增主会话要求晚于或等于 G1 最后一个入选会话的创建时间、命中指定根或其注册项目 ID，且首条任务具备机器人项目线索。派生项按父 ID 登记，内部审批仅做元数据索引。应人工核对新候选与实际项目关系。

## 输出

| 相对归档目录的位置 | 内容 |
| --- | --- |
| `source-visible/codex/<年>/<ID>.jsonl` | 一个轮次一行。每条消息含 ID、时间、排序号、角色、显示阶段、来源类型与允许导出的正文。会话密钥等认证内容、明显私人段落及运行环境注入在此层已移除。仍可能含项目文件位置和局域网信息。 |
| `redacted/codex/<年>/*.md` | 逐轮脱敏稿，另行遮盖设备标识、地址、本地路径和外部链接。保留对话定位符。 |
| `indexes/session_inventory.json` | 全部主会话、派生和审批索引，含范围依据、时间、父子关系与状态。 |
| `indexes/main_sessions.json` | 每条主会话的文件位置、正文数量、源投影 SHA-256 和过滤计数。 |
| `indexes/detail/<ID>.json` | 子任务、根轮次映射、图片等非文本引用、可见消息缺项和回查 JSONL 的散列。 |
| `indexes/manifest.json` | G1 清单及每个生成文件的 SHA-256。 |

源投影散列覆盖该会话选取的原始轮次元数据、原始用户/助手项 JSON、类型、时间和排序号。源库持续更新，文件级哈希仅用于受控输出，以及按需检查的单个 JSONL。未绑定到主轮次的内容不推断。派生会话保留可供追溯的父子索引。用户可见的问答控件按题目及回答恢复。附件登记到消息位置，无需打开图片。

相同内容再次运行时保留文件及修改时间。受管理的文件如与上一版清单不符，程序停止覆盖相应文件。若源中已有归档路径消失或清单范围缩小，应使用独立空目录复核。知识库的人工编辑应在归档之外进行。

独立复核器逐个校验哈希，按 ID 重新读取数据库的项目可见项，核对角色、顺序、重复和覆盖率，验证 Markdown 消息次序，并独立扫描两层输出。活跃会话在快照之后新增的项单独计数。可用 `--result 本地结果.json` 保存复核结果；失败时程序退出码为 1。

## ChatGPT 官方导出接口

```powershell
python -B -X utf8 .\chatgpt_intake.py '<官方导出 ZIP 的本地路径>'
```

预检接口登记整包 SHA-256、字节数，以及常见会话分卷和 HTML 的名称、大小、CRC32，全程读取 ZIP 目录，不展开文件。待有真实导出和项目 ID 允许名单后，再按官方包内的实际字段恢复指定会话的 `current_node` 祖先链、单独登记替代回复、缺失节点及附件；混合聊天还需明确项目消息范围。Codex 与 ChatGPT 使用独立的来源命名空间。
