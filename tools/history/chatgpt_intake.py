"""Preflight official ChatGPT export ZIP locally; no extraction or conversation export."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


def inspect_export(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024*1024), b""):
            h.update(block)
    with zipfile.ZipFile(path) as package:
        members = []
        for item in package.infolist():
            name = PurePosixPath(item.filename)
            if name.is_absolute() or ".." in name.parts:
                raise ValueError("存在不安全的分卷成员名")
            if re.fullmatch(r"conversations(?:[-_]\d+)?\.json|chat\.html",name.name,re.I):
                members.append({"member_basename": name.name, "size": item.file_size, "crc32": f"{item.CRC:08x}"})
    return {"source":"chatgpt", "package_sha256":h.hexdigest(),"package_bytes":path.stat().st_size,
            "members":members,"next":"使用经复核的项目会话 ID 及节点范围恢复 current_node 主线，替代分支仅登记；本预检不读取成员正文。"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("zip",type=Path)
    print(json.dumps(inspect_export(parser.parse_args().zip),ensure_ascii=False,indent=2))
