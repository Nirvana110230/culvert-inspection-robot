"""Restore private component repositories at the commits in the integration lock."""
import argparse
from pathlib import Path
import subprocess

import yaml


def git(*args, output=False):
    result = subprocess.run(
        ["git", "-c", "core.autocrlf=false", *map(str, args)],
        check=True, capture_output=output, text=True,
    )
    return result.stdout.strip() if output else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    target = parser.parse_args().directory.resolve()
    lock = Path(__file__).resolve().parents[1] / "COMPONENT_VERSION_MANIFEST.yml"
    components = yaml.safe_load(lock.read_text(encoding="utf-8"))["components"]
    target.mkdir(parents=True, exist_ok=True)
    for entry in components:
        name = entry["repository"]
        dest = target / name
        if not dest.exists():
            git("clone", "--no-checkout", "--config", "core.autocrlf=false", entry["remote"], dest)
            git("-C", dest, "checkout", "--detach", entry["commit"])
        checks = {
            "rev-parse HEAD": entry["commit"],
            "rev-parse HEAD^{tree}": entry["tree"],
            "rev-parse refs/tags/" + entry["tag"] + "^{commit}": entry["commit"],
            "remote get-url origin": entry["remote"],
            "status --porcelain": "",
        }
        experiment = entry.get("b0_experiment")
        if experiment:
            checks["rev-parse " + experiment["commit"] + "^{tree}"] = experiment["tree"]
            for tag in experiment["tags"]:
                checks["rev-parse refs/tags/" + tag + "^{commit}"] = experiment["commit"]
        for command, expected in checks.items():
            actual = git("-C", dest, *command.split(), output=True)
            if actual != expected:
                raise SystemExit(f"{dest}: {command} differs from the lock or checkout is dirty")
        print(f"{name}  {entry['commit']}  {entry['tag']}")


if __name__ == "__main__":
    main()
