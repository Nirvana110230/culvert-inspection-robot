"""Local visibility and release filters; both tiers exclude authentication data."""
import collections
import json
import re

VERSION = "1.1"
OMITTED = "〔受限内容已省略〕"
# Only database userMessage text and agentMessage text enter this module.
INJECTED = re.compile(
    r"(?im)(?:^|\n)\s*(?:#\s*AGENTS\.md instructions|<environment_context\b|<system(?:-reminder)?\b|<developer\b|"
    r"<INSTRUCTIONS>|<permissions instructions>|<subagent_notification>|<user_action>|<local-command|"
    r"<command-(?:name|message|args)>|<app-context>|<tools>|<turn_aborted>|<think(?:ing)?>|"
    r"<(?:context_compaction|conversation_summary|compaction_summary|summary)>|"
    r"(?:Another (?:AI|language )?model|A previous (?:AI|language )?model) (?:started|has|worked)|"
    r"You (?:are Codex|are an AI assistant|have access to the state of the tools)|"
    r"(?:This (?:conversation|session) is (?:being )?continued|The conversation (?:was|has been) compacted)|"
    r"(?:Here is|The following is) (?:a |the )?summary (?:from|of|provided)|"
    r"\[?(?:CONTEXT CHECKPOINT|CONTEXT COMPACTION|BEGIN (?:COMPACTED|SUMMARY)|Previous conversation summary)|"
    r"Message Type:\s*(?:NEW_TASK|MESSAGE|FINAL_ANSWER)|(?:assistant|user|developer|tool) to=|"
    r"(?:assistant|model)\s+(?:analysis|reasoning)\b|(?:系统注入|压缩上下文|历史压缩上下文)[：:])"
)
CREDENTIAL = re.compile(
    r"(?i)密码|口令|密[钥鑰]|私[钥鑰]|凭[据证]|令牌|访问密令|认证码|验证码|登录信息|登录名|用户名|"
    r"pass(?:word|wd|phrase)|\b(?:pwd|secret|authorization|bearer|credentials?|token|tokenized|oauth)\b|"
    r"(?:api|access|private|secret|auth|signing)[_-]?(?:token|key|secret)|sshpass|"
    r"BEGIN[ -].*(?:PRIVATE KEY|CERTIFICATE)|(?:ssh-(?:rsa|ed25519)|ecdsa-sha2-)|"
    r"(?<!\w)(?:gh[pousr]_|github_pat_|sk-(?:proj-)?|AKIA|ASIA|xox[baprs]-|AIza)[\w-]{8,}|"
    r"eyJ[\w-]{6,}\.eyJ|://[^/\s]+:[^/\s@]+@|[?&](?:signature|sig|key|code|auth|token)=|"
    r"(?:identityfile|authorized_keys|id_ed25519|id_rsa|/\.ssh/|\\\.ssh\\)|"
    r"(?<![\w/-])-p\s+\S+\s+(?:ssh|scp)\b|(?:--password|--secret|--token)\b|"
    r"(?<![A-Za-z0-9])[A-Za-z]{4,}\d{5,}(?![A-Za-z0-9])|热点名称|无线密码|\bssid\b|"
    r"(?:sudo\s+-S|echo\s+.*\|\s*sudo|--passphrase)|账号(?:是|为|[：:])"
)
PRIVATE = re.compile(r"(?i)我的女朋友|私人信件|家庭住址|身份证号|手机号码|个人邮箱|私聊记录|恋爱纪念|我和女友")
PEM = re.compile(r"(?ims)-{2,}BEGIN [^-\r\n]*(?:PRIVATE KEY|CERTIFICATE)-{2,}.*?(?:-{2,}END [^-\r\n]+-{2,}|\Z)")
OPAQUE = re.compile(r"(?<![A-Za-z0-9])[A-Za-z0-9+=_-]{44,}(?![A-Za-z0-9])|(?<![A-Za-z0-9])[A-Za-z0-9+/]{48,}={1,2}(?![A-Za-z0-9])")
PROJECTION = re.compile(r"(?is)<(?:oai-mem-citation|response-annotations)>.*?(?:</(?:oai-mem-citation|response-annotations)>|\Z)")
UNTRUSTED_INLINE = re.compile(r"(?i)<\|(?:im_start|im_end|start_header_id|end_header_id)\|>|</?(?:system-reminder|environment_context|subagent_notification|think|thinking|developer|compacted|reasoning)\b|(?:internal_chat_message_metadata_passthrough)|(?:tools?\.(?:exec_command|write_stdin)\s*\()")
IP = re.compile(r"(?<![A-Za-z0-9.])(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(?![A-Za-z0-9.])")
MAC = re.compile(r"(?i)(?<![\da-f])(?:[\da-f]{2}[:-]){5}[\da-f]{2}(?![\da-f])")
PATH = re.compile(r"""(?ix)(?:file:///?|/mnt/[a-z]/|(?:\\\\\?\\)?[a-z]:[\\/]|\\\\[\w.-]+\\|(?<![a-z0-9./])/(?:home|root|Users|media|mnt|run/user|var/lib|opt|tmp|srv|data)(?:[/\\]|(?=[`\s])))[^\r\n"'`<>|，。；：！？）】\])]*""")
IDENTIFIER = re.compile(
    r"(?i)(?:序列号|设备号|设备唯一标识|设备编号|硬件序号|机器名|主机名|设备序号|用户名|"
    r"serial\s*(?:number|no\.)|\b(?:serialnumber|serial_no|device_id|machine_id|host_name|hostname|machine-id)\b|"
    r"(?<![\w/])s/?n(?=\s*[:=：#])|/dev/(?:serial/by-id|disk/by-id)/|"
    r"(?<!\w)(?:usb-|PCI\\VEN_|USB\\VID_|47MD|3HEN)[A-Za-z0-9_.&:-]{5,})"
)
REMOTE = re.compile(r"(?i)(?<![\w-])[\w.-]+@[\w.-]+(?:\.[\w.-]+)*")
LINK_LOCAL = re.compile(r"(?i)\b(?:fe80:|fd[\da-f]{2}:)[\da-f:%.-]+")
SOCIAL = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\w)")
DEVICE_NAME = re.compile(r"(?i)(?<![A-Za-z0-9_-])(?:[a-z0-9]+(?:-[a-z0-9]+)*-usb|desktop-[a-z0-9]{5,})(?![a-z0-9_-])")
URL = re.compile(r"(?i)\b(?:https?|ssh|ftp)://[^\s<>`\])，。；]+")
LOCAL_TERM = re.compile(r"(?!)")


