"""Export project-allowlisted Codex visible items from an online read-only snapshot."""
import argparse
import collections
import csv
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile

from history_filter import CREDENTIAL, PRIVATE, VERSION, configure_aliases, floor_filter, local_aliases, release_filter

TZ = dt.timezone(dt.timedelta(hours=8))
MAIN = {"vscode", "cli", "appServer", "desktop", "exec"}
PROJECT = re.compile(r"涵洞|巡检机器人|履带底盘|轮式底盘|机器人仓库|FAST[-_ ]?LIVO|Mid[-_ ]?360|Orange\s*Pi|Jetson|STM32|海康相机", re.I)


def as_json(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stream_hash(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def encode(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def iso(stamp):
    if stamp is None:
        return None
    return dt.datetime.fromtimestamp(stamp / 1000 if stamp > 100000000000 else stamp, TZ).isoformat(timespec="seconds")


def ro(path):
    db = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    db.execute("pragma query_only=on")
    db.execute("begin")
    return db


def normal(path):
    return os.path.normcase(os.path.normpath(str(path).removeprefix("\\\\?\\")))


def classify(source):
    if source in MAIN:
        return "main", None
    try:
        sub = json.loads(source)["subagent"]
        if "thread_spawn" in sub:
            return "derived", sub["thread_spawn"].get("parent_thread_id")
        if sub.get("other") == "guardian":
            return "approval", None
    except (TypeError, ValueError, KeyError):
        pass
    return "other", None


def select_threads(db, seeds, roots, extra_ids):
    allowed = {normal(p) for p in roots}
    project_ids = {r["project_id"] for r in db.execute("select project_id,path from project_roots") if normal(r["path"]) in allowed}
    meta = {}
    sql = "select id,created_at,updated_at,source,cwd,archived,project_id,attached_thread_parent_id from threads order by created_at,id"
    rows = list(db.execute(sql))
    latest_seed = max(r["created_at"] for r in rows if r["id"] in seeds)
    for row in rows:
        uid = row["id"]
        rec = seeds.get(uid)
        kind, parent = classify(row["source"])
        where = normal(row["cwd"] or "")
        in_project = any(where == p or where.startswith(p + os.sep) for p in allowed) or row["project_id"] in project_ids
        reason = "G1 ID"
        if not rec:
            if uid in extra_ids:
                reason = "显式项目 ID"
            elif kind == "main" and in_project and row["created_at"] >= latest_seed:
                # Inspect initial request only for new local candidates in explicitly named project roots.
                first = db.execute("select first_user_message from threads where id=?", (uid,)).fetchone()[0] or ""
                if not PROJECT.search(first) or PRIVATE.search(first):
                    continue
                reason = "新增；项目根与首条任务命中"
            else:
                continue
        title = rec["标题"] if rec else "新增项目主会话"
        counts = collections.Counter()
        title = release_filter(floor_filter(title, "metadata", counts)).strip().replace("\n", " ")[:90] or "项目会话"
        meta[uid] = {"id": uid, "kind": kind, "created": iso(row["created_at"]), "updated": iso(row["updated_at"]),
                     "archived": bool(row["archived"]), "basis": reason, "topic": rec["主题"] if rec else "工程管理与交接",
                     "title": title if kind == "main" else None, "parent": parent or row["attached_thread_parent_id"],
                     "project_alias": (rec["工作目录"].rstrip("/\\").split("\\")[-1] if rec else "项目工作区"),
                     "project_id": row["project_id"], "g1": rec is not None}
    # Parent metadata can establish derived membership when the child has no project_id.
    for row in rows:
        uid = row["id"]
        kind, parent = classify(row["source"])
        if uid in meta or row["created_at"] < latest_seed:
            continue
        where = normal(row["cwd"] or "")
        rooted = any(where == p or where.startswith(p + os.sep) for p in allowed) or row["project_id"] in project_ids
        if not ((kind == "derived" and parent in meta) or (kind == "approval" and rooted)):
            continue
        meta[uid] = {"id": uid, "kind": kind, "parent": parent, "created": iso(row["created_at"]),
                     "updated": iso(row["updated_at"]), "archived": bool(row["archived"]), "g1": False,
                     "basis": "新增父子关系" if parent else "新增项目审批索引"}
    if set(seeds) - set(meta) or set(extra_ids) - set(meta):
        raise ValueError("清单或显式 ID 在当前状态库中缺项，停止发布")
    return meta


def verified_fallback(db, codex, uid, gaps):
    """Use only explicit visible event envelopes. Model-input response_item is never a fallback."""
    out = collections.defaultdict(list)
    if not gaps:
        return out, None
    item = db.execute("select rollout_path from threads where id=?", (uid,)).fetchone()[0]
    if not item:
        return out, {"state": "未登记 JSONL"}
    path = Path(str(item).removeprefix("\\\\?\\")).resolve()
    if not path.is_file() or not any(path.is_relative_to((codex / sub).resolve()) for sub in ("sessions", "archived_sessions")):
        return out, {"state": "未发现已核实的本机 JSONL"}
    valid = False
    cur = None
    seen = set()
    h = hashlib.sha256()
    event = 0
    with path.open("rb") as source:
        for raw in source:
            event += 1
            h.update(raw)
            try:
                row = json.loads(raw)
            except ValueError:
                return {}, {"state": "JSONL 无法完整解析，未采用"}
            typ = row.get("type")
            pay = row.get("payload") or {}
            if typ == "session_meta":
                valid = pay.get("id") == uid
                if not valid:
                    return {}, {"state": "JSONL ID 不符，未采用"}
            if typ == "turn_context" or (typ == "event_msg" and pay.get("type") == "task_started"):
                cur = pay.get("turn_id")
            role = {"user_message": "user", "agent_message": "assistant"}.get(pay.get("type"))
            if not (valid and cur in gaps and typ == "event_msg" and role):
                continue
            value = pay.get("message")
            if not isinstance(value, str):
                continue
            # Envelope line number preserves legitimately repeated visible messages in sequence.
            key = (cur, pay.get("id") or f"jsonl-line-{event}")
            if key in seen:
                continue
            seen.add(key)
            out[cur].append({"id": key[1], "ordinal": event, "role": role, "phase": pay.get("phase"),
                             "source": "JSONL:event_msg", "time": row.get("timestamp"), "text": value})
    if not valid:
        return {}, {"state": "JSONL 未验证会话身份，未采用"}
    return out, {"state": "按会话 ID 核实并检查可见事件", "sha256": h.hexdigest(),
                 "file": path.name, "examined_turns": sorted(gaps), "added_items": sum(map(len, out.values()))}


def project(db, state, codex, info):
    uid = info["id"]
    source = hashlib.sha256()
    turns = {}
    counters = collections.Counter()
    attachments = []
    gaps = []
    for row in db.execute("select turn_id,rollout_ordinal,status,started_at,completed_at,root_turn_id,first_user_item_id,final_agent_item_id from thread_turns where thread_id=? order by rollout_ordinal,turn_id", (uid,)):
        source.update((as_json(list(row)) + "\n").encode())
        turns[row["turn_id"]] = {"id": row["turn_id"], "ordinal": row["rollout_ordinal"], "status": row["status"],
                                 "start": iso(row["started_at"]), "end": iso(row["completed_at"]),
                                 "root_turn": row["root_turn_id"], "messages": [], "_refs": [row["first_user_item_id"], row["final_agent_item_id"]]}
    sql = """select turn_id,item_id,rollout_ordinal,created_at_ms,item_json,item_type from thread_items
             where thread_id=? and item_type in ('userMessage','agentMessage') order by rollout_ordinal,item_id"""
    seen = set()
    for row in db.execute(sql, (uid,)):
        source.update((as_json(list(row)) + "\n").encode())
        tid, iid, ordinal, stamp, serialized, typ = row
        if tid not in turns:
            gaps.append({"turn": tid, "item": iid, "why": "缺少父轮次"})
            continue
        if (tid, iid) in seen:
            counters["duplicate_item_id"] += 1
            continue
        seen.add((tid, iid))
        try:
            item = json.loads(serialized)
        except ValueError:
            gaps.append({"turn": tid, "item": iid, "why": "可见项 JSON 无法解析"})
            continue
        role = "user" if typ == "userMessage" else "assistant"
        if role == "user":
            text = []
            for pos, chunk in enumerate(item.get("content", [])):
                if chunk.get("type") == "text":
                    text.append(chunk.get("text", ""))
                else:
                    attachments.append({"turn": tid, "item": iid, "position": pos, "kind": re.sub(r"[^a-zA-Z_]", "", str(chunk.get("type")))[:30],
                                        "status": "仅记录源引用，未读取或复制附件"})
            body = "\n".join(text)
        else:
            body = item.get("text") or ""
            # Desktop interactive questions can carry display options outside the text field.
            parts = [body]
            for question in item.get("questions") or []:
                if not isinstance(question, dict):
                    continue
                for entry in (question.get("title"), *(question.get("options") or [])):
                    if isinstance(entry, str) and entry.strip() and entry not in body:
                        parts.append("交互选项　" + entry.strip())
                        counters["additional_visible_question_fields"] += 1
            body = "\n".join(parts)
        turns[tid]["messages"].append({"id": iid, "ordinal": ordinal, "source": "SQLite:" + typ, "role": role,
                                       "phase": item.get("phase"), "time": iso(stamp), "text": body})
        counters["source_" + role] += 1
    empties = {tid for tid, turn in turns.items() if not turn["messages"]}
    supplemented, fallback = verified_fallback(state, codex, uid, empties)
    for tid, msgs in supplemented.items():
        turns[tid]["messages"].extend(msgs)
    last_assistant_credential = False
    for tid, turn in turns.items():
        for ref in turn.pop("_refs"):
            if ref and (tid, ref) not in seen:
                gaps.append({"turn": tid, "item": ref, "why": "数据库所指首末项缺失"})
        if not turn["messages"]:
            gaps.append({"turn": tid, "why": "无可确认的可见消息"})
        if turn["status"] != "completed":
            gaps.append({"turn": tid, "why": "源轮次状态 " + str(turn["status"])})
        for msg in turn["messages"]:
            value = msg["text"]
            # Short unstructured replies following authentication instructions can be bare credentials.
            if msg["role"] == "user" and last_assistant_credential and len(value.strip()) <= 220:
                value = "〔受限内容已省略〕"
                counters["reply_after_auth"] += 1
            if msg["role"] == "assistant":
                last_assistant_credential = bool(CREDENTIAL.search(value))
            body = floor_filter(value, msg["role"], counters)
            if not body:
                gaps.append({"turn": tid, "item": msg["id"], "why": "可见文本为空或经过筛选已移除"})
            msg["text"] = body
    return list(turns.values()), attachments, gaps, fallback, counters, source.hexdigest()


def markdown(info, turns, attachments, gaps, counts):
    uid = info["id"]
    lines = ["# " + info["title"], "", f"- 会话 ID　`{uid}`", "- 时区　UTC+08:00（JSONL 原始时间保留其偏移）",
             "- 工作区代称　" + info["project_alias"], "- 创建时间　" + info["created"],
             "- 来源　Codex 分页库用户与助手可见项；正文已脱敏。", f"- 附件引用 {len(attachments)} 项；缺项或异常状态 {len(gaps)} 项，详见同级归档索引。"]
    for n, turn in enumerate(turns, 1):
        lines.extend(["", f"## 第 {n} 轮　{turn['start'] or '源时间缺失'}　{turn['status']}", "", f"轮次 ID　`{turn['id']}`"])
        for msg in turn["messages"]:
            role = "用户" if msg["role"] == "user" else "助手"
            lines.extend(["", f"### {role}　{msg['time'] or '源时间缺失'}　{msg['phase'] or ''}".rstrip(), "",
                          f"消息 ID　`{msg['id']}`", "", release_filter(msg["text"], counts) or "〔源可见正文缺项〕"])
    return ("\n".join(lines) + "\n").encode()


def write(path, data, prior=None):
    new = digest(data)
    if path.is_file():
        old = stream_hash(path)
        if old == new:
            return new, False
        if prior is not None and old != prior:
            raise ValueError("目标有未登记编辑，停止覆盖：" + path.name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        tmp = Path(f.name)
        f.write(data)
    os.replace(tmp, path)
    return new, True


def run(args):
    out = args.out.resolve()
    home = args.codex.resolve()
    if out.is_relative_to(home) or home.is_relative_to(out):
        raise ValueError("输出与输入目录必须分开")
    with args.inventory.open(encoding="utf-8-sig", newline="") as f:
        seeds = {r["会话ID"]: r for r in csv.DictReader(f)}
    state, hist = ro(home / "state_5.sqlite"), ro(home / "thread_history_1.sqlite")
    manifest = out / "indexes" / "manifest.json"
    old = json.loads(manifest.read_text(encoding="utf-8"))["files"] if manifest.exists() else {}
    files, summaries = {}, {}
    def save(rel, data):
        files[rel] = write(out / rel, data, old.get(rel, "") if (out / rel).exists() else None)[0]
    try:
        meta = select_threads(state, seeds, args.root, args.include_id)
        aliases = set()
        for uid, info in meta.items():
            if info["kind"] == "main":
                for (encoded,) in hist.execute("select item_json from thread_items where thread_id=? and item_type in ('agentMessage','userMessage')", (uid,)):
                    item = json.loads(encoded)
                    body = item.get("text") or "\n".join(x.get("text", "") for x in item.get("content", []) if x.get("type") == "text")
                    aliases.update(local_aliases(body))
        configure_aliases(aliases)
        children = collections.defaultdict(list)
        for uid, info in meta.items():
            if info.get("parent"):
                children[info["parent"]].append(uid)
        for uid, info in meta.items():
            if info["kind"] != "main":
                continue
            turns, attachments, gaps, fallback, counts, src_hash = project(hist, state, home, info)
            year, day = info["created"][:4], info["created"][:10]
            slug = re.sub(r"[^\w\u4e00-\u9fff-]+", "_", info["title"]).strip("_")[:28] or "项目会话"
            rel = f"redacted/codex/{year}/{day}_{slug}_{uid}.md"
            raw = f"source-visible/codex/{year}/{uid}.jsonl"
            save(raw, "".join(as_json(turn) + "\n" for turn in turns).encode())
            save(rel, markdown(info, turns, attachments, gaps, counts))
            branch = [{"turn": t["id"], "root_turn": t["root_turn"]} for t in turns if t["root_turn"] and t["root_turn"] != t["id"]]
            item = {"id": uid, "children": sorted(children[uid]), "turn_links": branch, "attachments": attachments, "gaps": gaps, "jsonl": fallback}
            save("indexes/detail/" + uid + ".json", encode(item))
            summaries[uid] = {"turns": len(turns), "users": sum(m["role"] == "user" for t in turns for m in t["messages"]),
                              "assistants": sum(m["role"] == "assistant" for t in turns for m in t["messages"]),
                              "source_projection_sha256": src_hash, "raw": raw, "markdown": rel, "attachments": len(attachments),
                              "gaps": len(gaps), "noncompleted_turns": sum(t["status"] != "completed" for t in turns),
                              "filter_counts": {k: v for k,v in counts.items() if v}}
        save("indexes/session_inventory.json", encode(list(meta.values())))
        save("indexes/main_sessions.json", encode(summaries))
        registry = {"parser_version": VERSION, "g1_sha256": stream_hash(args.inventory), "files": files,
                    "state_source": "state_5.sqlite/threads + project_roots",
                    "visible_source": "thread_history_1.sqlite/thread_turns + selected thread_items ordered by rollout_ordinal,item_id",
                    "sha256_scope": "per-thread selected source metadata / visible item projection; live WAL databases are not copied"}
        if set(old) - set(files):
            raise ValueError("旧清单含本轮未覆盖文件；请另建输出或核对范围")
        write(manifest, encode(registry))
    finally:
        state.close()
        hist.close()
    print(as_json({"sessions": len(summaries), "indexed": len(meta), "tracked_files": len(files)}))


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--codex", type=Path, required=True)
    cli.add_argument("--inventory", type=Path, required=True)
    cli.add_argument("--root", type=Path, action="append", required=True)
    cli.add_argument("--include-id", action="append", default=[])
    cli.add_argument("--out", type=Path, required=True)
    run(cli.parse_args())
