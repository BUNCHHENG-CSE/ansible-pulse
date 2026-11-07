import os
import re
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from ..models.schemas import AnsibleAsset, AnsibleTask, ScriptType

# Standard Ansible task control keys that are NOT module names
ANSIBLE_TASK_CONTROL_KEYS = {
    "name", "when", "tags", "notify", "register", "become", "become_user",
    "become_method", "ignore_errors", "delegate_to", "run_once", "vars",
    "loop", "with_items", "with_dict", "with_file", "with_together", "with_sequence",
    "loop_control", "failed_when", "changed_when", "until", "retries", "delay",
    "check_mode", "diff", "environment", "no_log", "args", "async", "poll",
    "listen", "block", "rescue", "always"
}

# Module name normalizer mapping
MODULE_NORMALIZER = {
    "ansible.builtin.apt": "apt",
    "ansible.builtin.yum": "yum",
    "ansible.builtin.dnf": "dnf",
    "ansible.builtin.package": "package",
    "ansible.builtin.service": "service",
    "ansible.builtin.systemd": "systemd",
    "ansible.builtin.systemd_service": "systemd",
    "ansible.builtin.template": "template",
    "ansible.builtin.copy": "copy",
    "ansible.builtin.file": "file",
    "ansible.builtin.lineinfile": "lineinfile",
    "ansible.builtin.blockinfile": "blockinfile",
    "ansible.builtin.user": "user",
    "ansible.builtin.group": "group",
    "ansible.builtin.command": "command",
    "ansible.builtin.shell": "shell",
    "ansible.builtin.raw": "raw",
    "ansible.builtin.git": "git",
    "ansible.builtin.get_url": "get_url",
    "ansible.builtin.uri": "uri",
    "ansible.builtin.unarchive": "unarchive",
    "ansible.builtin.cron": "cron",
    "ansible.builtin.stat": "stat",
    "ansible.builtin.debug": "debug",
    "ansible.builtin.set_fact": "set_fact",
    "ansible.builtin.fail": "fail",
    "ansible.builtin.assert": "assert",
    "ansible.builtin.include_tasks": "include_tasks",
    "ansible.builtin.import_tasks": "import_tasks",
    "ansible.builtin.include_role": "include_role",
    "ansible.builtin.import_role": "import_role",
    "ansible.builtin.import_playbook": "import_playbook",
    "community.docker.docker_container": "docker_container",
    "community.docker.docker_image": "docker_image",
    "community.general.docker_container": "docker_container",
}

class SafeAnsibleYamlLoader(yaml.SafeLoader):
    """Custom YAML loader that ignores unknown Ansible tags like !vault, !unsafe."""
    pass