def configure_aliases(aliases):
    global LOCAL_TERM
    if aliases:
        LOCAL_TERM = re.compile(r"(?i)(?<![a-z0-9_-])(?:" + "|".join(re.escape(x) for x in sorted(aliases, key=len, reverse=True)) + r")(?![a-z0-9_-])")


def local_aliases(text):
    patterns = (r"(?:/home/|[\\/]Users[\\/])([a-z0-9_.-]{2,48})(?=[\\/\s`'\"]|$)",
                r"(?<![a-z0-9])([a-z0-9_.-]{2,32})@(?:\d{1,3}\.|[a-z0-9-]+-usb)",
                r"(?:^|[\s`])ssh\s+([a-z0-9-]{2,40})(?=[\s`]|$)")
    generic = {"home", "user", "users", "root", "ubuntu", "jetson", "orangepi", "localhost", "host", "vs", "all", "none", "admin", "ros", "multi", "ssh", "connection", "login", "service", "client", "server", "hostkey", "tunnel", "version", "hostkeyalias", "pi", "windows", "linux"}
    return {x.casefold() for p in patterns for x in re.findall(p, text, re.I | re.M) if x.casefold() not in generic and not x.startswith("-")}


def floor_filter(value, role, counts):
    """Mandatory floor, applied before serializing either tier."""
    value = value.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    reply = re.fullmatch(r"\s*<send_user_message_question_reply>(.*?)</send_user_message_question_reply>\s*", value, re.S)
    if reply:
        try:
            pairs = json.loads(reply[1])
            value = "\n".join("提问　" + str(x["question"]) + "\n用户回答　" + str(x["answer"]) for x in pairs)
        except (KeyError, TypeError, ValueError):
            counts["unrecognized_reply"] += 1
            return ""
    if "My request for Codex:" in value:
        value = value.split("My request for Codex:", 1)[1]
        counts["ide_context"] += 1
    value, n = PROJECTION.subn("", value)
    counts["annotations"] += n
    boundary = INJECTED.search(value)
    if boundary:
        value = value[:boundary.start()]
        counts["runtime_or_summary"] += 1
    boundary = UNTRUSTED_INLINE.search(value)
    if boundary:
        value = value[:boundary.start()]
        counts["runtime_or_summary"] += 1
    value, n = PEM.subn(OMITTED, value)
    counts["pem_block"] += n
    lines = []
    skip_next = False
    for line in value.splitlines():
        hit = CREDENTIAL.search(line)
        if hit or PRIVATE.search(line):
            counts["private_or_auth_line"] += 1
            # A label, prompt, or multi-line assignment may put the value on the next line.
            skip_next = bool(re.search(r"[:：=]\s*[`'\"{[]?\s*$", line))
            line = OMITTED
        elif skip_next and line.strip():
            counts["continuation"] += 1
            line = OMITTED
            skip_next = False
        elif role == "user" and re.fullmatch(r"\s*[`'\"]?[A-Za-z0-9!@$%^&_+=./*#-]{3,120}[`'\"]?\s*", line):
            counts["unlabeled_value"] += 1
            line = OMITTED
        line, n = OPAQUE.subn("〔长编码已省略〕", line)
        counts["opaque_value"] += n
        if line != OMITTED or not lines or lines[-1] != OMITTED:
            lines.append(line)
    return "\n".join(lines).strip()


def release_filter(value, counts=None):
    counts = collections.Counter() if counts is None else counts
    lines = []
    for line in value.splitlines():
        if IDENTIFIER.search(line):
            counts["device_identifier_line"] += 1
            lines.append("〔设备标识所在行已省略〕")
            continue
        for kind, rx, replacement in (
                ("address", REMOTE, "〔账户地址〕"), ("url", URL, "〔外部链接〕"),
                ("mac", MAC, "〔硬件地址〕"), ("ipv6", LINK_LOCAL, "〔网络地址〕"),
                ("ipv4", IP, "〔网络地址〕"), ("local_path", PATH, "〔本机路径〕"),
                ("phone_id", SOCIAL, "〔个人标识〕"), ("device_alias", DEVICE_NAME, "〔设备别名〕"),
                ("project_local_alias", LOCAL_TERM, "〔本地代称〕")):
            line, n = rx.subn(replacement, line)
            counts[kind] += n
        lines.append(line)
    return "\n".join(lines)
