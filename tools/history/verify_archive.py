"""Independent file, membership, order and exposure checks. Prints no conversation text."""
import argparse
import collections
import csv
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import sqlite3


def load(path):
    return json.loads(path.read_text("utf-8"))


def hashed(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scan(body, restricted):
    common = {
        "key_envelope": r"-----BEGIN [^-\n]*(?:PRIVATE KEY|CERTIFICATE)-----",
        "service_key": r"(?:github_pat_|gh[pousr]_|sk-(?:proj-)?|xox[baprs]-|AIza|AKIA|ASIA)[A-Za-z0-9_-]{12,}",
        "jwt": r"(?<![A-Za-z0-9])eyJ[\w-]{6,}\.eyJ[\w-]+\.[\w-]+",
        "url_credentials": r"(?i)://[^/\s:@]+:[^/\s@]+@",
        "auth_assignment": r"(?i)(?:passw(?:or)?d|passwd|access[_-]?token|secret[_-]?key|api[_-]?key|密码|口令|私钥)(?:\s*[:=：为是]\s*)[^\s，。；、]{2,}",
        "credential_payload": r"(?i)(?:authorization\s*:\s*(?:basic|bearer)\s+\S+|ssh-(?:ed25519|rsa)\s+[a-z0-9+/=]{15,})",
        "runtime": r"(?im)(?:<environment_context[\s>]|<INSTRUCTIONS>|<oai-mem-citation>|<subagent_notification>|<think>|<\|im_start\|>|^\s*(?:You are Codex|CONTEXT CHECKPOINT|This conversation is being continued|Another language model started|Message Type:\s*NEW_TASK))",
        "device_address": r"(?i)(?<![0-9a-f])(?:[a-f0-9]{2}[:-]){5}[a-f0-9]{2}(?![0-9a-f])",
        "private_contact": r"(?<!\d)(?:1[3-9]\d{9}|\d{17}[\dXx])(?!\d)",
        "email": r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[a-z]{2,}\b",
        "local_path": r"(?i)(?:[a-z]:[\\/]|/(?:home|Users|mnt)[/\\])",
    }
    if restricted:
        for key in ("device_address", "private_contact", "email", "local_path"):
            common.pop(key)
    findings = collections.Counter({key: len(re.findall(rx, body)) for key,rx in common.items()})
    if not restricted:
        for token in re.findall(r"(?<![0-9.])(?:\d{1,3}\.){3}\d{1,3}(?![0-9.])", body):
            try:
                ipaddress.IPv4Address(token)
                findings["ipv4"] += 1
            except ValueError:
                pass
    return {k:v for k,v in findings.items() if v}


def check(args):
    root = args.out.resolve()
    manifest = load(root / "indexes/manifest.json")
    index = load(root / "indexes/session_inventory.json")
    sessions = load(root / "indexes/main_sessions.json")
    problems, checks, screens = [], collections.Counter(), collections.Counter()
    observed = set()
    for rel, value in manifest["files"].items():
        p = (root / rel).resolve()
        if not p.is_relative_to(root) or not p.is_file() or hashed(p) != value:
            problems.append(["file_hash",rel])
        observed.add(rel)
    actual = {p.relative_to(root).as_posix() for d in ("indexes","source-visible","redacted") for p in (root/d).rglob("*") if p.is_file()}
    if actual != observed | {"indexes/manifest.json"}:
        problems.append(["unexpected_files",len(actual.symmetric_difference(observed | {"indexes/manifest.json"}))])
    with args.inventory.open(encoding="utf-8-sig", newline="") as fp:
        seeds = list(csv.DictReader(fp))
    if set(r["会话ID"] for r in seeds) - {r["id"] for r in index} or manifest["g1_sha256"] != hashed(args.inventory):
        problems.append(["inventory_coverage",len(seeds)])
    allowed = {r["id"] for r in index if r["kind"] == "main"}
    if set(sessions) != allowed or len({x["id"] for x in index}) != len(index):
        problems.append(["duplicate_or_wrong_role",0])
    db = sqlite3.connect((args.codex / "thread_history_1.sqlite").resolve().as_uri()+"?mode=ro",uri=True)
    db.execute("pragma query_only=on")
    db.execute("begin")
    for uid, info in sessions.items():
        rows = db.execute("""select turn_id,item_id,item_type,rollout_ordinal from thread_items where thread_id=?
                           and item_type in ('agentMessage','userMessage') order by rollout_ordinal,item_id""",(uid,)).fetchall()
        original = {(t,i):(kind,n) for t,i,kind,n in rows}
        stage = [json.loads(line) for line in (root/info["raw"]).read_text("utf-8").splitlines()]
        source_digest = hashlib.sha256()
        source_queries = (
            """select turn_id,rollout_ordinal,status,started_at,completed_at,root_turn_id,first_user_item_id,final_agent_item_id
               from thread_turns where thread_id=? order by rollout_ordinal,turn_id""",
            """select turn_id,item_id,rollout_ordinal,created_at_ms,item_json,item_type from thread_items
               where thread_id=? and item_type in ('userMessage','agentMessage') order by rollout_ordinal,item_id""")
        for query in source_queries:
            for row in db.execute(query,(uid,)):
                encoded=json.dumps(list(row),ensure_ascii=False,sort_keys=True,separators=(",",":"))
                source_digest.update((encoded+"\n").encode())
        if source_digest.hexdigest() == info["source_projection_sha256"]:
            checks["source_digests_recomputed"] += 1
        elif any(turn["status"] == "inProgress" for turn in stage):
            checks["ongoing_source_changed_after_snapshot"] += 1
        else:
            problems.append(["historical_source_digest",uid])
        detail = load(root / "indexes/detail" / (uid+".json"))
        md = (root/info["markdown"]).read_text("utf-8")
        ordered_ids = []
        serial = []
        source_found = set()
        for turn in stage:
            serial.append(turn["ordinal"])
            order = []
            for item in turn["messages"]:
                mid = (turn["id"],item["id"])
                kind = {"user":"userMessage","assistant":"agentMessage"}.get(item["role"])
                ordered_ids.append(item["id"])
                order.append(item["ordinal"])
                if item["source"].startswith("SQLite:"):
                    if original.get(mid) != (kind,item["ordinal"]) or mid in source_found:
                        problems.append(["source_item",uid])
                    source_found.add(mid)
                elif item["source"] != "JSONL:event_msg" or not detail["jsonl"] or not detail["jsonl"].get("sha256"):
                    problems.append(["unverified_jsonl",uid])
                checks[item["role"]] += 1
                for typ,n in scan(item["text"],True).items():
                    screens["source_visible:"+typ]+=n
            if order != sorted(order):
                problems.append(["item_order",uid])
        if serial != sorted(serial) or len(serial) != info["turns"]:
            problems.append(["turn_order",uid])
        if re.findall(r"(?m)^消息 ID　`([^`]+)`$",md) != ordered_ids:
            problems.append(["markdown_order",uid])
        if set(original) != source_found:
            # Source-only changes may happen while a concurrent chat is still in progress.
            live_ids = [t for t, in db.execute("select turn_id from thread_turns where thread_id=? and status='inProgress'",(uid,))]
            extra = set(original) - source_found
            if extra and not (source_found - set(original)) and all(t in live_ids for t,_ in extra):
                checks["new_live_items_after_snapshot"] += len(extra)
            else:
                problems.append(["source_visible_coverage",uid])
        # Generated source identifiers are checked against SQLite in sequence above.
        # A decimal run inside a cryptographic message ID is not user-supplied body text.
        metadata_lines = {f"消息 ID　`{iid}`" for iid in ordered_ids}
        metadata_lines.update(f"轮次 ID　`{turn['id']}`" for turn in stage)
        metadata_lines.add(f"- 会话 ID　`{uid}`")
        body = "\n".join(line for line in md.splitlines() if line not in metadata_lines)
        for typ,n in scan(body,False).items():
            screens["redacted:"+typ]+=n
        checks["turns"] += len(stage)
        checks["attachments"] += len(detail["attachments"])
        checks["gaps"] += len(detail["gaps"])
        if detail["jsonl"] and detail["jsonl"].get("sha256"):
            checks["jsonl_verified"] += 1
            checks["jsonl_turns_checked"] += len(detail["jsonl"]["examined_turns"])
            checks["jsonl_messages_added"] += detail["jsonl"]["added_items"]
    db.close()
    return {"ok":not problems and not screens, "problems":problems, "sensitive_findings":dict(screens),
            "indexed":dict(collections.Counter(x["kind"] for x in index)), "sessions":len(sessions),
            "files_sha256_checked":len(observed), "g1_entries":len(seeds), "checks":dict(checks),
            "manifest_sha256":hashed(root/"indexes/manifest.json")}


if __name__ == "__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    for k in ("out","codex","inventory"):
        ap.add_argument("--"+k, required=True, type=Path)
    ap.add_argument("--result",type=Path)
    args=ap.parse_args()
    result=check(args)
    text=json.dumps(result, ensure_ascii=False, indent=2)+"\n"
    if args.result:
        args.result.write_text(text,"utf-8")
    print(text)
    raise SystemExit(0 if result["ok"] else 1)