def _ignore_unknown_tags(loader, tag_suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    elif isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    elif isinstance(node, yaml.MappingNode):
        return loader.construct_mapping(node)
    return None

SafeAnsibleYamlLoader.add_multi_constructor('!', _ignore_unknown_tags)

class AnsibleYamlParser:
    @staticmethod
    def load_yaml(file_path: str) -> Optional[Any]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
                # If file contains Jinja expressions in places that break standard YAML,
                # we preserve structure where possible.
                return yaml.load(content, Loader=SafeAnsibleYamlLoader)
        except Exception as e:
            return None

    @staticmethod
    def extract_module_and_params(task_dict: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Identify which key is the Ansible module and return normalized name + params."""
        # Check for explicit 'action' key
        if "action" in task_dict:
            action_val = task_dict["action"]
            if isinstance(action_val, dict):
                module = next(iter(action_val.keys()), "unknown")
                params = action_val.get(module, {})
                if not isinstance(params, dict):
                    params = {"_raw": str(params)}
                norm_module = MODULE_NORMALIZER.get(module, module.split(".")[-1])
                return norm_module, params
            elif isinstance(action_val, str):
                parts = action_val.split(None, 1)
                module = parts[0]
                norm_module = MODULE_NORMALIZER.get(module, module.split(".")[-1])
                return norm_module, {"_raw": parts[1] if len(parts) > 1 else ""}

        # Search keys excluding control keys
        candidate_modules = [k for k in task_dict.keys() if k not in ANSIBLE_TASK_CONTROL_KEYS]
        if not candidate_modules:
            return "unknown", {}

        # Pick first candidate module
        module_key = candidate_modules[0]
        params = task_dict.get(module_key, {})
        if not isinstance(params, dict):
            params = {"_raw": str(params) if params is not None else ""}

        norm_module = MODULE_NORMALIZER.get(module_key, module_key.split(".")[-1])
        return norm_module, params

    @staticmethod
    def compute_task_signature(module: str, params: Dict[str, Any], name: str) -> str:
        """Create a canonical fingerprint for duplicate detection."""
        # Extract target (package name, service name, user name, file path, container name)
        target = ""
        for key in ["name", "path", "dest", "src", "repo", "pkg", "service"]:
            val = params.get(key)
            if val:
                if isinstance(val, list):
                    val = ",".join(sorted(str(x) for x in val))
                target = str(val).strip()
                break

        if not target and "_raw" in params:
            target = params["_raw"].strip()

        # Clean Jinja syntax slightly for matching across template variations
        cleaned_target = re.sub(r'\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}', r'__VAR__', target).lower()
        cleaned_name = re.sub(r'\{\{\s*([a-zA-Z0-9_\.\-]+)\s*\}\}', r'__VAR__', name).lower()

        return f"{module}::{cleaned_target or cleaned_name}"

    @classmethod
    def parse_task_entry(cls, task_dict: Dict[str, Any], file_path: str, idx: int) -> Optional[AnsibleTask]:
        if not isinstance(task_dict, dict):
            return None

        name = task_dict.get("name", f"Unnamed task #{idx + 1}")
        module, params = cls.extract_module_and_params(task_dict)

        notify_val = task_dict.get("notify", [])
        if isinstance(notify_val, str):
            notify_val = [notify_val]
        elif not isinstance(notify_val, list):
            notify_val = []

        tags_val = task_dict.get("tags", [])
        if isinstance(tags_val, str):
            tags_val = [tags_val]
        elif not isinstance(tags_val, list):
            tags_val = []

        signature = cls.compute_task_signature(module, params, name)
        task_id = f"{file_path}:{idx}:{module}"

        return AnsibleTask(
            id=task_id,
            name=name,
            module=module,
            parameters=params,
            file_path=file_path,
            line_number=idx + 1,
            when=str(task_dict.get("when")) if "when" in task_dict else None,
            tags=tags_val,
            notify=notify_val,
            normalized_signature=signature
        )

    @classmethod
    def parse_file(cls, full_path: str, repo_root: str, repo_name: str) -> Optional[AnsibleAsset]:
        rel_path = os.path.relpath(full_path, repo_root).replace("\\", "/")
        filename = os.path.basename(full_path).lower()

        if not (filename.endswith(".yml") or filename.endswith(".yaml")):
            return None

        # Ignore dotfiles, hidden directories, node_modules, etc.
        if "/." in rel_path or "node_modules/" in rel_path or ".git/" in rel_path:
            return None

        doc = cls.load_yaml(full_path)
        if doc is None:
            return None

        # Determine script type
        norm_rel = "/" + rel_path.strip("/")
        asset_type = ScriptType.PLAYBOOK
        if "/roles/" in norm_rel:
            if "/tasks/" in norm_rel:
                asset_type = ScriptType.ROLE
            elif "/handlers/" in norm_rel:
                asset_type = ScriptType.HANDLER_FILE
            elif "/vars/" in norm_rel or "/defaults/" in norm_rel:
                asset_type = ScriptType.VARS_FILE
            else:
                asset_type = ScriptType.ROLE
        elif "/tasks/" in norm_rel or "tasks.yml" in filename or filename.endswith("_tasks.yml"):
            asset_type = ScriptType.TASK_FILE
        elif isinstance(doc, list) and any(isinstance(item, dict) and ("hosts" in item or "import_playbook" in item) for item in doc):
            asset_type = ScriptType.PLAYBOOK

        tasks: List[AnsibleTask] = []
        included_roles: List[str] = []
        included_tasks: List[str] = []
        imported_playbooks: List[str] = []
        target_hosts: Optional[str] = None

        if isinstance(doc, list):
            for i, item in enumerate(doc):
                if not isinstance(item, dict):
                    continue

                # Playbook root level play
                if "hosts" in item:
                    target_hosts = str(item["hosts"])

                if "import_playbook" in item:
                    imported_playbooks.append(str(item["import_playbook"]))

                # Check roles declared in play
                if "roles" in item and isinstance(item["roles"], list):
                    for r in item["roles"]:
                        if isinstance(r, str):
                            included_roles.append(r)
                        elif isinstance(r, dict) and "role" in r:
                            included_roles.append(str(r["role"]))
                        elif isinstance(r, dict) and "name" in r:
                            included_roles.append(str(r["name"]))

                # Collect tasks from tasks, pre_tasks, post_tasks, handlers
                for section in ["tasks", "pre_tasks", "post_tasks", "handlers"]:
                    if section in item and isinstance(item[section], list):
                        for sub_idx, t in enumerate(item[section]):
                            if isinstance(t, dict):
                                task_obj = cls.parse_task_entry(t, rel_path, len(tasks))
                                if task_obj:
                                    tasks.append(task_obj)
                                    # Detect dynamic includes
                                    if task_obj.module in ["include_role", "import_role"]:
                                        role_name = task_obj.parameters.get("name") or task_obj.parameters.get("_raw")
                                        if role_name:
                                            included_roles.append(str(role_name))
                                    elif task_obj.module in ["include_tasks", "import_tasks"]:
                                        file_name = task_obj.parameters.get("file") or task_obj.parameters.get("_raw")
                                        if file_name:
                                            included_tasks.append(str(file_name))
                
                # Check if this list item is itself a task (e.g. In a role tasks/main.yml)
                if any(k in item for k in ["name", "action"] + list(MODULE_NORMALIZER.values())):
                    if "hosts" not in item:
                        task_obj = cls.parse_task_entry(item, rel_path, len(tasks))
                        if task_obj:
                            tasks.append(task_obj)
                            if task_obj.module in ["include_role", "import_role"]:
                                role_name = task_obj.parameters.get("name") or task_obj.parameters.get("_raw")
                                if role_name:
                                    included_roles.append(str(role_name))
                            elif task_obj.module in ["include_tasks", "import_tasks"]:
                                file_name = task_obj.parameters.get("file") or task_obj.parameters.get("_raw")
                                if file_name:
                                    included_tasks.append(str(file_name))

        elif isinstance(doc, dict):
            # Single task or dict format
            task_obj = cls.parse_task_entry(doc, rel_path, 0)
            if task_obj:
                tasks.append(task_obj)

        asset_id = f"{repo_name}::{rel_path}"
        name = os.path.basename(full_path)
        if "/roles/" in norm_rel:
            parts = norm_rel.split("/")
            role_idx = parts.index("roles") if "roles" in parts else -1
            if role_idx != -1 and role_idx + 1 < len(parts):
                name = f"role:{parts[role_idx + 1]}"

        return AnsibleAsset(
            id=asset_id,
            name=name,
            repo_name=repo_name,
            relative_path=rel_path,
            full_path=full_path,
            asset_type=asset_type,
            tasks_count=len(tasks),
            tasks=tasks,
            included_roles=list(set(included_roles)),
            included_tasks=list(set(included_tasks)),
            imported_playbooks=list(set(imported_playbooks)),
            target_hosts=target_hosts
        )
